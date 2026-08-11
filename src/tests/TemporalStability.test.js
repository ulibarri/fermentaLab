const assert =
    require("assert");

const {
    DEFAULT_WINDOW_COUNT,
    MIN_BATCHES_PER_WINDOW,
    MIN_WINDOWS_FOR_STABILITY,
    computeWindowCount,
    splitIntoWindows,
    standardDeviation,
    summarizeWindow,
    summarizeWindowStability
} = require("../utils/TemporalStability");

let passed = 0;

let failed = 0;

function test(name, fn) {

    try {

        fn();

        passed++;

        console.log(`  OK  ${name}`);

    } catch (err) {

        failed++;

        console.log(`FAIL  ${name}`);

        console.log(`      ${err.message}`);

    }

}

console.log("TemporalStability tests\n");

// --- computeWindowCount() ---

test("computeWindowCount(): con 30 lotes usa las 5 ventanas por defecto", () => {

    assert.strictEqual(computeWindowCount(30), 5);

});

test("computeWindowCount(): limita las ventanas a lo que permite el mínimo por ventana", () => {

    // 8 lotes, mínimo 2 por ventana -> máximo 4 ventanas posibles (< 5 por defecto)
    assert.strictEqual(computeWindowCount(8), 4);

});

test("computeWindowCount(): por debajo del mínimo de ventanas para estabilidad, regresa 0", () => {

    // 5 lotes -> máximo 2 ventanas (5/2 redondeado abajo) < mínimo de 3 -> 0
    assert.strictEqual(computeWindowCount(5), 0);

    assert.strictEqual(computeWindowCount(0), 0);

});

test("computeWindowCount(): el número de ventanas objetivo y los mínimos son configurables", () => {

    assert.strictEqual(computeWindowCount(9, { windowCount: 3 }), 3);

    assert.strictEqual(computeWindowCount(4, { minWindowsForStability: 2, minBatchesPerWindow: 2 }), 2);

});

// --- splitIntoWindows() ---

test("splitIntoWindows(): 10 lotes en 5 ventanas da 5 ventanas de 2", () => {

    const items =
        Array.from({ length: 10 }, (_, i) => i + 1);

    const windows =
        splitIntoWindows(items, 5);

    assert.strictEqual(windows.length, 5);

    windows.forEach(w => assert.strictEqual(w.length, 2));

    assert.deepStrictEqual(windows[0], [1, 2]);

    assert.deepStrictEqual(windows[4], [9, 10]);

});

test("splitIntoWindows(): con residuo, las PRIMERAS ventanas reciben el elemento extra", () => {

    // 7 lotes en 3 ventanas -> tamaños 3,2,2 (residuo 1 va a la primera)
    const items =
        Array.from({ length: 7 }, (_, i) => i + 1);

    const windows =
        splitIntoWindows(items, 3);

    assert.deepStrictEqual(windows.map(w => w.length), [3, 2, 2]);

    assert.deepStrictEqual(windows[0], [1, 2, 3]);

    assert.deepStrictEqual(windows[1], [4, 5]);

    assert.deepStrictEqual(windows[2], [6, 7]);

});

test("splitIntoWindows(): windowCount 0 regresa arreglo vacío", () => {

    assert.deepStrictEqual(splitIntoWindows([1, 2, 3], 0), []);

});

// --- standardDeviation() ---

test("standardDeviation(): con menos de 2 valores regresa null", () => {

    assert.strictEqual(standardDeviation([]), null);

    assert.strictEqual(standardDeviation([5]), null);

});

test("standardDeviation(): desviación estándar poblacional de una serie conocida", () => {

    // [2, 4, 4, 4, 5, 5, 7, 9] -> media 5, varianza 4, desviación 2
    const values =
        [2, 4, 4, 4, 5, 5, 7, 9];

    assert.strictEqual(standardDeviation(values), 2);

});

test("standardDeviation(): valores idénticos dan desviación 0 (máxima estabilidad)", () => {

    assert.strictEqual(standardDeviation([3, 3, 3, 3]), 0);

});

test("standardDeviation(): ignora valores no numéricos", () => {

    assert.strictEqual(standardDeviation([3, 3, null, undefined, 3, 3]), 0);

});

// --- summarizeWindow() ---

test("summarizeWindow(): LINEAR gana cuando su MAE es menor", () => {

    const window =
        [{ linearErrorHours: 1, exponentialErrorHours: 5 }, { linearErrorHours: 1, exponentialErrorHours: 5 }];

    const result =
        summarizeWindow(window, 0);

    assert.strictEqual(result.winner, "LINEAR");

    assert.strictEqual(result.linearMaeHours, 1);

    assert.strictEqual(result.exponentialMaeHours, 5);

    assert.strictEqual(result.sampleSize, 2);

});

test("summarizeWindow(): EXPONENTIAL gana cuando su MAE es menor", () => {

    const window =
        [{ linearErrorHours: 8, exponentialErrorHours: 2 }];

    const result =
        summarizeWindow(window, 1);

    assert.strictEqual(result.winner, "EXPONENTIAL");

});

test("summarizeWindow(): TIE en empate exacto", () => {

    const window =
        [{ linearErrorHours: 4, exponentialErrorHours: 4 }];

    const result =
        summarizeWindow(window, 0);

    assert.strictEqual(result.winner, "TIE");

});

test("summarizeWindow(): ventana vacía no tiene ganador (null, no inventa uno)", () => {

    const result =
        summarizeWindow([], 0);

    assert.strictEqual(result.winner, null);

    assert.strictEqual(result.linearMaeHours, null);

});

// --- summarizeWindowStability() (integración) ---

function evaluatedBatch(chronoKey, linearErrorHours, exponentialErrorHours) {

    return { chronoKey, linearErrorHours, exponentialErrorHours };

}

test("summarizeWindowStability(): con menos lotes que el mínimo, sufficientData=false", () => {

    const batches =
        Array.from({ length: 5 }, (_, i) => evaluatedBatch(i, 2, 2));

    const result =
        summarizeWindowStability(batches);

    assert.strictEqual(result.sufficientData, false);

    assert.strictEqual(result.windowCount, 0);

    assert.strictEqual(result.linearWins, null);

    assert.strictEqual(result.linearMaeStdDev, null);

});

test("summarizeWindowStability(): reproduce el ejemplo de la especificación (Lineal 4 victorias, Exponencial 1, baja vs alta variabilidad)", () => {

    // 30 lotes evaluables -> 5 ventanas de 6. Lineal gana 4 ventanas con
    // MAE estable (~3.8h); Exponencial gana solo la última ventana pero
    // con MAE muy variable entre ventanas (alta variabilidad).
    const batches = [];

    const linearMaePerWindow = [3.7, 3.9, 3.8, 3.8, 6.0]; // Lineal pierde solo la última

    const exponentialMaePerWindow = [8.0, 7.5, 9.0, 8.2, 2.0]; // Exponencial gana solo la última, muy variable

    for (let w = 0; w < 5; w++) {

        for (let i = 0; i < 6; i++) {

            batches.push(evaluatedBatch(w * 6 + i, linearMaePerWindow[w], exponentialMaePerWindow[w]));

        }

    }

    const result =
        summarizeWindowStability(batches);

    assert.strictEqual(result.sufficientData, true);

    assert.strictEqual(result.windowCount, 5);

    assert.strictEqual(result.linearWins, 4);

    assert.strictEqual(result.exponentialWins, 1);

    assert.strictEqual(result.ties, 0);

    assert.ok(result.linearMaeStdDev < result.exponentialMaeStdDev, `esperado linear más estable que exponencial: ${result.linearMaeStdDev} vs ${result.exponentialMaeStdDev}`);

    console.log(`      (linearMaeStdDev=${result.linearMaeStdDev}, exponentialMaeStdDev=${result.exponentialMaeStdDev})`);

});

test("summarizeWindowStability(): respeta el orden de entrada (no reordena) — responsabilidad de quien llama", () => {

    const batches =
        Array.from({ length: 20 }, (_, i) => evaluatedBatch(20 - i, 1, 1)); // orden descendente a propósito

    const result =
        summarizeWindowStability(batches);

    assert.strictEqual(result.sufficientData, true);

    // No verificamos el orden cronológico aquí -- eso es responsabilidad
    // de sortByChronologicalKey() (TemporalValidation.js), reutilizado
    // por el servicio antes de llamar a este módulo.
    assert.strictEqual(result.windows.length, 5);

});

test("constantes exportadas: DEFAULT_WINDOW_COUNT=5, MIN_BATCHES_PER_WINDOW=2, MIN_WINDOWS_FOR_STABILITY=3", () => {

    assert.strictEqual(DEFAULT_WINDOW_COUNT, 5);

    assert.strictEqual(MIN_BATCHES_PER_WINDOW, 2);

    assert.strictEqual(MIN_WINDOWS_FOR_STABILITY, 3);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
