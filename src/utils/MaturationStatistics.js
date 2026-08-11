/*
 * Estadística histórica de precisión (Entrega 2.6.1.3).
 *
 * Módulo puro (sin Sequelize/Express) que agrega los errores absolutos ya
 * calculados por MaturationCalculator.evaluateHistorical() para muchos
 * lotes, en dos pasos independientes:
 *
 *   1. aggregateErrors(errors) — reduce un arreglo de "absoluteErrorHours"
 *      (de UN modelo, ya sea lineal o exponencial) a MAE/RMSE/mínimo/
 *      máximo/porcentaje dentro de márgenes.
 *
 *   2. compareHistoricalAccuracy(linearAgg, exponentialAgg) — compara los
 *      resultados agregados de ambos modelos y decide si hay evidencia
 *      suficiente (mínimo de lotes) para recomendar uno de los dos.
 *
 * Quién decide qué lotes/errores entran a cada agregado (exclusión de
 * lotes cancelados, sin configuración, sin target alcanzado, etc.) es
 * responsabilidad del servicio que orquesta esto (MaturationStatisticsService),
 * no de este módulo — aquí solo se agregan números ya filtrados.
 */

const DEFAULT_ERROR_MARGINS_HOURS = [2, 6];

const MIN_EVALUATED_BATCHES_FOR_COMPARISON = 5;

// Umbrales de mejora relativa de MAE para graduar la confianza de la
// recomendación histórica — mismos umbrales conceptuales que compareModels()
// en MaturationCalculator (2.6.1.1), para mantener consistencia de criterio
// entre "evitar falsa precisión" a nivel de un lote y a nivel histórico.
const HIGH_SIGNIFICANT_MAE_IMPROVEMENT = 0.50;

const MIN_SIGNIFICANT_MAE_IMPROVEMENT = 0.20;

function round(value, decimals = 2) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor = Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

/*
 * Reduce un arreglo de errores absolutos (en horas) de UN modelo a las
 * métricas agregadas de la Entrega 2.6.1.3. Con 0 errores regresa un
 * agregado "vacío" (todo en null salvo count=0) — nunca inventa un
 * promedio de una lista vacía.
 */
function aggregateErrors(errors, marginsHours = DEFAULT_ERROR_MARGINS_HOURS) {

    const values =
        (errors || []).filter(
            v => typeof v === "number" && Number.isFinite(v)
        );

    const count =
        values.length;

    if (count === 0) {

        const emptyWithin = {};

        for (const margin of marginsHours) {

            emptyWithin[`within${margin}Hours`] = null;

        }

        return {

            count: 0,

            maeHours: null,

            rmseHours: null,

            minErrorHours: null,

            maxErrorHours: null,

            ...emptyWithin

        };

    }

    const sumAbs =
        values.reduce((acc, v) => acc + v, 0);

    const sumSquares =
        values.reduce((acc, v) => acc + v * v, 0);

    const mae =
        sumAbs / count;

    const rmse =
        Math.sqrt(sumSquares / count);

    const within = {};

    for (const margin of marginsHours) {

        const withinCount =
            values.filter(v => v <= margin).length;

        within[`within${margin}Hours`] =
            round((withinCount / count) * 100, 1);

    }

    return {

        count,

        maeHours: round(mae, 2),

        rmseHours: round(rmse, 2),

        minErrorHours: round(Math.min(...values), 2),

        maxErrorHours: round(Math.max(...values), 2),

        ...within

    };

}

/*
 * Compara los agregados de ambos modelos y decide si hay evidencia
 * suficiente para recomendar uno. Regla dura (Entrega 2.6.1.3, sección 3):
 * con menos de MIN_EVALUATED_BATCHES_FOR_COMPARISON lotes evaluables en
 * CUALQUIERA de los dos modelos, no se declara ganador — "Datos
 * insuficientes para comparar modelos."
 */
function compareHistoricalAccuracy(linearAgg, exponentialAgg, options = {}) {

    const minBatches =
        options.minBatches ?? MIN_EVALUATED_BATCHES_FOR_COMPARISON;

    const linearCount =
        linearAgg ? linearAgg.count : 0;

    const exponentialCount =
        exponentialAgg ? exponentialAgg.count : 0;

    if (linearCount < minBatches || exponentialCount < minBatches) {

        return {

            recommendedModel: null,

            confidence: "INSUFFICIENT",

            maeDifferenceHours: null,

            message: "Datos insuficientes para comparar modelos."

        };

    }

    const linearMae =
        linearAgg.maeHours;

    const exponentialMae =
        exponentialAgg.maeHours;

    if (linearMae === null || exponentialMae === null) {

        return {

            recommendedModel: null,

            confidence: "INSUFFICIENT",

            maeDifferenceHours: null,

            message: "Datos insuficientes para comparar modelos."

        };

    }

    const maeDifferenceHours =
        round(Math.abs(linearMae - exponentialMae), 2);

    const EPSILON = 1e-9;

    if (Math.abs(linearMae - exponentialMae) < EPSILON) {

        return {

            recommendedModel: null,

            confidence: "LOW",

            maeDifferenceHours: 0,

            message: "Ambos modelos presentan un desempeño histórico prácticamente idéntico."

        };

    }

    const recommendedModel =
        linearMae < exponentialMae ? "LINEAR" : "EXPONENTIAL";

    const worseMae =
        Math.max(linearMae, exponentialMae);

    const betterMae =
        Math.min(linearMae, exponentialMae);

    const relativeImprovement =
        (worseMae - betterMae) / worseMae;

    let confidence;

    if (relativeImprovement >= HIGH_SIGNIFICANT_MAE_IMPROVEMENT) {

        confidence = "HIGH";

    } else if (relativeImprovement >= MIN_SIGNIFICANT_MAE_IMPROVEMENT) {

        confidence = "MEDIUM";

    } else {

        confidence = "LOW";

    }

    return {

        recommendedModel,

        confidence,

        maeDifferenceHours,

        message: null

    };

}

module.exports = {

    DEFAULT_ERROR_MARGINS_HOURS,

    MIN_EVALUATED_BATCHES_FOR_COMPARISON,

    aggregateErrors,

    compareHistoricalAccuracy

};
