const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const { summarizeModelErrors } =
    require("../utils/ModelComparison");

const { sortByChronologicalKey, buildTemporalValidation } =
    require("../utils/TemporalValidation");

const { summarizeWindowStability } =
    require("../utils/TemporalStability");

const { buildRecommendation } =
    require("../utils/ModelRecommendation");

const {
    isMaturationCandidateBatch,
    batchMatchesProductFilter
} = require("./support/batchCandidates");

const { buildEvaluableBatchSet } =
    require("./support/evaluableBatches");

/*
 * Orquesta la Entrega 2.6.1.10: consolida los tres niveles de
 * evaluación ya construidos —desempeño histórico (2.6.1.7), capacidad
 * de generalización (2.6.1.8) y estabilidad temporal por ventanas
 * (nueva en esta entrega, ver TemporalStability.js)— en una única
 * recomendación de modelo por producto → receta → versión de receta.
 *
 * Reutiliza el mismo criterio de lotes evaluables e intersectados
 * (buildEvaluableBatchSet, extraído en esta misma entrega a partir de
 * ModelComparisonService/TemporalValidationService) y la misma regla
 * dura de agrupación por recipeVersionId — nunca mezclar automáticamente
 * productos, recetas o versiones distintas.
 *
 * La decisión en sí (qué modelo, con qué confianza, por qué) vive en
 * utils/ModelRecommendation.js, un árbol de reglas transparente — este
 * servicio solo reúne la evidencia (histórico + validación +
 * estabilidad) y arma la respuesta de la API.
 *
 * NO cambia el modelo que FermentaLab usa para predicciones nuevas
 * (sección 10 de la especificación): la recomendación es únicamente
 * informativa.
 */
class ModelRecommendationService {

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

            // Alcance ya resuelto a una sola versión de receta: misma
            // forma plana del ejemplo de la especificación (sección 8),
            // no una lista de un elemento (convención ya usada en
            // ModelComparisonService/TemporalValidationService).
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

        const sortedEvaluableBatches =
            sortByChronologicalKey(evaluableBatches, item => item.chronoKey);

        // Nivel 1: desempeño histórico (2.6.1.7), sobre TODO el conjunto evaluable.
        const historicalLinear =
            summarizeModelErrors(sortedEvaluableBatches.map(b => b.linearErrorHours));

        const historicalExponential =
            summarizeModelErrors(sortedEvaluableBatches.map(b => b.exponentialErrorHours));

        // Nivel 2: capacidad de generalización (2.6.1.8), split 80/20.
        const validation =
            buildTemporalValidation(sortedEvaluableBatches);

        // Nivel 3: estabilidad temporal por ventanas (nueva en 2.6.1.10).
        const stability =
            summarizeWindowStability(sortedEvaluableBatches);

        const recommendation =
            buildRecommendation({

                historical: { linear: historicalLinear, exponential: historicalExponential },

                validation,

                stability

            });

        const validationEvidence =
            validation.insufficientData
                ? { linearMae: null, exponentialMae: null, linearRmse: null, exponentialRmse: null }
                : {

                    linearMae: validation.linear.validation.maeHours,

                    exponentialMae: validation.exponential.validation.maeHours,

                    linearRmse: validation.linear.validation.rmseHours,

                    exponentialRmse: validation.exponential.validation.rmseHours

                };

        return {

            scope,

            sampleSize: sortedEvaluableBatches.length,

            recommendation: {

                model: recommendation.model,

                confidence: recommendation.confidence,

                status: recommendation.status

            },

            evidence: {

                historical: {

                    linearMae: historicalLinear.maeHours,

                    exponentialMae: historicalExponential.maeHours,

                    linearRmse: historicalLinear.rmseHours,

                    exponentialRmse: historicalExponential.rmseHours

                },

                validation: validationEvidence,

                stability: {

                    windowCount: stability.windowCount,

                    linearWins: stability.linearWins,

                    exponentialWins: stability.exponentialWins,

                    linearMaeStdDev: stability.linearMaeStdDev,

                    exponentialMaeStdDev: stability.exponentialMaeStdDev

                }

            },

            reasons: recommendation.reasons,

            batchesConsidered: batches.length,

            batchesExcluded: excludedBatches.length,

            excludedBatches,

            note: "Esta recomendación es informativa: no modifica automáticamente el modelo que FermentaLab usa para calcular predicciones nuevas, ni recetas, versiones o lotes históricos."

        };

    }

}

module.exports =
    ModelRecommendationService;
