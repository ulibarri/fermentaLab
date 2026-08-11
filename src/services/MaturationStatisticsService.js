const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const MaturationCalculator =
    require("../utils/MaturationCalculator");

const {
    aggregateErrors,
    compareHistoricalAccuracy
} = require("../utils/MaturationStatistics");

const {
    toNumberOrNull,
    isMaturationCandidateBatch,
    batchMatchesProductFilter
} = require("./support/batchCandidates");

/*
 * Orquesta la Entrega 2.6.1.3: recorre los lotes históricos, evalúa cada
 * uno retrospectivamente (reutilizando evaluateHistorical() de la
 * 2.6.1.2, sin reimplementar nada del backtest) y acumula los errores
 * por modelo para producir estadísticas globales.
 *
 * No modifica ningún lote ni medición — es una lectura/cálculo bajo
 * demanda, igual que MaturationCalculator.
 */
class MaturationStatisticsService {

    constructor() {

        this.batchRepository =
            new ProductionBatchRepository();

        this.measurementRepository =
            new ProductionMeasurementRepository();

    }

    async getStatistics(filters = {}) {

        const allBatches =
            await this.batchRepository.findAll();

        const candidateBatches =
            allBatches.filter(

                batch =>
                    isMaturationCandidateBatch(batch) &&
                    batchMatchesProductFilter(batch, filters)

            );

        const linearErrors = [];

        const exponentialErrors = [];

        let evaluatedBatchCount = 0;

        let excludedBatchCount = 0;

        for (const batch of candidateBatches) {

            const measurements =
                await this.measurementRepository.findByBatch(batch.id);

            const recipeVersion =
                batch.recipeVersion;

            const evaluation =
                MaturationCalculator.evaluateHistorical({

                    measurements,

                    metric: recipeVersion.maturationMetric,

                    targetValue: toNumberOrNull(recipeVersion.maturationTarget),

                    phase: "F1"

                });

            const linearEvaluated =
                evaluation.linear && evaluation.linear.status === "EVALUATED";

            const exponentialEvaluated =
                evaluation.exponential && evaluation.exponential.status === "EVALUATED";

            if (linearEvaluated) {

                linearErrors.push(evaluation.linear.absoluteErrorHours);

            }

            if (exponentialEvaluated) {

                exponentialErrors.push(evaluation.exponential.absoluteErrorHours);

            }

            if (linearEvaluated || exponentialEvaluated) {

                evaluatedBatchCount++;

            } else {

                excludedBatchCount++;

            }

        }

        const linear =
            aggregateErrors(linearErrors);

        const exponential =
            aggregateErrors(exponentialErrors);

        const comparison =
            compareHistoricalAccuracy(linear, exponential);

        return {

            filters: {

                productId: filters.productId ?? null

            },

            sampleSize: evaluatedBatchCount + excludedBatchCount,

            evaluated: evaluatedBatchCount,

            excluded: excludedBatchCount,

            linear,

            exponential,

            comparison

        };

    }

}

module.exports =
    MaturationStatisticsService;
