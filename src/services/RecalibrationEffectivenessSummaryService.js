const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const RecalibrationEffectivenessService =
    require("./RecalibrationEffectivenessService");

const RecalibrationProcessAnalysis =
    require("../utils/RecalibrationProcessAnalysis");

/*
 * Análisis global de la efectividad del proceso de recalibración
 * (Entrega 2.6.1.33). Cierre del bloque 2.6.1.x -- ver el comentario de
 * cabecera de `RecalibrationProcessAnalysis.js` para la pregunta que
 * responde esta entrega.
 *
 * Decisión de arquitectura central, sección 16 ("Persistencia vs.
 * cálculo"): el spec advierte explícitamente contra la inconsistencia
 * "tabla = 87.4%, dashboard = 89.1%" y pide que los agregados se
 * calculen "a partir de los datos persistidos", usando el propio
 * diagrama `RecalibrationEffectiveness -> aggregation -> dashboard`
 * (nota: nombra el MÓDULO de cálculo, no la tabla de snapshots
 * `recalibration_effectiveness_evaluations`). Esta entrega resuelve esa
 * instrucción reutilizando la MISMA fuente EN VIVO que ya alimenta la
 * columna "Efectividad" de `/maturation/model-history` (2.6.1.31/32,
 * `RecalibrationEffectivenessService.evaluate()`) en vez de leer los
 * snapshots persistidos por `evaluateAndStore()` -- así es
 * estructuralmente imposible que el dashboard global y la tabla
 * individual diverjan (ambos llaman exactamente la misma función, con
 * la misma evidencia fresca), que es precisamente el escenario que la
 * sección 16 quiere evitar. La tabla `recalibration_effectiveness_evaluations`
 * (2.6.1.32) sigue existiendo y sigue siendo el registro auditable
 * inmutable por calibración (sección 14/17 de 2.6.1.32) -- esta entrega
 * simplemente no la usa como fuente para el resumen global. Judgment
 * call, flagueado en el resumen final de la entrega.
 *
 * Candidatas a "recalibración evaluable" (sección 1, "todas las
 * recalibraciones que ya tienen evaluación real suficiente"): cualquier
 * calibración con `parentCalibrationId` (reemplazó a otra, sección 6 de
 * 2.6.1.32) que además llegó a activarse alguna vez (`activatedAt`
 * presente) -- una PROPOSED/APPROVED/REJECTED nunca generó predicciones
 * reales, mismo filtro exacto que `CalibrationHistoryService` (2.6.1.31)
 * ya usa para su propia cadena de versiones.
 */
class RecalibrationEffectivenessSummaryService {

    constructor() {

        this.calibrationRepository =
            new MaturationModelCalibrationRepository();

        this.recalibrationEffectivenessService =
            new RecalibrationEffectivenessService();

    }

    /*
     * Sección 12/15 -- filtros soportados por el endpoint:
     * `model`/`dateFrom`/`dateTo` (los tres que el spec nombra
     * explícitamente en la sección 15 como parámetros de la API). El
     * resto de filtros que la sección 12 menciona para la VISTA
     * (estado, calibración, resultado, nivel de efectividad) se aplican
     * del lado del cliente sobre el array `records` que esta respuesta
     * ya incluye completo (sección 15, "también será conveniente
     * exponer el detalle de las recalibraciones utilizadas en el
     * cálculo") -- no tiene sentido duplicar esos filtros más finos en
     * el servidor cuando el payload que los soporta ya viaja completo en
     * cada respuesta. Judgment call, flagueado en el resumen final.
     *
     * `dateFrom`/`dateTo` filtran por `activatedAt` (cuándo la
     * recalibración entró en vigor) -- no por `createdAt` de la
     * evaluación, que ni siquiera existe para un cálculo EN VIVO.
     */
    async getSummary({ model, dateFrom, dateTo } = {}) {

        const allCalibrations =
            await this.calibrationRepository.findAll({

                modelType: model || undefined

            });

        const candidates =
            allCalibrations.filter(row => row.parentCalibrationId && row.activatedAt);

        const fromMs =
            dateFrom ? new Date(dateFrom).getTime() : null;

        const toMs =
            dateTo ? new Date(dateTo).getTime() : null;

        const filteredCandidates =
            candidates.filter(row => {

                const activatedMs =
                    new Date(row.activatedAt).getTime();

                if (fromMs !== null && activatedMs < fromMs) {

                    return false;

                }

                if (toMs !== null && activatedMs > toMs) {

                    return false;

                }

                return true;

            });

        const records =
            [];

        for (const calibration of filteredCandidates) {

            const evaluation =
                await this.recalibrationEffectivenessService.evaluate(calibration.id);

            records.push({

                calibrationId: calibration.id,

                // `RecalibrationEffectivenessService.evaluate()` no
                // incluye `modelType` en su respuesta (no lo necesitaba
                // para nada -- 2.6.1.32 siempre se invoca ya sabiendo de
                // qué calibración se trata). Esta entrega SÍ lo necesita
                // para poder agrupar por modelo (sección 9), así que se
                // añade aquí desde la fila de calibración ya cargada.
                modelType: calibration.modelType,

                recipeVersionId: calibration.recipeVersionId,

                version: calibration.version,

                activatedAt: calibration.activatedAt,

                ...evaluation

            });

        }

        const aggregation =
            RecalibrationProcessAnalysis.summarize(records);

        return {

            filters: {

                model: model || null,

                dateFrom: dateFrom || null,

                dateTo: dateTo || null

            },

            ...aggregation,

            // Sección 14/15 -- trazabilidad completa: cada indicador de
            // arriba puede relacionarse con las recalibraciones que lo
            // originan porque ESTA misma lista es la que
            // `RecalibrationProcessAnalysis.summarize()` acaba de
            // agregar -- nunca una segunda consulta que podría
            // desincronizarse.
            records: this._serializeRecords(records)

        };

    }

    _serializeRecords(records) {

        return records.map(record => ({

            calibrationId: record.calibrationId,

            modelType: record.modelType,

            recipeVersionId: record.recipeVersionId,

            version: record.version,

            activatedAt: record.activatedAt,

            status: record.status,

            isRegression: record.isRegression,

            sampleSize: record.sampleSize,

            effectivenessScore: record.effectivenessScore,

            tier: record.tier,

            expected: record.expected,

            actual: record.actual

        }));

    }

}

module.exports =
    RecalibrationEffectivenessSummaryService;
