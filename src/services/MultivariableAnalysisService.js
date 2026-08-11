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
    MIN_MULTIVARIABLE_SAMPLE_SIZE,
    DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS,
    summarizeErrorClassification,
    buildCorrelationMatrix,
    extractScatterPoints
} = require("../utils/MultivariableAnalysis");

const {
    toNumberOrNull,
    isMaturationCandidateBatch,
    batchMatchesProductFilter
} = require("./support/batchCandidates");

// Las 6 variables de la Entrega 2.6.1.6 (sección 1 y el ejemplo de la
// sección 7) — deliberadamente las mismas 6, en el mismo orden, que el
// ejemplo de la especificación. durationHours se calcula por lote pero
// NO entra a esta matriz (el ejemplo de la especificación tampoco la
// incluye); queda disponible internamente para una futura entrega.
const VARIABLE_DEFS = [

    { key: "volume", label: "el volumen" },

    { key: "averageProductTemperature", label: "la temperatura del producto" },

    { key: "averageAmbientTemperature", label: "la temperatura ambiente" },

    { key: "fermentationRate", label: "la velocidad de fermentación" },

    { key: "linearError", label: "el error del modelo lineal" },

    { key: "exponentialError", label: "el error del modelo exponencial" }

];

/*
 * Orquesta la Entrega 2.6.1.6: en vez de ver volumen, temperatura y
 * error de forma independiente (2.6.1.4/2.6.1.5), construye una matriz
 * de correlaciones conjunta y clasifica el error de predicción en
 * bandas legibles. Sigue siendo descriptivo — no ajusta ninguna
 * regresión múltiple ni combina las variables en un modelo (fuera de
 * alcance, sección 10 de la especificación).
 *
 * Regla dura (igual que VolumeAnalysisService en 2.6.1.5, y aquí todavía
 * más importante): NUNCA combina lotes de productos distintos. Además
 * de la razón de 2.6.1.5 (30L de Tepache y 30L de Kombucha no son
 * observaciones equivalentes), aquí hay una razón más fuerte: la
 * "velocidad de fermentación" es Δmétrica/hora, y la métrica depende de
 * la receta (pH para uno, SG para otro) — mezclar ΔpH/h con ΔSG/h en la
 * misma matriz de correlación no tendría sentido numérico, ni siquiera
 * son la misma magnitud física. Por eso, sin productId/recipeId/
 * recipeVersionId, este servicio segmenta automáticamente por producto
 * en vez de devolver un solo análisis mezclado.
 */
class MultivariableAnalysisService {

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

        const hasProductScope =
            filters.productId !== null && filters.productId !== undefined ||
            filters.recipeId !== null && filters.recipeId !== undefined ||
            filters.recipeVersionId !== null && filters.recipeVersionId !== undefined;

        if (hasProductScope) {

            return await this.buildProductAnalysis(candidateBatches, filters);

        }

        // Sin ningún filtro que aísle el producto: segmentar
        // automáticamente — nunca mezclar productos distintos.
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

            products.push(

                await this.buildProductAnalysis(productBatches, { productId })

            );

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

    async buildProductAnalysis(batches, filters) {

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

        for (const batch of batches) {

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

            const linearError =
                evaluation.linear && evaluation.linear.status === "EVALUATED"
                    ? evaluation.linear.absoluteErrorHours
                    : null;

            const exponentialError =
                evaluation.exponential && evaluation.exponential.status === "EVALUATED"
                    ? evaluation.exponential.absoluteErrorHours
                    : null;

            rows.push({

                batchId: batch.id,

                batchNumber: batch.batchNumber,

                volume: toNumberOrNull(batch.plannedVolume),

                averageProductTemperature: tempStats.product.average,

                averageAmbientTemperature: tempStats.ambient.average,

                durationHours: rateResult ? rateResult.durationHours : null,

                fermentationRate: rateResult ? rateResult.rateAbsolutePerHour : null,

                linearError,

                exponentialError

            });

        }

        const correlations =
            buildCorrelationMatrix(rows, VARIABLE_DEFS);

        const modelErrors = {

            linear: summarizeErrorClassification(rows.map(r => r.linearError)),

            exponential: summarizeErrorClassification(rows.map(r => r.exponentialError))

        };

        const scatterData = {

            temperatureVsRate: extractScatterPoints(rows, "averageProductTemperature", "fermentationRate"),

            volumeVsRate: extractScatterPoints(rows, "volume", "fermentationRate")

        };

        return {

            productId: filters && filters.productId !== undefined ? (filters.productId ?? null) : null,

            productName,

            sampleSize: rows.length,

            minSampleSizeForCorrelation: MIN_MULTIVARIABLE_SAMPLE_SIZE,

            variables: VARIABLE_DEFS.map(v => v.key),

            correlations,

            errorClassificationThresholds: DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS,

            modelErrors,

            scatterData,

            note: "Este análisis es exploratorio: una correlación entre dos variables no implica que una sea la causa de la otra. Podría existir una relación indirecta (por ejemplo, el volumen podría influir en la temperatura interna del producto, y esa temperatura influir en la velocidad) que esta matriz no puede distinguir."

        };

    }

}

module.exports =
    MultivariableAnalysisService;
