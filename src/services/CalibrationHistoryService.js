const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const MaturationPredictionRepository =
    require("../repositories/MaturationPredictionRepository");

const MaturationCalibrationEvaluationRepository =
    require("../repositories/MaturationCalibrationEvaluationRepository");

const CalibrationEffectivenessService =
    require("./CalibrationEffectivenessService");

const RecalibrationEffectivenessService =
    require("./RecalibrationEffectivenessService");

const CalibrationHistoryAnalysis =
    require("../utils/CalibrationHistoryAnalysis");

function toNumberOrNull(value) {

    return value === null || value === undefined ? null : Number(value);

}

/*
 * Historial de evolución del modelo (Entrega 2.6.1.31).
 *
 * Responde una pregunta longitudinal que ningún servicio anterior
 * respondía todavía: "¿cómo ha evolucionado la precisión predictiva a
 * través de TODA la cadena de calibraciones de un (modelType,
 * recipeVersionId), no solo la calibración activa de hoy?"
 *
 * Principio rector (sección 13, "no debemos recalcular las métricas
 * históricas desde cero si ya existen evaluaciones persistidas: la
 * fuente de verdad será la evaluación almacenada"): las métricas
 * MAE/RMSE/Bias que alimentan la tabla principal, las gráficas y la
 * comparación entre versiones consecutivas / acumulada se leen
 * SIEMPRE de la ÚLTIMA fila ya persistida en
 * `maturation_calibration_evaluations` (2.6.1.17, `evaluateAndStore()`)
 * -- nunca se vuelve a ejecutar `_collectComparisons()` para
 * recalcularlas. Si una versión de la cadena nunca fue evaluada (nadie
 * corrió `POST .../evaluate` sobre ella), sus métricas quedan `null`
 * -- nunca se fabrica un número "en vivo" para rellenar el hueco,
 * mismo criterio de "evitar falsa precisión" que gobierna todo este
 * proyecto desde 2.6.1.3.
 *
 * La ÚNICA excepción deliberada es la distinción SIMULACIÓN vs.
 * POST-ACTIVACIÓN (sección 4) -- ahí esta entrega reutiliza tal cual
 * `CalibrationEffectivenessService.getPostActivationEvaluation()`
 * (2.6.1.27, ya en vivo por diseño desde su propia entrega), porque el
 * spec explícitamente pide reutilizar "la distinción que estableciste
 * anteriormente" y no existe (ni existió nunca) una tabla persistida
 * para el lado SIMULADO -- no hay nada que "recalcular desde cero"
 * evitar aquí, es la misma herramienta ya construida, invocada de
 * nuevo. Este bloque se mantiene deliberadamente SEPARADO de las
 * métricas principales (nunca se mezclan en un solo número, sección 4)
 * y se marca explícitamente como una lectura en vivo en su propia
 * forma serializada.
 *
 * "Predicciones"/"Evaluadas" (sección 9) tampoco son una "métrica
 * histórica recalculada" en el sentido de la sección 13 -- son un
 * simple CONTEO de filas de `MaturationPrediction` ya existentes, sin
 * ningún cálculo de error/precisión de por medio; se cuentan en vivo a
 * propósito para que el nivel de evidencia (sección 10) siempre
 * refleje cuántas predicciones tienen HOY resultado real disponible,
 * incluso si la última evaluación almacenada es más vieja que algunas
 * de ellas.
 */
class CalibrationHistoryService {

    constructor() {

        this.calibrationRepository =
            new MaturationModelCalibrationRepository();

        this.predictionRepository =
            new MaturationPredictionRepository();

        this.evaluationRepository =
            new MaturationCalibrationEvaluationRepository();

        this.effectivenessService =
            new CalibrationEffectivenessService();

        // Entrega 2.6.1.32 -- columna "Efectividad" (sección 11):
        // ¿la mejora que prometía la simulación de esta versión
        // realmente ocurrió tras activarla? Reutilizada aquí EN VIVO
        // (mismo criterio que `simulationVsActual` un poco más abajo)
        // en vez de leer únicamente snapshots persistidos, para que
        // esta tabla siempre refleje la evidencia post-activación más
        // fresca sin requerir que alguien haya corrido "Evaluar"
        // manualmente antes.
        this.recalibrationEffectivenessService =
            new RecalibrationEffectivenessService();

    }

    _recipeVersionLabel(recipeVersion) {

        if (!recipeVersion) {

            return null;

        }

        const recipeName =
            recipeVersion.recipe ? recipeVersion.recipe.name : null;

        const productName =
            recipeVersion.recipe && recipeVersion.recipe.product
                ? recipeVersion.recipe.product.name
                : null;

        return {

            id: recipeVersion.id,

            version: recipeVersion.version,

            recipeName,

            productName

        };

    }

    /*
     * Sección 13 -- GET .../calibrations/history, con filtros
     * OPCIONALES `modelType`/`dateFrom`/`dateTo` (los que pide el
     * spec) más `recipeVersionId` (aditivo, no pedido explícitamente).
     *
     * Un (modelType, recipeVersionId) es SIEMPRE el alcance de una
     * cadena de versiones (2.6.1.19) -- "nunca mezclar automáticamente
     * todas las recetas" es una regla repetida desde 2.6.1.5 en
     * adelante, así que sin un `recipeVersionId` explícito esta
     * respuesta se AUTO-SEGMENTA por alcance, mismo patrón exacto que
     * `VolumeAnalysisService`/`MultivariableAnalysisService` (2.6.1.5/
     * 2.6.1.6): con `recipeVersionId` -> forma plana de un solo
     * alcance; sin él -> `{segmentedByRecipeVersion:true, scopes:[...]}`.
     *
     * `dateFrom`/`dateTo` filtran qué ALCANCES (cadenas completas)
     * califican para aparecer -- nunca recortan una cadena a la mitad.
     * Recortar una cadena rompería la comparación v(n-1)->v(n) de la
     * sección 5 y podría ocultar justo la versión que empeoró (sección
     * 7, prohibición explícita de esconder una degradación) si su
     * `createdAt` cayera fuera del rango pero una versión posterior de
     * la misma cadena sí calificara. Un alcance califica si AL MENOS
     * UNA de sus calibraciones tiene `createdAt` dentro del rango.
     */
    async getHistory({ modelType, recipeVersionId, dateFrom, dateTo } = {}) {

        const candidates =
            await this.calibrationRepository.findAll({

                modelType: modelType || undefined,

                recipeVersionId: recipeVersionId || undefined

            });

        const scopeMap =
            new Map();

        for (const row of candidates) {

            const key =
                `${row.modelType}::${row.recipeVersionId}`;

            if (!scopeMap.has(key)) {

                scopeMap.set(key, { modelType: row.modelType, recipeVersionId: row.recipeVersionId, rows: [] });

            }

            scopeMap.get(key).rows.push(row);

        }

        const fromMs =
            dateFrom ? new Date(dateFrom).getTime() : null;

        const toMs =
            dateTo ? new Date(dateTo).getTime() : null;

        const qualifyingScopes =
            [];

        for (const scope of scopeMap.values()) {

            // Sección 1 -- una cadena solo cuenta como "evolución del
            // modelo" si al menos una de sus calibraciones llegó a
            // ACTIVE alguna vez; una PROPOSED/APPROVED/REJECTED que
            // nunca se usó no aportó ninguna predicción real y no tiene
            // precisión que evolucionar (ver el comentario de
            // `_buildScopeHistory()` para el mismo filtro aplicado
            // fila por fila).
            const everActivated =
                scope.rows.some(r => r.activatedAt);

            if (!everActivated) {

                continue;

            }

            if (fromMs !== null || toMs !== null) {

                const inRange =
                    scope.rows.some(r => {

                        const createdMs =
                            new Date(r.createdAt).getTime();

                        if (fromMs !== null && createdMs < fromMs) return false;

                        if (toMs !== null && createdMs > toMs) return false;

                        return true;

                    });

                if (!inRange) {

                    continue;

                }

            }

            qualifyingScopes.push(scope);

        }

        const scopes =
            [];

        for (const scope of qualifyingScopes) {

            scopes.push(await this._buildScopeHistory(scope.modelType, scope.recipeVersionId));

        }

        scopes.sort((a, b) => {

            if (a.modelType !== b.modelType) return a.modelType < b.modelType ? -1 : 1;

            return Number(a.recipeVersionId) - Number(b.recipeVersionId);

        });

        if (recipeVersionId && scopes.length <= 1) {

            return scopes[0] || null;

        }

        return {

            segmentedByRecipeVersion: true,

            scopes

        };

    }

    /*
     * Construye la línea histórica completa de UN alcance (modelType,
     * recipeVersionId) -- secciones 1/2/4/5/6/7/8/9/10/11/12.
     */
    async _buildScopeHistory(modelType, recipeVersionId) {

        const chain =
            await this.calibrationRepository.findVersionChain(modelType, recipeVersionId);

        // Mismo filtro que en getHistory(): solo versiones que
        // realmente llegaron a ACTIVE entran a la línea de evolución
        // (nunca se RENUMERAN -- una v3 rechazada y omitida no hace que
        // v4 pase a llamarse v3, el número `version` real siempre se
        // conserva y se muestra tal cual, sección 1: "para cada versión
        // podremos conocer... calibración padre" -- renumerar rompería
        // esa trazabilidad).
        const activatedChain =
            chain.filter(record => record.activatedAt);

        const now =
            new Date();

        const versions =
            [];

        let previousMetrics =
            null;

        for (let i = 0; i < activatedChain.length; i++) {

            const record =
                activatedChain[i];

            const predictions =
                await this.predictionRepository.findByCalibration(record.id);

            const predictionsCount =
                predictions.length;

            const evaluatedCount =
                predictions.filter(p => p.productionBatch && p.productionBatch.finishedAt).length;

            const evidence =
                CalibrationHistoryAnalysis.classifyEvidenceLevel(evaluatedCount);

            // Sección 13 -- fuente de verdad: la evaluación ALMACENADA
            // más reciente de esta calibración (nunca se recalcula).
            // `findByCalibration()` ya ordena más reciente primero
            // (2.6.1.17).
            const evaluationRows =
                await this.evaluationRepository.findByCalibration(record.id);

            const latestEvaluation =
                evaluationRows[0] || null;

            const metrics =
                latestEvaluation ? {

                    sampleSize: latestEvaluation.sampleSize,

                    maeHours: toNumberOrNull(latestEvaluation.calibratedMaeHours),

                    rmseHours: toNumberOrNull(latestEvaluation.calibratedRmseHours),

                    biasHours: toNumberOrNull(latestEvaluation.calibratedBiasHours),

                    evaluatedAt: latestEvaluation.createdAt

                } : null;

            const activeDuration =
                CalibrationHistoryAnalysis.computeActiveDuration({

                    activatedAt: record.activatedAt,

                    deactivatedAt: record.deactivatedAt,

                    now

                });

            const comparisonWithPrevious =
                i === 0
                    ? { result: null, resultLabel: null, reason: "FIRST_VERSION", metrics: null }
                    : CalibrationHistoryAnalysis.compareConsecutiveVersions(previousMetrics, metrics);

            // Sección 4 -- SIMULACIÓN (pre-activación, sobre la
            // calibración PADRE) vs. POST-ACTIVACIÓN (real, de ESTA
            // calibración), reutilizando 2.6.1.27 tal cual. Solo tiene
            // sentido si esta versión reemplazó a otra -- una v1 nunca
            // fue una propuesta simulada (mismo criterio que
            // `getPostActivationEvaluation()` ya aplica internamente).
            let simulationVsActual =
                null;

            // Entrega 2.6.1.32, secciones 1-10 -- "¿la mejora que
            // prometía la simulación de esta versión realmente ocurrió
            // después de activarla?" EN VIVO, misma disciplina que
            // `simulationVsActual` (solo tiene sentido con padre).
            let effectiveness =
                null;

            if (record.parentCalibrationId) {

                effectiveness =
                    await this.recalibrationEffectivenessService.evaluate(record.id);

                const postActivation =
                    await this.effectivenessService.getPostActivationEvaluation(record.id);

                simulationVsActual = {

                    evaluationStatus: postActivation.evaluationStatus,

                    // `simulateProposedOffset()` (2.6.1.24) ya regresa
                    // directamente el resumen SIMULADO (nunca envuelto
                    // en un objeto `{simulated: ...}` -- esa envoltura
                    // solo la tiene `simulateProposedOffsetWithPairs()`,
                    // el método más general que lo implementa por
                    // debajo), así que `getPostActivationEvaluation()`'s
                    // `simulatedPreActivation` YA es ese resumen tal
                    // cual.
                    simulated: postActivation.simulatedPreActivation ? {

                        sampleSize: postActivation.simulatedPreActivation.sampleSize,

                        maeHours: postActivation.simulatedPreActivation.maeHours,

                        rmseHours: postActivation.simulatedPreActivation.rmseHours,

                        biasHours: postActivation.simulatedPreActivation.biasHours

                    } : null,

                    actual: {

                        sampleSize: postActivation.actual.sampleSize,

                        maeHours: postActivation.actual.maeHours,

                        rmseHours: postActivation.actual.rmseHours,

                        biasHours: postActivation.actual.biasHours

                    }

                };

            }

            versions.push({

                id: record.id,

                version: record.version,

                status: record.status,

                isCurrentlyActive: record.status === "ACTIVE",

                parentCalibrationId: record.parentCalibrationId ?? null,

                modelType: record.modelType,

                createdAt: record.createdAt,

                createdBy: record.createdBy,

                reason: record.reason,

                activatedAt: record.activatedAt,

                deactivatedAt: record.deactivatedAt,

                activeDuration,

                predictionsCount,

                evaluatedCount,

                evidence,

                metrics,

                comparisonWithPrevious,

                simulationVsActual,

                effectiveness

            });

            previousMetrics =
                metrics;

        }

        // Sección 6 -- "primera calibración" es SIEMPRE v1 tal cual
        // (la primera de la cadena activada), nunca la primera que
        // tenga métricas -- si v1 nunca fue evaluada, la mejora
        // acumulada queda null en vez de sustituirla silenciosamente
        // por otra versión.
        const firstVersion =
            versions[0] || null;

        const activeVersion =
            versions.find(v => v.isCurrentlyActive) || null;

        // "Actual" preferimos la ACTIVE de hoy; si ninguna lo está
        // (todo el alcance quedó INACTIVE, sin reemplazo todavío
        // vigente), usamos la más reciente de la cadena.
        const currentVersion =
            activeVersion || versions[versions.length - 1] || null;

        const progressSinceFirst =
            CalibrationHistoryAnalysis.computeCumulativeImprovement(

                firstVersion ? firstVersion.metrics : null,

                currentVersion ? currentVersion.metrics : null

            );

        const chainRecipeVersion =
            chain.length > 0 ? chain[0].recipeVersion : null;

        return {

            modelType,

            recipeVersionId,

            recipeVersion: this._recipeVersionLabel(chainRecipeVersion),

            activeCalibrationId: activeVersion ? activeVersion.id : null,

            firstVersionId: firstVersion ? firstVersion.id : null,

            currentVersionId: currentVersion ? currentVersion.id : null,

            versions,

            progressSinceFirst

        };

    }

}

module.exports =
    CalibrationHistoryService;
