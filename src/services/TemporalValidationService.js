const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const {
    sortByChronologicalKey,
    buildTemporalValidation
} = require("../utils/TemporalValidation");

const {
    isMaturationCandidateBatch,
    batchMatchesProductFilter
} = require("./support/batchCandidates");

const { buildEvaluableBatchSet } =
    require("./support/evaluableBatches");

/*
 * Orquesta la Entrega 2.6.1.8: validación cruzada temporal de los
 * modelos lineal y exponencial — construidos únicamente con los lotes
 * más antiguos ("entrenamiento") y puestos a prueba contra los lotes
 * más recientes ("validación"), para detectar sobreajuste antes de
 * confiar en un modelo para producción.
 *
 * Reutiliza exactamente el mismo criterio de lotes evaluables e
 * intersectados que ModelComparisonService (2.6.1.7): un lote solo
 * entra al conjunto si evaluateHistorical() pudo evaluar AMBOS modelos
 * en él — así entrenamiento y validación se calculan sobre "los mismos
 * modelos de la entrega anterior" (sección 3 de la especificación), no
 * sobre un criterio distinto. También agrupa SIEMPRE por
 * recipeVersionId, por la misma razón que 2.6.1.7: nunca mezclar
 * automáticamente productos/recetas/versiones distintas.
 *
 * La única pieza nueva de esta entrega es el orden cronológico real (por
 * fecha de inicio de cada lote) y la partición 80/20 entrenamiento/
 * validación — delegada íntegramente a utils/TemporalValidation.js, que
 * no sabe nada de Sequelize.
 *
 * NO cambia el modelo que FermentaLab usa para predicciones nuevas
 * (sección 10 de la especificación): es exclusivamente analítico.
 */
class TemporalValidationService {

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
            // forma plana del ejemplo de la especificación (sección 7),
            // no una lista de un elemento (convención ya usada en
            // ModelComparisonService, 2.6.1.7).
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

        // Misma intersección que ModelComparisonService (2.6.1.7): un
        // lote solo participa si AMBOS modelos pudieron evaluarse en él
        // (ver src/services/support/evaluableBatches.js, extraído en
        // 2.6.1.10 a partir de esta misma lógica).
        const { evaluableBatches } =
            await buildEvaluableBatchSet(batches, this.measurementRepository);

        const sortedEvaluableBatches =
            sortByChronologicalKey(evaluableBatches, item => item.chronoKey);

        const validation =
            buildTemporalValidation(sortedEvaluableBatches);

        return {

            scope,

            ...validation,

            note: "Esta validación es histórica y retrospectiva: no cambia automáticamente el modelo que FermentaLab usa para calcular predicciones nuevas."

        };

    }

}

module.exports =
    TemporalValidationService;
