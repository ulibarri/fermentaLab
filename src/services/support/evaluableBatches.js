/*
 * Conjunto de lotes "evaluables" para comparar el modelo lineal contra
 * el exponencial (extraído en la Entrega 2.6.1.10 a partir de la misma
 * lógica que ya vivía, duplicada, en ModelComparisonService (2.6.1.7) y
 * TemporalValidationService (2.6.1.8) — pura extracción, sin cambio de
 * comportamiento, re-verificada contra ambos servicios).
 *
 * Un lote es "evaluable" cuando MaturationCalculator.evaluateHistorical()
 * pudo evaluar AMBOS modelos en él (la intersección, no la unión
 * independiente de MaturationStatisticsService/2.6.1.3) — así entrega
 * tras entrega comparamos siempre el mismo conjunto de lotes para ambos
 * modelos. Los lotes donde solo uno de los dos pudo evaluarse se
 * excluyen de ambos arreglos y se registran en `excludedBatches` con la
 * razón de cada modelo, para auditoría.
 *
 * También expone `chronoKey()`: la clave cronológica de un lote
 * (`startedAt`, con `createdAt` como respaldo para lotes sin iniciar),
 * usada por TemporalValidationService (2.6.1.8), TemporalStability.js
 * (2.6.1.10) y ModelRecommendationService (2.6.1.10) para ordenar el
 * conjunto evaluable cronológicamente antes de dividirlo en
 * entrenamiento/validación o en ventanas.
 */

const MaturationCalculator =
    require("../../utils/MaturationCalculator");

const { toNumberOrNull } =
    require("./batchCandidates");

/*
 * Clave cronológica de un lote: `startedAt` (fecha real de inicio de
 * producción) cuando existe, `createdAt` (fecha de creación del
 * registro) como respaldo para lotes sin iniciar. null si ninguna es
 * una fecha válida — nunca se inventa un orden (quien ordene con esta
 * clave debe colocar los lotes sin clave al final, no tratarlos como
 * "los más antiguos").
 */
function chronoKey(batch) {

    const date =
        batch.startedAt || batch.createdAt;

    if (!date) {

        return null;

    }

    const time =
        new Date(date).getTime();

    return Number.isNaN(time) ? null : time;

}

/*
 * Dado un arreglo de lotes (ya filtrados por isMaturationCandidateBatch/
 * batchMatchesProductFilter y, típicamente, ya agrupados por
 * recipeVersionId por quien llama) y el repositorio de mediciones,
 * regresa { evaluableBatches, excludedBatches }:
 *
 *   - evaluableBatches: uno por lote evaluable, con
 *     { batchId, batchNumber, chronoKey, linearErrorHours,
 *       exponentialErrorHours } — SIN ordenar (quien llama decide el
 *     orden, ej. sortByChronologicalKey de TemporalValidation.js).
 *
 *   - excludedBatches: uno por lote NO evaluable en ambos modelos, con
 *     { batchId, batchNumber, linearStatus, linearReason,
 *       exponentialStatus, exponentialReason } para auditoría.
 */
async function buildEvaluableBatchSet(batches, measurementRepository) {

    const evaluableBatches = [];

    const excludedBatches = [];

    for (const batch of batches) {

        const measurements =
            await measurementRepository.findByBatch(batch.id);

        const metric =
            batch.recipeVersion.maturationMetric;

        const targetValue =
            toNumberOrNull(batch.recipeVersion.maturationTarget);

        const evaluation =
            MaturationCalculator.evaluateHistorical({

                measurements,

                metric,

                targetValue,

                phase: "F1"

            });

        const linearEvaluated =
            evaluation.linear && evaluation.linear.status === "EVALUATED";

        const exponentialEvaluated =
            evaluation.exponential && evaluation.exponential.status === "EVALUATED";

        if (linearEvaluated && exponentialEvaluated) {

            evaluableBatches.push({

                batchId: batch.id,

                batchNumber: batch.batchNumber,

                chronoKey: chronoKey(batch),

                linearErrorHours: evaluation.linear.absoluteErrorHours,

                exponentialErrorHours: evaluation.exponential.absoluteErrorHours

            });

        } else {

            excludedBatches.push({

                batchId: batch.id,

                batchNumber: batch.batchNumber,

                linearStatus: evaluation.linear ? evaluation.linear.status : "NOT_EVALUABLE",

                linearReason: evaluation.linear ? evaluation.linear.reason : null,

                exponentialStatus: evaluation.exponential ? evaluation.exponential.status : "NOT_EVALUABLE",

                exponentialReason: evaluation.exponential ? evaluation.exponential.reason : null

            });

        }

    }

    return { evaluableBatches, excludedBatches };

}

module.exports = {

    chronoKey,

    buildEvaluableBatchSet

};
