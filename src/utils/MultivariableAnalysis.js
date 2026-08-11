/*
 * Análisis multivariable inicial de maduración (Entrega 2.6.1.6).
 *
 * Módulo puro (sin Sequelize/Express) que construye una matriz de
 * correlaciones entre volumen, temperatura (producto y ambiente),
 * velocidad de fermentación y error de predicción de cada modelo, y
 * clasifica ese error en bandas descriptivas. Es deliberadamente
 * descriptivo — NO ajusta ninguna regresión múltiple ni combina las
 * variables en un modelo (fuera de alcance de esta entrega, ver sección
 * 10 de la especificación).
 *
 * Reutiliza correlateWithLabel()/pearsonCorrelation() de Correlation.js
 * (extraído en 2.6.1.5) para cada celda de la matriz — no se reimplementa
 * el cálculo de correlación aquí. Mismo cuidado de lenguaje que los
 * módulos anteriores: correlación, nunca causalidad.
 */

const { correlateWithLabel } =
    require("./Correlation");

// La especificación pide explícitamente ser MÁS estrictos aquí que en
// las entregas anteriores (2.6.1.4/2.6.1.5 usan 4): "n=2 no tiene
// utilidad práctica". No hay un número "correcto" objetivo — este es un
// umbral provisional, exportado para poder ajustarlo cuando haya más
// lotes.
const MIN_MULTIVARIABLE_SAMPLE_SIZE = 6;

// Umbrales de clasificación del error de predicción (Entrega 2.6.1.6,
// sección 5). Centralizados aquí a propósito — la interfaz NUNCA debe
// hardcodear estos números, solo leerlos de esta configuración, para que
// se puedan ajustar más adelante sin tocar la vista. Son valores
// provisionales, no una conclusión sobre la calidad del modelo.
const DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS = {

    excellentMaxHours: 2,

    goodMaxHours: 6,

    moderateMaxHours: 12

    // > moderateMaxHours => "HIGH"

};

/*
 * Clasifica un error absoluto (en horas) en una de 4 bandas, usando los
 * umbrales dados (o los de DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS).
 * Regresa null para valores no numéricos — nunca clasifica un dato
 * faltante como si fuera "excelente" ni ninguna otra categoría.
 */
function classifyErrorHours(hours, thresholds = DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS) {

    if (typeof hours !== "number" || !Number.isFinite(hours)) {

        return null;

    }

    if (hours <= thresholds.excellentMaxHours) {

        return "EXCELLENT";

    }

    if (hours <= thresholds.goodMaxHours) {

        return "GOOD";

    }

    if (hours <= thresholds.moderateMaxHours) {

        return "MODERATE";

    }

    return "HIGH";

}

/*
 * Cuenta cuántos errores caen en cada banda. Los valores null/no
 * numéricos simplemente no se cuentan en ninguna categoría — no se les
 * asigna "excelente" por defecto ni se inventa un valor.
 */
function summarizeErrorClassification(errors, thresholds = DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS) {

    const summary = {

        excellent: 0,

        good: 0,

        moderate: 0,

        high: 0

    };

    let classifiedCount = 0;

    for (const hours of (errors || [])) {

        const classification =
            classifyErrorHours(hours, thresholds);

        if (classification === "EXCELLENT") {

            summary.excellent++;

            classifiedCount++;

        } else if (classification === "GOOD") {

            summary.good++;

            classifiedCount++;

        } else if (classification === "MODERATE") {

            summary.moderate++;

            classifiedCount++;

        } else if (classification === "HIGH") {

            summary.high++;

            classifiedCount++;

        }

    }

    return {

        ...summary,

        count: classifiedCount

    };

}

/*
 * Construye una matriz simétrica de correlaciones entre las variables
 * dadas. `variableDefs` es un arreglo de {key, label}; cada fila de
 * `rows` debe tener esas keys como propiedades numéricas (o null).
 *
 * La diagonal es siempre 1.00 (una variable consigo misma), con
 * sampleSize igual al número de lotes que sí tienen esa variable. Cada
 * celda fuera de la diagonal reutiliza correlateWithLabel(), que ya
 * aplica el mínimo de muestra y nunca presenta una correlación con
 * muestra insuficiente como si fuera una conclusión — en ese caso
 * `value` es null y `sufficientSample` es false.
 */
function buildCorrelationMatrix(rows, variableDefs, minSampleSize = MIN_MULTIVARIABLE_SAMPLE_SIZE) {

    const cleanRows =
        rows || [];

    const matrix = {};

    for (const a of variableDefs) {

        matrix[a.key] = {};

        for (const b of variableDefs) {

            if (a.key === b.key) {

                const validCount =
                    cleanRows.filter(
                        r => typeof r[a.key] === "number" && Number.isFinite(r[a.key])
                    ).length;

                matrix[a.key][b.key] = {

                    value: 1,

                    sampleSize: validCount,

                    sufficientSample: true,

                    label: null

                };

                continue;

            }

            const pairs =
                cleanRows.map(r => ({ x: r[a.key], y: r[b.key] }));

            const result =
                correlateWithLabel(pairs, a.label, b.label, minSampleSize);

            matrix[a.key][b.key] = {

                ...result,

                sufficientSample: result.sampleSize >= minSampleSize

            };

        }

    }

    return matrix;

}

/*
 * Extrae pares {x, y} de dos variables a partir de las filas por lote,
 * descartando filas donde cualquiera de las dos falte — útil para
 * alimentar un scatter plot directamente.
 */
function extractScatterPoints(rows, xKey, yKey) {

    return (rows || [])

        .filter(r =>

            typeof r[xKey] === "number" && Number.isFinite(r[xKey]) &&
            typeof r[yKey] === "number" && Number.isFinite(r[yKey])

        )

        .map(r => ({ x: r[xKey], y: r[yKey] }));

}

module.exports = {

    MIN_MULTIVARIABLE_SAMPLE_SIZE,

    DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS,

    classifyErrorHours,

    summarizeErrorClassification,

    buildCorrelationMatrix,

    extractScatterPoints

};
