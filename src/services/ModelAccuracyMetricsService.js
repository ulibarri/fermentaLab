const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const MaturationPredictionRepository =
    require("../repositories/MaturationPredictionRepository");

const PredictionEvaluation =
    require("../utils/PredictionEvaluation");

const ModelAccuracyMetrics =
    require("../utils/ModelAccuracyMetrics");

const { AVAILABLE_MODEL_TYPES } =
    require("../utils/MaturationModelTypes");

const { batchMatchesProductFilter } =
    require("./support/batchCandidates");

const DATE_ONLY_PATTERN =
    /^\d{4}-\d{2}-\d{2}$/;

/*
 * Orquesta la Entrega 2.6.1.14: agrega, POR MODELO, las evaluaciones
 * reales ya calculadas por PredictionEvaluation (2.6.1.13) en
 * MAE/RMSE/Bias y la distribución EARLY/LATE/EXACT.
 *
 * Cadena de datos, tal como la describe la sección 15 (nunca al
 * revés): PredictionEvaluation → Query → Aggregation → MAE/RMSE/Bias.
 * Este servicio SOLO lee -- nunca escribe una predicción, una
 * evaluación, un lote ni una medición.
 *
 * Solo la predicción VIGENTE de cada lote (isCurrent=true) participa
 * en el agregado, no cada predicción histórica que ese lote haya
 * tenido. Esto es una decisión deliberada (no está explícito en el
 * spec): como generatePrediction() se dispara en cada medición F1
 * nueva (2.6.1.12), un lote con muchas mediciones podría generar
 * muchas predicciones -- contarlas todas inflaría artificialmente el
 * tamaño de muestra de un modelo con las repeticiones de un mismo
 * lote, exactamente el tipo de "falsa precisión" que este proyecto
 * evita desde 2.6.1.0 (mínimos de muestra) y 2.6.1.5 (promediar por
 * lote, no por lectura cruda). Con "solo la vigente", sampleSize
 * corresponde 1:1 a lotes reales distintos evaluados -- igual que
 * MaturationStatisticsService (2.6.1.3) cuenta por lote, no por
 * predicción.
 */
class ModelAccuracyMetricsService {

    constructor() {

        this.batchRepository =
            new ProductionBatchRepository();

        this.predictionRepository =
            new MaturationPredictionRepository();

    }

    /*
     * `to` sin componente de hora (solo "YYYY-MM-DD") se interpreta
     * inclusivo hasta el final de ese día -- de otro modo un filtro
     * "hasta el 09/08" excluiría cualquier maduración real ocurrida
     * esa misma tarde, lo cual sorprendería al usuario. Judgment call,
     * no especificado explícitamente.
     */
    _parseDate(value, { endOfDay = false } = {}) {

        if (!value) {

            return null;

        }

        const isDateOnly =
            DATE_ONLY_PATTERN.test(value);

        const date =
            new Date(isDateOnly && endOfDay ? `${value}T23:59:59.999Z` : value);

        return Number.isNaN(date.getTime()) ? null : date;

    }

    _matchesPeriod(actualMaturationAt, from, to) {

        const millis =
            new Date(actualMaturationAt).getTime();

        if (!Number.isFinite(millis)) {

            return false;

        }

        if (from && millis < from.getTime()) {

            return false;

        }

        if (to && millis > to.getTime()) {

            return false;

        }

        return true;

    }

    /*
     * Sección 9: el periodo (from/to) filtra por la fecha de
     * MADURACIÓN REAL (`batch.finishedAt`) -- no por cuándo se generó
     * la predicción -- porque esta entrega evalúa desempeño frente a
     * resultados reales ("predicciones reales + maduración real"),
     * así que "métricas de julio" se lee naturalmente como "lotes cuyo
     * resultado real se conoció en julio". Ese dato ya se necesita de
     * todos modos para construir la evaluación, así que no cuesta una
     * consulta extra.
     */
    async getMetrics(filters = {}) {

        const allBatches =
            await this.batchRepository.findAll();

        const candidateBatches =
            allBatches.filter(batch => batchMatchesProductFilter(batch, filters));

        const from =
            this._parseDate(filters.from);

        const to =
            this._parseDate(filters.to, { endOfDay: true });

        const byModel =
            new Map();

        const excluded = {

            pending: 0,

            noPrediction: 0,

            unavailable: 0

        };

        let considered = 0;

        for (const batch of candidateBatches) {

            const actualMaturationAt =
                batch.finishedAt ?? null;

            // Sección 6: PENDING (F1 no finalizado todavía) nunca
            // participa -- y nunca se interpreta como error 0.
            if (!actualMaturationAt) {

                excluded.pending++;

                continue;

            }

            if (!this._matchesPeriod(actualMaturationAt, from, to)) {

                // Fuera del periodo solicitado -- ni se cuenta ni se
                // excluye, simplemente no entra al alcance pedido.
                continue;

            }

            const currentPrediction =
                await this.predictionRepository.findCurrentByBatch(batch.id);

            // Sección 6/14: lote con maduración real pero SIN ninguna
            // predicción -- no se fabrica una evaluación de la nada.
            if (!currentPrediction) {

                excluded.noPrediction++;

                continue;

            }

            const evaluation =
                PredictionEvaluation.evaluatePrediction({

                    predictedMaturationAt: currentPrediction.predictedMaturationAt,

                    predictedDurationHours: currentPrediction.predictedDurationHours,

                    actualMaturationAt

                });

            // La predicción vigente no tenía una ETA calculable en su
            // momento (modelo divergente/insuficiente) -- no hay un
            // errorHours numérico que agregar.
            if (evaluation.status !== "EVALUATED") {

                excluded.unavailable++;

                continue;

            }

            considered++;

            const modelType =
                currentPrediction.modelType;

            if (!byModel.has(modelType)) {

                byModel.set(modelType, []);

            }

            byModel.get(modelType).push({

                errorHours: evaluation.errorHours,

                direction: evaluation.direction

            });

        }

        // Sección 7: siempre reportar LINEAR y EXPONENTIAL, incluso
        // con sampleSize 0 -- así el frontend nunca tiene que adivinar
        // qué modelos existen en el catálogo.
        const models =
            AVAILABLE_MODEL_TYPES.map(modelType =>

                ModelAccuracyMetrics.summarizeModelAccuracy(

                    modelType,

                    byModel.get(modelType) || []

                )

            );

        // Sección 13/14: comparación directa (menor MAE/RMSE) e
        // interpretación en lenguaje sencillo -- generadas aquí, no en
        // el frontend, para mantener el lenguaje centralizado y
        // controlado (nunca "es estadísticamente mejor", sección 12).
        // No modifica ni alimenta las reglas de ModelRecommendation.js
        // (2.6.1.10) -- es una fuente de evidencia nueva e
        // independiente (sección 14).
        const comparison =
            ModelAccuracyMetrics.buildComparison(models);

        const interpretation =
            ModelAccuracyMetrics.buildInterpretation(models);

        return {

            scope: {

                productId: filters.productId ?? null,

                recipeId: filters.recipeId ?? null,

                recipeVersionId: filters.recipeVersionId ?? null,

                from: filters.from ?? null,

                to: filters.to ?? null

            },

            batchesConsidered: considered,

            batchesExcluded: excluded.pending + excluded.noPrediction + excluded.unavailable,

            excluded,

            models,

            comparison,

            interpretation,

            note: "Estas métricas describen el desempeño observado hasta ahora; no constituyen una recomendación automática de modelo."

        };

    }

}

module.exports =
    ModelAccuracyMetricsService;
