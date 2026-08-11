/*
 * Filtro compartido de "lotes candidatos" para los análisis de
 * maduración (Entregas 2.6.1.3 y 2.6.1.4 en adelante). Extraído de
 * MaturationStatisticsService en la 2.6.1.4 para no duplicar el mismo
 * criterio en TemperatureAnalysisService — es puramente un refactor, no
 * cambia ningún comportamiento (ver verificación de no-regresión de la
 * 2.6.1.4).
 *
 * Un lote es "candidato" cuando, en principio, tiene todo lo necesario
 * para intentar un backtest de F1: no está cancelado y su versión de
 * receta tiene configurado un objetivo de maduración (métrica + target).
 * Esto NO decide si el backtest en sí resultó evaluable — eso lo decide
 * MaturationCalculator.evaluateHistorical() lote por lote.
 *
 * batchMatchesProductFilter() se extendió en la 2.6.1.6 para aceptar
 * también recipeId/recipeVersionId opcionales (la arquitectura ya lo
 * permite: ProductionBatch tiene recipeVersionId, RecipeVersion tiene
 * recipeId). El nombre de la función se conserva sin cambios para no
 * tener que actualizar los imports de MaturationStatisticsService/
 * TemperatureAnalysisService/VolumeAnalysisService — esos servicios
 * nunca pasan recipeId/recipeVersionId, así que su comportamiento no
 * cambia (reverificado con los mismos harnesses usados en cada entrega).
 */

const toNumberOrNull = value =>

    value === null || value === undefined || value === ""
        ? null
        : Number(value);

function isMaturationCandidateBatch(batch) {

    if (!batch) {

        return false;

    }

    if (batch.status === "CANCELLED") {

        return false;

    }

    const recipeVersion =
        batch.recipeVersion;

    if (!recipeVersion || !recipeVersion.maturationMetric) {

        return false;

    }

    if (toNumberOrNull(recipeVersion.maturationTarget) === null) {

        return false;

    }

    return true;

}

function batchMatchesProductFilter(batch, filters = {}) {

    if (filters.productId !== null && filters.productId !== undefined) {

        const productId =
            batch.recipeVersion &&
            batch.recipeVersion.recipe &&
            batch.recipeVersion.recipe.product &&
            batch.recipeVersion.recipe.product.id;

        if (Number(productId) !== Number(filters.productId)) {

            return false;

        }

    }

    if (filters.recipeId !== null && filters.recipeId !== undefined) {

        const recipeId =
            batch.recipeVersion && batch.recipeVersion.recipeId;

        if (Number(recipeId) !== Number(filters.recipeId)) {

            return false;

        }

    }

    if (filters.recipeVersionId !== null && filters.recipeVersionId !== undefined) {

        const recipeVersionId =
            batch.recipeVersionId ?? (batch.recipeVersion && batch.recipeVersion.id);

        if (Number(recipeVersionId) !== Number(filters.recipeVersionId)) {

            return false;

        }

    }

    return true;

}

module.exports = {

    toNumberOrNull,

    isMaturationCandidateBatch,

    batchMatchesProductFilter

};
