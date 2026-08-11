const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const MaturationCalculator =
    require("../utils/MaturationCalculator");

const {
    computeTemperatureStats,
    computeFermentationRate
} = require("../utils/TemperatureAnalysis");

const {
    groupByVolume,
    computeVolumeCorrelations
} = require("../utils/VolumeAnalysis");

const {
    toNumberOrNull,
    isMaturationCandidateBatch,
    batchMatchesProductFilter
} = require("./support/batchCandidates");

/*
 * Orquesta la Entrega 2.6.1.5: relaciona el volumen PLANEADO del lote
 * con la velocidad de maduración, el error de predicción de cada modelo
 * y la temperatura (reutilizando 2.6.1.4), agrupando y correlacionando
 * — nunca mezclando productos distintos.
 *
 * Usa el mismo criterio de "lote candidato" que MaturationStatisticsService
 * y TemperatureAnalysisService (src/services/support/batchCandidates.js)
 * y reutiliza evaluateHistorical() para el error de ETA de cada modelo,
 * sin reimplementar el backtest.
 *
 * Regla dura de esta entrega: NUNCA combina lotes de productos distintos
 * en un mismo análisis (sección 2 de la especificación — 30L de Tepache
 * y 30L de Kombucha no son observaciones equivalentes). Si se pide sin
 * filtro de producto, segmenta automáticamente y regresa un análisis
 * independiente por producto en vez de uno solo mezclado.
 */
class VolumeAnalysisService {

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

        const hasProductFilter =
            filters.productId !== null && filters.productId !== undefined;

        if (hasProductFilter) {

            return await this.buildProductAnalysis(candidateBatches, filters.productId);

        }

        // Sin filtro de producto: segmentar automáticamente — nunca
        // mezclar productos distintos en el mismo análisis de volumen.
        const batchesByProduct =
            new Map();

        for (const batch of candidateBatches) {

            const product =
                batch.recipeVersion &&
                batch.recipeVersion.recipe &&
                batch.recipeVersion.recipe.product;

            if (!product) {

                continue;

            }

            if (!batchesByProduct.has(product.id)) {

                batchesByProduct.set(product.id, []);

            }

            batchesByProduct.get(product.id).push(batch);

        }

        const products = [];

        for (const [productId, productBatches] of batchesByProduct.entries()) {

            products.push(await this.buildProductAnalysis(productBatches, productId));

        }

        products.sort(

            (a, b) =>
                (a.productName || "").localeCompare(b.productName || "")

        );

        return {

            segmentedByProduct: true,

            products

        };

    }

    async buildProductAnalysis(batches, productId) {

        const productName =
            batches.length > 0
                ? (

                    batches[0].recipeVersion &&
                    batches[0].recipeVersion.recipe &&
                    batches[0].recipeVersion.recipe.product &&
                    batches[0].recipeVersion.recipe.product.name

                ) ?? null
                : null;

        const rows = [];

        let batchesWithoutVolume = 0;

        for (const batch of batches) {

            const plannedVolume =
                toNumberOrNull(batch.plannedVolume);

            if (plannedVolume === null) {

                batchesWithoutVolume++;

                continue;

            }

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

            rows.push({

                batchId: batch.id,

                batchNumber: batch.batchNumber,

                // plannedVolume es la referencia principal de agrupación
                // (regla de esta entrega). targetVolume y producedVolume
                // se conservan como datos independientes, nunca se usan
                // para clasificar el lote en un grupo.
                plannedVolume,

                targetVolume: toNumberOrNull(batch.targetVolume),

                producedVolume: toNumberOrNull(batch.producedVolume),

                fermentationRate: rateResult ? rateResult.rateAbsolutePerHour : null,

                durationHours: rateResult ? rateResult.durationHours : null,

                linearErrorHours,

                exponentialErrorHours,

                averageProductTemperature: tempStats.product.average,

                averageAmbientTemperature: tempStats.ambient.average

            });

        }

        const volumes =
            groupByVolume(rows);

        const correlation =
            computeVolumeCorrelations(rows);

        return {

            productId: productId ?? null,

            productName,

            sampleSize: rows.length,

            batchesWithoutVolume,

            volumes,

            correlation,

            note: "Este análisis es exploratorio: una diferencia de velocidad o error entre volúmenes no implica que el volumen sea la causa. Revisa también la temperatura promedio de cada grupo — podría estar relacionada con diferencias de masa térmica entre volúmenes distintos."

        };

    }

}

module.exports =
    VolumeAnalysisService;
