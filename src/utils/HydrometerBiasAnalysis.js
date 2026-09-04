/*
 * Entrega 2.8.0.5 -- "Análisis histórico del error y detección de
 * sesgo del hidrómetro".
 *
 * Módulo puro (sin dependencias de Sequelize/Express) que convierte
 * las comparaciones INDIVIDUALES de la Entrega 2.8.0.4
 * (`HydrometerAudit.computeComparison()`, cada una con su
 * `deltaBrix`/`absoluteError`) en un análisis histórico agregado:
 * sesgo promedio, mediana, MAE, desviación estándar, distribución de
 * signos, agrupación por rango de Brix/fase/tabla, evolución temporal
 * y una clasificación 🟢/🟡/🔴/⚪ del sesgo detectado.
 *
 * Sección 2 -- esta entrega SOLO detecta el sesgo, nunca lo corrige:
 * este módulo no produce ningún offset aplicable, no sugiere una
 * "tabla mejor", y no escribe nada. Recibe SIEMPRE la lista de
 * comparaciones ya calculada por `HydrometerAudit.js` (2.8.0.4) --
 * nunca recalcula un Brix derivado ni vuelve a tocar `ProductionMeasurement`.
 */

// Sección 12 -- "El mínimo deberá ser configurable" (documentado como
// `hydrometerAudit.minimumSampleSize`, todavía sin un mecanismo de
// configuración en BD/UI en este proyecto -- mismo criterio que los
// límites de 2.8.0.4/`DegradationDetection.DEFAULT_DEGRADATION_THRESHOLD_PERCENTAGE`).
// Se reutiliza el mismo valor (5) que casi todos los "avoid false
// precision" gates de este proyecto (MIN_EVALUATED_BATCHES_FOR_COMPARISON,
// MIN_SAMPLE_SIZE de ModelCalibrationAnalysis, etc.).
const DEFAULT_MINIMUM_SAMPLE_SIZE = 5;

// Sección 13 -- umbrales para distinguir 🟢/🟡/🔴, documentados
// explícitamente como PARÁMETROS TEMPORALES de backend (mismo
// criterio que 2.8.0.4). `NEGLIGIBLE_BIAS_ABS`: por debajo de este
// valor, el sesgo promedio es numéricamente insignificante sin
// importar qué tan consistente sea su dirección.
// `MODERATE_DIRECTION_CONSISTENCY`/`HIGH_DIRECTION_CONSISTENCY`: la
// fracción de comparaciones que comparten la dirección dominante
// (sobreestimación o subestimación) -- esto es lo que distingue el
// "Caso A" del "Caso B" de la sección 5 del spec: un Bias promedio
// parecido puede venir de errores consistentes (todos +0.20) o de
// errores muy dispersos que casualmente promedian parecido
// (+1.00/-0.80/+0.70/-0.10) -- solo el primero debe poder llegar a
// 🔴/🟡.
const DEFAULT_NEGLIGIBLE_BIAS_ABS = 0.05;
const DEFAULT_MODERATE_DIRECTION_CONSISTENCY = 0.55;
const DEFAULT_HIGH_DIRECTION_CONSISTENCY = 0.70;

// Sección 6 -- rangos de Brix, "deben quedar definidos como
// configuración, no como lógica rígida del frontend". Viven aquí como
// default de backend (parámetro de `groupByRange()`, nunca hardcodeado
// en el JS de la vista).
const DEFAULT_BRIX_RANGES = [

    { label: "0-4", min: 0, max: 4 },

    { label: "4-6", min: 4, max: 6 },

    { label: "6-8", min: 6, max: 8 },

    { label: "8-10", min: 8, max: 10 },

    { label: "10+", min: 10, max: Infinity }

];

const BIAS_STATUS = {

    INSUFFICIENT: "INSUFFICIENT",

    NO_EVIDENT_BIAS: "NO_EVIDENT_BIAS",

    POSSIBLE_BIAS: "POSSIBLE_BIAS",

    CONSISTENT_BIAS: "CONSISTENT_BIAS"

};

function round(value, decimals = 2) {

    if (value === null || value === undefined || !Number.isFinite(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

function average(values) {

    if (!values || values.length === 0) {

        return null;

    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;

}

/*
 * Sección 4.3 -- mediana, calculada sobre el ERROR con signo (no sobre
 * el error absoluto), para poder ver si el "centro" del conjunto está
 * desplazado, no solo su magnitud. "Evitará que algunos valores
 * extremos dominen la interpretación" -- de ahí que se calcule además
 * del promedio, nunca en su reemplazo.
 */
function median(values) {

    if (!values || values.length === 0) {

        return null;

    }

    const sorted =
        [...values].sort((a, b) => a - b);

    const mid =
        Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {

        return (sorted[mid - 1] + sorted[mid]) / 2;

    }

    return sorted[mid];

}

/*
 * Sección 4.7 -- desviación estándar POBLACIONAL (÷n, no n-1): estamos
 * describiendo la dispersión del conjunto de comparaciones REALMENTE
 * observado, no estimando un parámetro de una población más amplia --
 * mismo criterio ya usado por `TemporalStability.js` (2.6.1.10) para
 * la misma distinción.
 */
function standardDeviation(values) {

    if (!values || values.length === 0) {

        return null;

    }

    const mean =
        average(values);

    const variance =
        average(values.map(value => Math.pow(value - mean, 2)));

    return Math.sqrt(variance);

}

/*
 * Sección 5 -- distribución de signos. "Coincidente" es
 * deliberadamente `error === 0` EXACTO (ya redondeado a 2 decimales
 * por `HydrometerAudit.computeComparison()`), no una tolerancia
 * arbitraria -- una tolerancia de "casi cero" duplicaría el concepto
 * ya cubierto por `NEGLIGIBLE_BIAS_ABS` (que opera sobre el PROMEDIO,
 * no sobre cada comparación individual) y complicaría innecesariamente
 * la interpretación de "cuántas veces coincidió exactamente".
 */
function computeDistribution(errors) {

    let positiveErrors = 0;

    let zeroErrors = 0;

    let negativeErrors = 0;

    errors.forEach(error => {

        if (error > 0) {

            positiveErrors++;

        } else if (error < 0) {

            negativeErrors++;

        } else {

            zeroErrors++;

        }

    });

    return { positiveErrors, zeroErrors, negativeErrors };

}

/*
 * Sección 6 -- agrupa por rango de Brix. Judgment call: el rango se
 * determina por el valor REAL (BrixMate), no por el Brix derivado --
 * la pregunta que responde esta sección es "¿en qué zona de la escala
 * real el hidrómetro es más/menos preciso?", así que el eje debe ser
 * la referencia (BrixMate), no la propia estimación que se está
 * evaluando. Intervalos [min, max) salvo el último ("10+"), que
 * incluye el límite superior.
 */
function resolveRange(brixValue, ranges) {

    return ranges.find(range =>

        range.max === Infinity
            ? brixValue >= range.min
            : brixValue >= range.min && brixValue < range.max

    ) || null;

}

function groupByRange(entries, ranges = DEFAULT_BRIX_RANGES) {

    return ranges.map(range => {

        const inRange =
            entries.filter(entry => {

                const resolved =
                    resolveRange(entry.brixReal, ranges);

                return resolved === range;

            });

        const errors =
            inRange.map(entry => entry.error);

        return {

            range: range.label,

            count: inRange.length,

            bias: inRange.length > 0 ? round(average(errors)) : null,

            mae: inRange.length > 0 ? round(average(errors.map(e => Math.abs(e)))) : null

        };

    });

}

/*
 * Sección 7 -- agrupa por fase. F2 nunca aparece aquí porque
 * `HydrometerAudit.evaluateComparability()` (2.8.0.4) ya la excluye
 * río arriba (INCOMPATIBLE_PHASE) -- este módulo ni siquiera necesita
 * volver a filtrarla.
 */
function groupByPhase(entries) {

    const phases =
        [...new Set(entries.map(entry => entry.phase))].sort();

    return phases.map(phase => {

        const inPhase =
            entries.filter(entry => entry.phase === phase);

        const errors =
            inPhase.map(entry => entry.error);

        return {

            phase,

            count: inPhase.length,

            bias: round(average(errors)),

            mae: round(average(errors.map(e => Math.abs(e))))

        };

    });

}

/*
 * Sección 9 -- agrupa por (tabla, versión). Aprovecha la trazabilidad
 * de 2.8.0.2/2.8.0.4: cada comparación ya trae `tableId`/`tableVersion`/
 * `tableName` resueltos contra la fila INMUTABLE de esa versión
 * específica, así que agrupar aquí nunca mezcla dos versiones distintas
 * bajo la misma llave, aunque compartan `tableId`... en realidad cada
 * versión SÍ tiene su propio `tableId` (fila propia, 2.8.0.2), así que
 * agrupar solo por `tableId` ya es suficiente -- se incluye `tableVersion`
 * en la llave de todos modos por claridad explícita en la salida.
 */
function groupByTable(entries) {

    const keys =
        [...new Set(entries

            .filter(entry => entry.tableId !== null && entry.tableId !== undefined)

            .map(entry => entry.tableId)

        )];

    return keys.map(tableId => {

        const inTable =
            entries.filter(entry => entry.tableId === tableId);

        const errors =
            inTable.map(entry => entry.error);

        const sample =
            inTable[0];

        return {

            tableId,

            tableVersion: sample.tableVersion,

            tableName: sample.tableName,

            count: inTable.length,

            bias: round(average(errors)),

            mae: round(average(errors.map(e => Math.abs(e))))

        };

    });

}

/*
 * Sección 8 -- evolución temporal. Se limita a exponer, en orden
 * cronológico, lo estrictamente necesario para graficar (fecha + error
 * con signo) más la trazabilidad de tabla/versión, para que la UI
 * pueda -- si quiere -- marcar visualmente un cambio de versión sobre
 * la misma línea de tiempo (sección 8: "cambios asociados a nuevas
 * versiones de la tabla"). Nunca interpreta la tendencia por sí
 * mismo -- sección 8: "No se debe interpretar todavía como
 * degradación del instrumento."
 */
function buildTimeline(entries) {

    return [...entries]

        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        .map(entry => ({

            measurementId: entry.measurementId,

            date: entry.date,

            error: entry.error,

            tableId: entry.tableId,

            tableVersion: entry.tableVersion

        }));

}

/*
 * Sección 13 -- clasificación 🟢/🟡/🔴/⚪. Ver el comentario de las
 * constantes de arriba para el razonamiento del Caso A/Caso B.
 */
function classifyBiasStatus({

    sampleCount,

    bias,

    positiveErrors,

    negativeErrors,

    minimumSampleSize = DEFAULT_MINIMUM_SAMPLE_SIZE,

    negligibleBiasAbs = DEFAULT_NEGLIGIBLE_BIAS_ABS,

    moderateDirectionConsistency = DEFAULT_MODERATE_DIRECTION_CONSISTENCY,

    highDirectionConsistency = DEFAULT_HIGH_DIRECTION_CONSISTENCY

}) {

    // Sección 12 -- "evitar que una conclusión de sesgo aparezca con 2
    // o 3 observaciones."
    if (sampleCount < minimumSampleSize) {

        return BIAS_STATUS.INSUFFICIENT;

    }

    if (bias === null || Math.abs(bias) < negligibleBiasAbs) {

        return BIAS_STATUS.NO_EVIDENT_BIAS;

    }

    const directionConsistency =
        sampleCount > 0 ? Math.max(positiveErrors, negativeErrors) / sampleCount : 0;

    if (directionConsistency >= highDirectionConsistency) {

        return BIAS_STATUS.CONSISTENT_BIAS;

    }

    if (directionConsistency >= moderateDirectionConsistency) {

        return BIAS_STATUS.POSSIBLE_BIAS;

    }

    // Sección 5, "Caso B" -- el promedio no es despreciable, pero los
    // errores no comparten una dirección dominante (mucha
    // variabilidad): no se reporta como sesgo, precisamente la
    // distinción que esta sección exige.
    return BIAS_STATUS.NO_EVIDENT_BIAS;

}

/*
 * `entries` es la lista de comparaciones YA COMPARABLES (nunca incluye
 * las descartadas por `HydrometerAudit.evaluateComparability()`), cada
 * una con la forma:
 *   { measurementId, date, phase, error (=deltaBrix, con signo),
 *     brixReal, tableId, tableVersion, tableName }
 *
 * `options.ranges` permite sobreescribir los rangos de Brix (sección
 * 6); `options.minimumSampleSize`/demás thresholds permiten
 * sobreescribir la clasificación (sección 12/13) sin tocar los
 * defaults de este módulo.
 */
function buildSummary(entries, options = {}) {

    const sampleCount =
        entries.length;

    const errors =
        entries.map(entry => entry.error);

    const bias =
        round(average(errors));

    const medianError =
        round(median(errors));

    const mae =
        round(average(errors.map(e => Math.abs(e))));

    const stdDev =
        round(standardDeviation(errors));

    const distribution =
        computeDistribution(errors);

    const maxPositiveError =
        errors.filter(e => e > 0).length > 0 ? round(Math.max(...errors.filter(e => e > 0))) : null;

    const maxNegativeError =
        errors.filter(e => e < 0).length > 0 ? round(Math.min(...errors.filter(e => e < 0))) : null;

    const status =
        classifyBiasStatus({

            sampleCount,

            bias,

            positiveErrors: distribution.positiveErrors,

            negativeErrors: distribution.negativeErrors,

            minimumSampleSize: options.minimumSampleSize,

            negligibleBiasAbs: options.negligibleBiasAbs,

            moderateDirectionConsistency: options.moderateDirectionConsistency,

            highDirectionConsistency: options.highDirectionConsistency

        });

    return {

        sampleCount,

        bias,

        medianError,

        mae,

        standardDeviation: stdDev,

        maxPositiveError,

        maxNegativeError,

        positiveErrors: distribution.positiveErrors,

        zeroErrors: distribution.zeroErrors,

        negativeErrors: distribution.negativeErrors,

        minimumSampleSize: options.minimumSampleSize ?? DEFAULT_MINIMUM_SAMPLE_SIZE,

        status,

        ranges: groupByRange(entries, options.ranges),

        byPhase: groupByPhase(entries),

        byTable: groupByTable(entries),

        timeline: buildTimeline(entries)

    };

}

module.exports = {

    DEFAULT_MINIMUM_SAMPLE_SIZE,

    DEFAULT_NEGLIGIBLE_BIAS_ABS,

    DEFAULT_MODERATE_DIRECTION_CONSISTENCY,

    DEFAULT_HIGH_DIRECTION_CONSISTENCY,

    DEFAULT_BRIX_RANGES,

    BIAS_STATUS,

    round,

    average,

    median,

    standardDeviation,

    computeDistribution,

    resolveRange,

    groupByRange,

    groupByPhase,

    groupByTable,

    buildTimeline,

    classifyBiasStatus,

    buildSummary

};
