const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const MaturationCalculator =
    require("../utils/MaturationCalculator");

const {
    aggregateReadings,
    computeTemperatureStats,
    computeFermentationRate,
    correlateWithLabel,
    groupByTemperatureRange
} = require("../utils/TemperatureAnalysis");

const {
    toNumberOrNull,
    isMaturationCandidateBatch,
    batchMatchesProductFilter
} = require("./support/batchCandidates");

/*
 * Orquesta la Entrega 2.6.1.4: relaciona temperatura (producto y
 * ambiente) con la velocidad de maduración y el error de predicción,
 * por lote, y agrega esos números en correlaciones y comparaciones por
 * rango de temperatura.
 *
 * Usa el mismo criterio de "lote candidato" que MaturationStatisticsService
 * (2.6.1.3) — ver src/services/support/batchCandidates.js — y reutiliza
 * MaturationCalculator.evaluateHistorical() para el error de ETA de cada
 * modelo, sin reimplementar el backtest.
 *
 * Es puramente descriptivo/exploratorio: no ajusta ninguna ecuación
 * temperatura → velocidad, no modifica lotes ni mediciones, y todo el
 * texto que produce usa lenguaje de correlación, nunca de causalidad.
 */
class TemperatureAnalysisService {

    constructor() {

        this.batchRepository =
            new ProductionBatchRepository();

        this.measurementRepository =
            new ProductionMeasurementRepository();

    }

    async getAnalysis(filters = {}) {

        const allBatches =
            await this.batchRepository.findAll();

        const candidateBatches =
            allBatches.filter(

                batch =>
                    isMaturationCandidateBatch(batch) &&
                    batchMatchesProductFilter(batch, filters)

            );

        // Promedio de temperatura de CADA lote candidato (uno por lote,
        // no cada lectura individual) — así cada lote pesa lo mismo en
        // el agregado "del conjunto de lotes" (sección 2/8 de la
        // especificación), sin que un lote con muchas mediciones domine
        // el resultado frente a uno con pocas.
        const allProductReadings = [];

        const allAmbientReadings = [];

        // Una fila por lote — es el nivel al que se calculan las
        // correlaciones y la agrupación por rangos (sección 4 y 6).
        const batchRows = [];

        let batchesWithProductTemperature = 0;

        let batchesWithAmbientTemperature = 0;

        let batchesWithFermentationRate = 0;

        let batchesWithLinearError = 0;

        let batchesWithExponentialError = 0;

        for (const batch of candidateBatches) {

            const measurements =
                await this.measurementRepository.findByBatch(batch.id);

            const recipeVersion =
                batch.recipeVersion;

            const metric =
                recipeVersion.maturationMetric;

            const targetValue =
                toNumberOrNull(recipeVersion.maturationTarget);

            const tempStats =
                computeTemperatureStats(measurements, "F1");

            const rateResult =
                computeFermentationRate(measurements, metric, "F1");

            const evaluation =
                MaturationCalculator.evaluateHistorical({

                    measurements,

                    metric,

                    targetValue,

                    phase: "F1"

                });

            const linearErrorHours =
                evaluation.linear && evaluation.linear.status === "EVALUATED"
                    ? evaluation.linear.absoluteErrorHours
                    : null;

            const exponentialErrorHours =
                evaluation.exponential && evaluation.exponential.status === "EVALUATED"
                    ? evaluation.exponential.absoluteErrorHours
                    : null;

            if (tempStats.product.count > 0) {

                batchesWithProductTemperature++;

            }

            if (tempStats.ambient.count > 0) {

                batchesWithAmbientTemperature++;

            }

            if (rateResult) {

                batchesWithFermentationRate++;

            }

            if (linearErrorHours !== null) {

                batchesWithLinearError++;

            }

            if (exponentialErrorHours !== null) {

                batchesWithExponentialError++;

            }

            if (tempStats.product.average !== null) {

                allProductReadings.push(tempStats.product.average);

            }

            if (tempStats.ambient.average !== null) {

                allAmbientReadings.push(tempStats.ambient.average);

            }

            batchRows.push({

                batchId: batch.id,

                batchNumber: batch.batchNumber,

                productTemperature: tempStats.product.average,

                ambientTemperature: tempStats.ambient.average,

                fermentationRate: rateResult ? rateResult.rateAbsolutePerHour : null,

                durationHours: rateResult ? rateResult.durationHours : null,

                linearErrorHours,

                exponentialErrorHours

            });

        }

        const temperatureVsRatePairs =
            batchRows.map(row => ({ x: row.productTemperature, y: row.fermentationRate }));

        const temperatureVsLinearErrorPairs =
            batchRows.map(row => ({ x: row.productTemperature, y: row.linearErrorHours }));

        const temperatureVsExponentialErrorPairs =
            batchRows.map(row => ({ x: row.productTemperature, y: row.exponentialErrorHours }));

        const temperatureVsFermentationRate =
            correlateWithLabel(temperatureVsRatePairs, "temperatura del producto", "velocidad de fermentación");

        const temperatureVsPredictionErrorLinear =
            correlateWithLabel(temperatureVsLinearErrorPairs, "temperatura del producto", "error de predicción del modelo lineal");

        const temperatureVsPredictionErrorExponential =
            correlateWithLabel(temperatureVsExponentialErrorPairs, "temperatura del producto", "error de predicción del modelo exponencial");

        const ranges =
            groupByTemperatureRange(batchRows);

        return {

            filters: {

                productId: filters.productId ?? null

            },

            sampleSize: candidateBatches.length,

            batchesWithProductTemperature,

            batchesWithAmbientTemperature,

            batchesWithFermentationRate,

            batchesWithLinearError,

            batchesWithExponentialError,

            productTemperature: aggregateReadings(allProductReadings),

            ambientTemperature: aggregateReadings(allAmbientReadings),

            correlation: {

                temperatureVsFermentationRate,

                temperatureVsPredictionErrorLinear,

                temperatureVsPredictionErrorExponential

            },

            ranges,

            note: "Estas correlaciones son una herramienta exploratoria: no implican que la temperatura sea la causa de los resultados observados."

        };

    }

}

module.exports =
    TemperatureAnalysisService;
