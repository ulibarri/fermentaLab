/*
 * Estabilidad temporal por ventanas (Entrega 2.6.1.10).
 *
 * NOTA IMPORTANTE: la especificación de 2.6.1.10 da por hecho que ya
 * existe una Entrega 2.6.1.9 ("estabilidad temporal", con victorias por
 * ventana y variabilidad del error) — esa entrega nunca se especificó
 * ni se construyó. El usuario confirmó explícitamente (2026-08-08) que
 * se diseñara aquí mismo, como parte de 2.6.1.10, documentando el
 * diseño como judgment call. Este módulo es ese diseño.
 *
 * Idea: en vez de una sola división 80/20 (2.6.1.8), dividimos el mismo
 * conjunto evaluable e intersectado (ver evaluableBatches.js) —ya
 * ordenado cronológicamente— en VARIAS ventanas consecutivas de tamaño
 * similar. Para cada ventana calculamos el MAE de cada modelo sobre
 * SOLO esa ventana, y contamos qué modelo "ganó" (menor MAE) en cada
 * una. Esto da dos señales que un solo split 80/20 no puede dar:
 *
 *   - ¿Un modelo gana consistentemente a través del tiempo, o solo en
 *     un tramo específico? (conteo de victorias por ventana)
 *   - ¿Qué tan estable es el error de cada modelo entre ventanas?
 *     (desviación estándar del MAE de cada modelo, entre ventanas)
 *
 * Un modelo con MAE histórico bajo pero que solo gana en 1 de 5
 * ventanas, o cuyo MAE varía mucho de una ventana a otra, es
 * exactamente el caso que ModelRecommendation.js (2.6.1.10) necesita
 * poder distinguir de un modelo consistentemente mejor.
 *
 * Módulo puro (sin Sequelize/Express). Reutiliza aggregateErrors() de
 * MaturationStatistics.js (2.6.1.3) para el MAE de cada ventana — no se
 * reimplementa ese cálculo aquí.
 */

const { aggregateErrors } =
    require("./MaturationStatistics");

// Número de ventanas "ideal" cuando hay suficientes lotes. Elegido para
// que el ejemplo de la especificación de 2.6.1.10 ("Victorias: Lineal 4,
// Exponencial 1", 5 victorias en total) sea directamente reproducible.
const DEFAULT_WINDOW_COUNT = 5;

// Con menos de 2 lotes por ventana, el "MAE de la ventana" sería
// literalmente el error de un solo lote — no una muestra. Mismo
// espíritu que MIN_VALIDATION_BATCHES en TemporalValidation.js
// (2.6.1.8): evitar reportar variabilidad calculada sobre ruido de un
// único punto.
const MIN_BATCHES_PER_WINDOW = 2;

// Con menos de 3 ventanas no tiene sentido hablar de "consistencia a
// través del tiempo" ni de una desviación estándar entre ventanas
// mínimamente informativa (2 puntos casi siempre "varían"). Por debajo
// de este número, la estabilidad se reporta como no disponible en vez
// de forzar una conclusión con evidencia demasiado escasa.
const MIN_WINDOWS_FOR_STABILITY = 3;

function round(value, decimals = 2) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

/*
 * Cuántas ventanas usar para `sampleSize` lotes evaluables: el menor
 * entre DEFAULT_WINDOW_COUNT y lo que permite MIN_BATCHES_PER_WINDOW.
 * Si el resultado queda por debajo de MIN_WINDOWS_FOR_STABILITY, regresa
 * 0 — señal de "no hay suficientes lotes para una estabilidad por
 * ventanas confiable" (la estabilidad completa queda como no
 * disponible, no se fuerza con menos ventanas de las razonables).
 */
function computeWindowCount(sampleSize, options = {}) {

    const targetWindowCount =
        options.windowCount ?? DEFAULT_WINDOW_COUNT;

    const minBatchesPerWindow =
        options.minBatchesPerWindow ?? MIN_BATCHES_PER_WINDOW;

    const minWindowsForStability =
        options.minWindowsForStability ?? MIN_WINDOWS_FOR_STABILITY;

    const maxPossibleWindows =
        Math.floor(sampleSize / minBatchesPerWindow);

    const windowCount =
        Math.min(targetWindowCount, maxPossibleWindows);

    return windowCount >= minWindowsForStability ? windowCount : 0;

}

/*
 * Divide `items` (YA ordenados cronológicamente) en `windowCount`
 * ventanas consecutivas de tamaño lo más parejo posible. Cuando
 * `items.length` no es múltiplo exacto de `windowCount`, las PRIMERAS
 * ventanas (las más antiguas) reciben un elemento extra — mismo
 * convenio que `numpy.array_split()` — en vez de las últimas, para que
 * el tamaño de ventana nunca decrezca cronológicamente de forma
 * sorpresiva al agregar más lotes en el futuro.
 */
function splitIntoWindows(items, windowCount) {

    const list =
        items || [];

    if (windowCount <= 0) {

        return [];

    }

    const baseSize =
        Math.floor(list.length / windowCount);

    const remainder =
        list.length % windowCount;

    const windows = [];

    let cursor = 0;

    for (let i = 0; i < windowCount; i++) {

        const size =
            baseSize + (i < remainder ? 1 : 0);

        windows.push(list.slice(cursor, cursor + size));

        cursor += size;

    }

    return windows;

}

/*
 * Desviación estándar POBLACIONAL (divide entre n, no n-1) de un
 * arreglo de números — con tan pocas ventanas (3-5 típicamente) se
 * describe la variabilidad observada de esas ventanas específicas, no
 * se estima un parámetro poblacional más amplio. null con menos de 2
 * valores (no hay variabilidad que describir).
 */
function standardDeviation(values) {

    const clean =
        (values || []).filter(v => typeof v === "number" && Number.isFinite(v));

    if (clean.length < 2) {

        return null;

    }

    const mean =
        clean.reduce((a, b) => a + b, 0) / clean.length;

    const variance =
        clean.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / clean.length;

    return round(Math.sqrt(variance));

}

/*
 * Resume UNA ventana: MAE de cada modelo sobre los lotes de esa
 * ventana (vía aggregateErrors) y qué modelo "ganó" (menor MAE) — o
 * "TIE" en el caso (raro) de un empate exacto.
 */
function summarizeWindow(windowBatches, windowIndex) {

    const linearAgg =
        aggregateErrors(windowBatches.map(b => b.linearErrorHours));

    const exponentialAgg =
        aggregateErrors(windowBatches.map(b => b.exponentialErrorHours));

    let winner = null;

    if (linearAgg.maeHours !== null && exponentialAgg.maeHours !== null) {

        if (linearAgg.maeHours < exponentialAgg.maeHours) {

            winner = "LINEAR";

        } else if (exponentialAgg.maeHours < linearAgg.maeHours) {

            winner = "EXPONENTIAL";

        } else {

            winner = "TIE";

        }

    }

    return {

        windowIndex,

        sampleSize: windowBatches.length,

        linearMaeHours: linearAgg.maeHours,

        exponentialMaeHours: exponentialAgg.maeHours,

        winner

    };

}

/*
 * Punto de entrada principal: dado el conjunto evaluable e intersectado
 * YA ordenado cronológicamente (mismos objetos { linearErrorHours,
 * exponentialErrorHours } que usa TemporalValidation.js), regresa el
 * resumen completo de estabilidad temporal.
 *
 * Regresa { sufficientData, windowCount, windows, linearWins,
 * exponentialWins, ties, linearMaeStdDev, exponentialMaeStdDev }.
 * Cuando sufficientData es false, todo lo demás (salvo windowCount=0 y
 * windows=[]) es null — nunca se inventan victorias o una desviación
 * estándar con muy pocas ventanas.
 */
function summarizeWindowStability(sortedEvaluableBatches, options = {}) {

    const items =
        sortedEvaluableBatches || [];

    const windowCount =
        computeWindowCount(items.length, options);

    if (windowCount === 0) {

        return {

            sufficientData: false,

            windowCount: 0,

            windows: [],

            linearWins: null,

            exponentialWins: null,

            ties: null,

            linearMaeStdDev: null,

            exponentialMaeStdDev: null

        };

    }

    const windows =
        splitIntoWindows(items, windowCount)
            .map((windowBatches, index) => summarizeWindow(windowBatches, index));

    const linearWins =
        windows.filter(w => w.winner === "LINEAR").length;

    const exponentialWins =
        windows.filter(w => w.winner === "EXPONENTIAL").length;

    const ties =
        windows.filter(w => w.winner === "TIE").length;

    const linearMaeStdDev =
        standardDeviation(windows.map(w => w.linearMaeHours));

    const exponentialMaeStdDev =
        standardDeviation(windows.map(w => w.exponentialMaeHours));

    return {

        sufficientData: true,

        windowCount,

        windows,

        linearWins,

        exponentialWins,

        ties,

        linearMaeStdDev,

        exponentialMaeStdDev

    };

}

module.exports = {

    DEFAULT_WINDOW_COUNT,

    MIN_BATCHES_PER_WINDOW,

    MIN_WINDOWS_FOR_STABILITY,

    computeWindowCount,

    splitIntoWindows,

    standardDeviation,

    summarizeWindow,

    summarizeWindowStability

};
