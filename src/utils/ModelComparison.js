/*
 * Comparación formal de modelos de maduración (Entrega 2.6.1.7).
 *
 * Módulo puro (sin Sequelize/Express) que resume el error histórico de
 * cada modelo (lineal/exponencial) — MAE, RMSE, error máximo y
 * distribución por percentiles — y decide cuál tuvo mejor desempeño,
 * con una condición explícita para NO declarar un ganador cuando la
 * diferencia es demasiado pequeña para ser relevante ("SIMILAR").
 *
 * A diferencia de MaturationStatistics.js (2.6.1.3), que cuenta cada
 * modelo de forma independiente (un lote puede aportar al conteo de un
 * modelo sin aportar al del otro), esta entrega exige explícitamente
 * que ambos modelos se comparen sobre el MISMO conjunto de lotes
 * (sección 6 de la especificación: "no debemos comparar Lineal n=24,
 * Exponencial n=17..."). Por eso summarizeModelErrors() recibe
 * directamente los arreglos de error YA intersectados — es
 * responsabilidad de quien llama (el servicio) construir esa
 * intersección lote por lote, no de este módulo.
 *
 * Reutiliza aggregateErrors() de MaturationStatistics.js para MAE/RMSE/
 * error máximo — no se reimplementa ese cálculo aquí, solo se le agregan
 * los percentiles.
 */

const {
    aggregateErrors,
    MIN_EVALUATED_BATCHES_FOR_COMPARISON
} = require("./MaturationStatistics");

// Debajo de este porcentaje de diferencia relativa de MAE, no se declara
// un modelo ganador — se reporta "SIMILAR". Provisional, como todos los
// umbrales de "evitar falsa precisión" de este proyecto (ver también
// MIN_SIGNIFICANT_RMSE_IMPROVEMENT en MaturationCalculator y
// MIN_SIGNIFICANT_MAE_IMPROVEMENT en MaturationStatistics). Ejemplo de
// la especificación: 4.21h vs 4.25h (diferencia relativa ~0.9%) debe
// caer aquí.
const SIMILARITY_THRESHOLD_RELATIVE = 0.05;

// Por encima del umbral de similitud, la confianza del veredicto se
// gradúa igual que en compareHistoricalAccuracy() (2.6.1.3): una
// diferencia apenas por encima del umbral de similitud no amerita la
// misma confianza que una diferencia enorme.
const HIGH_SIGNIFICANT_MAE_IMPROVEMENT = 0.50;

const MEDIUM_SIGNIFICANT_MAE_IMPROVEMENT = 0.20;

function round(value, decimals = 2) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

/*
 * Percentil por interpolación lineal (método "linear"/R-7, el mismo que
 * usan Excel PERCENTILE.INC y numpy por defecto) sobre un arreglo YA
 * ordenado ascendentemente. Regresa null para un arreglo vacío — nunca
 * inventa un percentil de una muestra vacía.
 */
function computePercentile(sortedValues, percentile) {

    if (!Array.isArray(sortedValues) || sortedValues.length === 0) {

        return null;

    }

    if (sortedValues.length === 1) {

        return sortedValues[0];

    }

    const rank =
        (percentile / 100) * (sortedValues.length - 1);

    const lowerIndex =
        Math.floor(rank);

    const upperIndex =
        Math.ceil(rank);

    if (lowerIndex === upperIndex) {

        return sortedValues[lowerIndex];

    }

    const weight =
        rank - lowerIndex;

    return sortedValues[lowerIndex] + weight * (sortedValues[upperIndex] - sortedValues[lowerIndex]);

}

/*
 * Resume los errores absolutos (en horas) de UN modelo: MAE/RMSE/error
 * máximo (reutilizados de aggregateErrors) más la distribución P25/P50/
 * P75, para poder juzgar no solo el promedio sino la estabilidad del
 * modelo (sección 5 de la especificación).
 */
function summarizeModelErrors(errors) {

    const clean =
        (errors || []).filter(
            v => typeof v === "number" && Number.isFinite(v)
        );

    const base =
        aggregateErrors(clean);

    const sorted =
        [...clean].sort((a, b) => a - b);

    return {

        count: base.count,

        maeHours: base.maeHours,

        rmseHours: base.rmseHours,

        maxAbsoluteErrorHours: base.maxErrorHours,

        p25Hours: round(computePercentile(sorted, 25)),

        p50Hours: round(computePercentile(sorted, 50)),

        p75Hours: round(computePercentile(sorted, 75))

    };

}

/*
 * Decide el modelo con mejor desempeño histórico a partir de los
 * resúmenes de summarizeModelErrors() de cada modelo — asume que ambos
 * se calcularon sobre el mismo conjunto de lotes (mismo `count`).
 *
 * Reglas, en orden:
 *   1. Con menos lotes que minSampleSize, no se declara nada
 *      (confidence "INSUFFICIENT").
 *   2. Con una diferencia relativa de MAE menor a similarityThreshold,
 *      se declara "SIMILAR" — nunca un ganador artificial.
 *   3. En otro caso, gana el modelo con menor MAE, con una confianza
 *      graduada por qué tan grande es la diferencia relativa.
 */
function determineBestModel(linearSummary, exponentialSummary, options = {}) {

    const minSampleSize =
        options.minSampleSize ?? MIN_EVALUATED_BATCHES_FOR_COMPARISON;

    const similarityThreshold =
        options.similarityThreshold ?? SIMILARITY_THRESHOLD_RELATIVE;

    const sampleSize =
        linearSummary ? linearSummary.count : 0;

    if (sampleSize < minSampleSize) {

        return {

            bestModel: null,

            confidence: "INSUFFICIENT",

            maeDifferenceHours: null,

            message: `Lotes evaluados insuficientes (mínimo ${minSampleSize}) para comparar modelos con confianza.`

        };

    }

    const linearMae =
        linearSummary.maeHours;

    const exponentialMae =
        exponentialSummary.maeHours;

    if (linearMae === null || exponentialMae === null) {

        return {

            bestModel: null,

            confidence: "INSUFFICIENT",

            maeDifferenceHours: null,

            message: "Datos insuficientes para comparar modelos."

        };

    }

    const maeDifferenceHours =
        round(Math.abs(linearMae - exponentialMae));

    const worseMae =
        Math.max(linearMae, exponentialMae);

    const relativeDiff =
        worseMae === 0 ? 0 : Math.abs(linearMae - exponentialMae) / worseMae;

    if (relativeDiff < similarityThreshold) {

        return {

            bestModel: "SIMILAR",

            confidence: "LOW",

            maeDifferenceHours,

            message: "No existe una diferencia relevante entre los modelos."

        };

    }

    const bestModel =
        linearMae < exponentialMae ? "LINEAR" : "EXPONENTIAL";

    const betterMae =
        Math.min(linearMae, exponentialMae);

    const relativeImprovement =
        (worseMae - betterMae) / worseMae;

    let confidence;

    if (relativeImprovement >= HIGH_SIGNIFICANT_MAE_IMPROVEMENT) {

        confidence = "HIGH";

    } else if (relativeImprovement >= MEDIUM_SIGNIFICANT_MAE_IMPROVEMENT) {

        confidence = "MEDIUM";

    } else {

        confidence = "LOW";

    }

    return {

        bestModel,

        confidence,

        maeDifferenceHours,

        message: null

    };

}

module.exports = {

    SIMILARITY_THRESHOLD_RELATIVE,

    MIN_EVALUATED_BATCHES_FOR_COMPARISON,

    computePercentile,

    summarizeModelErrors,

    determineBestModel

};
