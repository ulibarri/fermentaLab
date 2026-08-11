const assert =
    require("assert");

const {
    classifyErrorHours,
    summarizeErrorClassification,
    buildCorrelationMatrix,
    extractScatterPoints,
    MIN_MULTIVARIABLE_SAMPLE_SIZE,
    DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS
} = require("../utils/MultivariableAnalysis");

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

console.log("MultivariableAnalysis tests\n");

// --- classifyErrorHours() ---

test("classifyErrorHours(): usa los 4 umbrales por defecto de la especificación", () => {

    assert.strictEqual(classifyErrorHours(0), "EXCELLENT");

    assert.strictEqual(classifyErrorHours(2), "EXCELLENT");

    assert.strictEqual(classifyErrorHours(2.1), "GOOD");

    assert.strictEqual(classifyErrorHours(6), "GOOD");

    assert.strictEqual(classifyErrorHours(6.1), "MODERATE");

    assert.strictEqual(classifyErrorHours(12), "MODERATE");

    assert.strictEqual(classifyErrorHours(12.1), "HIGH");

    assert.strictEqual(classifyErrorHours(100), "HIGH");

});

test("classifyErrorHours(): con un valor no numérico regresa null, no una categoría por defecto", () => {

    assert.strictEqual(classifyErrorHours(null), null);

    assert.strictEqual(classifyErrorHours(undefined), null);

    assert.strictEqual(classifyErrorHours(NaN), null);

});

test("classifyErrorHours(): los umbrales son configurables, no están hardcodeados", () => {

    const customThresholds = {

        excellentMaxHours: 1,

        goodMaxHours: 3,

        moderateMaxHours: 5

    };

    assert.strictEqual(classifyErrorHours(1, customThresholds), "EXCELLENT");

    assert.strictEqual(classifyErrorHours(2, customThresholds), "GOOD");

    assert.strictEqual(classifyErrorHours(4, customThresholds), "MODERATE");

    assert.strictEqual(classifyErrorHours(6, customThresholds), "HIGH");

});

// --- summarizeErrorClassification() ---

test("summarizeErrorClassification(): cuenta correctamente en las 4 bandas", () => {

    const errors =
        [1, 1.5, 4, 5, 8, 10, 15, 20];

    const result =
        summarizeErrorClassification(errors);

    assert.strictEqual(result.excellent, 2);

    assert.strictEqual(result.good, 2);

    assert.strictEqual(result.moderate, 2);

    assert.strictEqual(result.high, 2);

    assert.strictEqual(result.count, 8);

});

test("summarizeErrorClassification(): los valores null no se cuentan en ninguna categoría", () => {

    const errors =
        [1, null, undefined, 3];

    const result =
        summarizeErrorClassification(errors);

    assert.strictEqual(result.count, 2);

    assert.strictEqual(result.excellent + result.good + result.moderate + result.high, 2);

});

test("summarizeErrorClassification(): con arreglo vacío regresa todo en 0, sin lanzar error", () => {

    const result =
        summarizeErrorClassification([]);

    assert.strictEqual(result.count, 0);

    assert.strictEqual(result.excellent, 0);

    assert.strictEqual(result.high, 0);

});

// --- buildCorrelationMatrix() ---

const variableDefs = [

    { key: "volume", label: "el volumen" },

    { key: "temperature", label: "la temperatura" },

    { key: "rate", label: "la velocidad" }

];

test("buildCorrelationMatrix(): la diagonal siempre es 1.00", () => {

    const rows = [

        { volume: 12, temperature: 27, rate: 0.003 },

        { volume: 20, temperature: 28, rate: 0.0025 }

    ];

    const matrix =
        buildCorrelationMatrix(rows, variableDefs);

    assert.strictEqual(matrix.volume.volume.value, 1);

    assert.strictEqual(matrix.temperature.temperature.value, 1);

    assert.strictEqual(matrix.rate.rate.value, 1);

});

test("buildCorrelationMatrix(): es simétrica (A↔B igual a B↔A)", () => {

    const rows = [

        { volume: 12, temperature: 27, rate: 0.0040 },

        { volume: 20, temperature: 28, rate: 0.0035 },

        { volume: 30, temperature: 29, rate: 0.0030 },

        { volume: 60, temperature: 31, rate: 0.0025 },

        { volume: 40, temperature: 29.5, rate: 0.0028 },

        { volume: 15, temperature: 27.5, rate: 0.0038 }

    ];

    const matrix =
        buildCorrelationMatrix(rows, variableDefs);

    assert.strictEqual(matrix.volume.temperature.value, matrix.temperature.volume.value);

});

test("buildCorrelationMatrix(): con muestra insuficiente, la celda no reporta un número (sufficientSample=false)", () => {

    const rows = [

        { volume: 12, temperature: 27, rate: 0.003 },

        { volume: 20, temperature: 28, rate: 0.0025 }

    ]; // 2 lotes, muy por debajo del mínimo (6)

    const matrix =
        buildCorrelationMatrix(rows, variableDefs);

    assert.strictEqual(matrix.volume.temperature.value, null);

    assert.strictEqual(matrix.volume.temperature.sufficientSample, false);

    assert.strictEqual(matrix.volume.temperature.sampleSize, 2);

});

test("buildCorrelationMatrix(): con muestra suficiente, reporta un coeficiente numérico y sufficientSample=true", () => {

    const rows = [

        { volume: 12, temperature: 27, rate: 0.0040 },

        { volume: 20, temperature: 28, rate: 0.0035 },

        { volume: 30, temperature: 29, rate: 0.0030 },

        { volume: 60, temperature: 31, rate: 0.0025 },

        { volume: 40, temperature: 29.5, rate: 0.0028 },

        { volume: 15, temperature: 27.5, rate: 0.0038 }

    ]; // 6 lotes, exactamente el mínimo

    const matrix =
        buildCorrelationMatrix(rows, variableDefs);

    assert.strictEqual(typeof matrix.volume.rate.value, "number");

    assert.strictEqual(matrix.volume.rate.sufficientSample, true);

    assert.strictEqual(matrix.volume.rate.sampleSize, 6);

});

test("buildCorrelationMatrix(): el mínimo de muestra por defecto es más estricto que en entregas anteriores (6, no 4)", () => {

    assert.strictEqual(MIN_MULTIVARIABLE_SAMPLE_SIZE, 6);

    const rows =
        Array.from({ length: 5 }, (_, i) => ({ volume: 10 + i, temperature: 27 + i, rate: 0.003 - i * 0.0001 }));

    const matrix =
        buildCorrelationMatrix(rows, variableDefs); // 5 lotes: insuficiente con el mínimo de esta entrega

    assert.strictEqual(matrix.volume.temperature.value, null);

});

test("buildCorrelationMatrix(): el mínimo de muestra es configurable por llamada", () => {

    const rows = [

        { volume: 12, temperature: 27, rate: 0.0040 },

        { volume: 20, temperature: 28, rate: 0.0035 },

        { volume: 30, temperature: 29, rate: 0.0030 }

    ];

    const withDefault =
        buildCorrelationMatrix(rows, variableDefs);

    assert.strictEqual(withDefault.volume.temperature.value, null);

    const withLowerMinimum =
        buildCorrelationMatrix(rows, variableDefs, 3);

    assert.strictEqual(typeof withLowerMinimum.volume.temperature.value, "number");

});

test("buildCorrelationMatrix(): un lote sin una de las variables no rompe el cálculo, solo se excluye de esa celda", () => {

    const rows = [

        { volume: 12, temperature: 27, rate: 0.0040 },

        { volume: 20, temperature: null, rate: 0.0035 }, // sin temperatura

        { volume: 30, temperature: 29, rate: 0.0030 },

        { volume: 60, temperature: 31, rate: 0.0025 },

        { volume: 40, temperature: 29.5, rate: 0.0028 },

        { volume: 15, temperature: 27.5, rate: 0.0038 }

    ];

    const matrix =
        buildCorrelationMatrix(rows, variableDefs);

    // volume↔rate tiene 6 lotes disponibles; volume↔temperature solo 5.
    assert.strictEqual(matrix.volume.rate.sampleSize, 6);

    assert.strictEqual(matrix.volume.temperature.sampleSize, 5);

});

// --- extractScatterPoints() ---

test("extractScatterPoints(): extrae pares {x,y} descartando filas incompletas", () => {

    const rows = [

        { temperature: 27, rate: 0.003 },

        { temperature: null, rate: 0.0025 },

        { temperature: 29, rate: null },

        { temperature: 31, rate: 0.002 }

    ];

    const points =
        extractScatterPoints(rows, "temperature", "rate");

    assert.strictEqual(points.length, 2);

    assert.deepStrictEqual(points, [

        { x: 27, y: 0.003 },

        { x: 31, y: 0.002 }

    ]);

});

test("DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS: expone los umbrales centralizados (no hardcodeados en la interfaz)", () => {

    assert.strictEqual(DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS.excellentMaxHours, 2);

    assert.strictEqual(DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS.goodMaxHours, 6);

    assert.strictEqual(DEFAULT_ERROR_CLASSIFICATION_THRESHOLDS.moderateMaxHours, 12);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
