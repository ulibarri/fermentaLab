const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const {
    summarizeModelErrors,
    determineBestModel
} = require("../utils/ModelComparison");

const {
    isMaturationCandidateBatch,
    batchMatchesProductFilter
} = require("./support/batchCandidates");

const { buildEvaluableBatchSet } =
    require("./support/evaluableBatches");

/*
 * Orquesta la Entrega 2.6.1.7: compara formalmente el modelo lineal
 * contra el exponencial — MAE, RMSE, error máximo y distribución por
 * percentiles — y determina cuál tuvo mejor desempeño histórico, o si
 * la diferencia es demasiado pequeña para declarar un ganador.
 *
 * Reutiliza evaluateHistorical() (2.6.1.2) para el error de cada lote —
 * no se reimplementa el backtest. NO cambia el modelo que FermentaLab
 * usa para predicciones nuevas (sección 10 de la especificación): esto
 * es exclusivamente informativo.
 *
 * Regla dura de agrupación: SIEMPRE se agrupa por versión de receta
 * (recipeVersionId), nunca por producto o receta directamente. Esto
 * garantiza automáticamente lo que pide la sección 3 ("no debemos
 * mezclar automáticamente todas las recetas de Tepache") sin necesitar
 * lógica de segmentación aparte — dos versiones de receta nunca
 * comparten un recipeVersionId, así que agrupar por esa clave ya evita
 * cualquier mezcla entre productos, recetas o versiones distintas.
 *
 * Regla dura de comparación justa (sección 6): ambos modelos se
 * calculan sobre la MISMA intersección de lotes — un lote solo entra a
 * la comparación si AMBOS modelos pudieron evaluarse en él. Los lotes
 * donde alguno de los dos no pudo evaluarse se excluyen de AMBOS
 * arreglos (no solo del que falló) y se registran explícitamente en
 * excludedBatches, con la razón de cada modelo — a diferencia de
 * MaturationStatisticsService (2.6.1.3), que cuenta cada modelo de
 * forma independiente porque ahí el objetivo era otro (estadística
 * global por modelo, no una comparación cabeza a cabeza).
 */
class ModelComparisonService {

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

        const batchesByRecipeVersion =
            new Map();

        for (const batch of candidateBatches) {

            const recipeVersionId =
                batch.recipeVersionId;

            if (!batchesByRecipeVersion.has(recipeVersionId)) {

                batchesByRecipeVersion.set(recipeVersionId, []);

            }

            batchesByRecipeVersion.get(recipeVersionId).push(batch);

        }

        const groups = [];

        for (const [recipeVersionId, batches] of batchesByRecipeVersion.entries()) {

            groups.push(await this.buildScopeAnalysis(batches, recipeVersionId));

        }

        groups.sort(

            (a, b) =>

                (a.scope.productName || "").localeCompare(b.scope.productName || "") ||
                (a.scope.recipeName || "").localeCompare(b.scope.recipeName || "") ||
                (a.scope.version ?? 0) - (b.scope.version ?? 0)

        );

        const requestedScope = {

            productId: filters.productId ?? null,

            recipeId: filters.recipeId ?? null,

            recipeVersionId: filters.recipeVersionId ?? null

        };

        if (groups.length === 0) {

            return {

                scope: requestedScope,

                groups: []

            };

        }

        if (groups.length === 1) {

            // Alcance ya completamente resuelto a una sola versión de
            // receta: regresamos la forma plana del ejemplo de la
            // especificación (sección 7), no una lista de un elemento.
            return groups[0];

        }

        return {

            scope: requestedScope,

            groups

        };

    }

    async buildScopeAnalysis(batches, recipeVersionId) {

        const firstBatch =
            batches[0];

        const recipeVersion =
            firstBatch.recipeVersion;

        const scope = {

            productId: recipeVersion?.recipe?.product?.id ?? null,

            productName: recipeVersion?.recipe?.product?.name ?? null,

            recipeId: recipeVersion?.recipeId ?? null,

            recipeName: recipeVersion?.recipe?.name ?? null,

            recipeVersionId: recipeVersionId ?? null,

            version: recipeVersion?.version ?? null

        };

        const { evaluableBatches, excludedBatches } =
            await buildEvaluableBatchSet(batches, this.measurementRepository);

        // Solo entran a la comparación los lotes donde AMBOS modelos
        // pudieron evaluarse — es la intersección construida por
        // buildEvaluableBatchSet() (2.6.1.10), no la unión independiente
        // de cada modelo.
        const linear =
            summarizeModelErrors(evaluableBatches.map(b => b.linearErrorHours));

        const exponential =
            summarizeModelErrors(evaluableBatches.map(b => b.exponentialErrorHours));

        const comparison =
            determineBestModel(linear, exponential);

        return {

            scope,

            // linear.count === exponential.count siempre, por
            // construcción (misma intersección de lotes).
            sampleSize: linear.count,

            batchesConsidered: batches.length,

            batchesExcluded: excludedBatches.length,

            excludedBatches,

            models: {

                linear,

                exponential

            },

            comparison,

            note: "Esta comparación es histórica y retrospectiva: no cambia automáticamente el modelo que FermentaLab usa para calcular predicciones nuevas."

        };

    }

}

module.exports =
    ModelComparisonService;
