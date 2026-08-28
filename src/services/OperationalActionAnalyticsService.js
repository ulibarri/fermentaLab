const ProductionAlertActionRepository =
    require("../repositories/ProductionAlertActionRepository");

const OperationalActionAnalytics =
    require("../utils/OperationalActionAnalytics");

/*
 * Entrega 2.7.0.7 -- "desglose de acciones". Servicio especializado de
 * SOLO CONSULTA/AGREGACIÓN (Acción 3): nunca crea, edita ni elimina
 * nada -- reutiliza `ProductionAlertActionRepository` tal cual (el
 * mismo repositorio de 2.7.0.5/2.7.0.6, sin ninguna tabla ni columna
 * nueva, ver Acción 1) y delega TODO el cálculo agregado en el módulo
 * puro `OperationalActionAnalytics.js` -- este servicio nunca decide
 * él mismo si una acción "mejoró" o cuánto vale un porcentaje (sección
 * "el frontend no debe calcular las métricas agregadas" aplica
 * igual de fuerte a este servicio: la única fuente de verdad del
 * CÁLCULO es el módulo puro).
 *
 * `from`/`to` filtran por `createdAt` de la acción (= "actionCreatedAt"
 * del spec, Acción 8: "Propongo usar actionCreatedAt porque el análisis
 * estudia cuándo ocurrió la acción") -- mismo criterio de comparación
 * simple por instante exacto (`new Date(value)`, sin ajuste de "fin del
 * día") ya usado por `RecalibrationEffectivenessSummaryService.getSummary()`
 * (2.6.1.33) para `dateFrom`/`dateTo`, en vez de inventar una semántica
 * de rango de días nueva para esta entrega.
 */
class OperationalActionAnalyticsService {

    constructor() {

        this.actionRepository =
            new ProductionAlertActionRepository();

    }

    /*
     * Acción 3/9 -- aplica los filtros EN LA CONSULTA (nunca trae todo
     * y filtra después), extrae de cada fila solo lo que el módulo puro
     * necesita (Acción 1: tipo, severidad original, estado de
     * efectividad), y delega la agregación completa en
     * `OperationalActionAnalytics.buildAnalyticsDTO()`.
     */
    async getAnalytics({ from, to, actionType, effectivenessStatus, alertSeverity, productId } = {}) {

        const rows =
            await this.actionRepository.findForAnalytics({

                from: from ? new Date(from) : undefined,

                to: to ? new Date(to) : undefined,

                actionType: actionType || undefined,

                effectivenessStatus: effectivenessStatus || undefined,

                alertSeverity: alertSeverity || undefined,

                productId: productId || undefined

            });

        // Acción 1 -- únicamente los campos que el módulo puro de
        // agregación necesita, nunca las instancias de Sequelize
        // completas (mismo criterio que RecalibrationProcessAnalysis.
        // summarize(), 2.6.1.33: el módulo puro solo ve datos planos).
        const plainActions =
            rows.map(row => ({

                type: row.type,

                effectivenessStatus: row.effectivenessStatus,

                alertSeverityAtAction: row.alertSeverityAtAction

            }));

        return OperationalActionAnalytics.buildAnalyticsDTO(plainActions);

    }

}

module.exports =
    OperationalActionAnalyticsService;
