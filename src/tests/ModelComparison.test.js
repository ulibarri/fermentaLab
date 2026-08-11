const assert =
    require("assert");

const {
    computePercentile,
    summarizeModelErrors,
    determineBestModel,
    SIMILARITY_THRESHOLD_RELATIVE,
    MIN_EVALUATED_BATCHES_FOR_COMPARISON
} = require("../utils/ModelComparison");

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

console.log("ModelComparison tests\n");

// --- computePercentile() ---

test("computePercentile(): con arreglo vacío regresa null", () => {

    assert.strictEqual(computePercentile([], 50), null);

});

test("computePercentile(): con un solo valor, cualquier percentil es ese valor", () => {

    assert.strictEqual(computePercentile([7], 25), 7);

    assert.strictEqual(computePercentile([7], 75), 7);

});

test("computePercentile(): P50 de una serie impar es el valor central exacto", () => {

    const sorted =
        [1, 2, 3, 4, 5];

    assert.strictEqual(computePercentile(sorted, 50), 3);

});

test("computePercentile(): coincide con el método de interpolación lineal estándar (P25 de 1..5)", () => {

    // rank = 0.25 * (5-1) = 1.0 -> índice exacto 1 -> valor 2
    const sorted =
        [1, 2, 3, 4, 5];

    assert.strictEqual(computePercentile(sorted, 25), 2);

});

test("computePercentile(): interpola entre dos valores cuando el rango no cae en un índice exacto", () => {

    // [1,2,3,4] P75 -> rank = 0.75*(4-1) = 2.25 -> entre índice 2 (3) y 3 (4), peso 0.25
    const sorted =
        [1, 2, 3, 4];

    const result =
        computePercentile(sorted, 75);

    assert.ok(Math.abs(result - 3.25) < 1e-9, `esperado 3.25, obtuvo ${result}`);

});

// --- summarizeModelErrors() ---

test("summarizeModelErrors(): con arreglo vacío, count=0 y todo lo demás null (no inventa un promedio)", () => {

    const result =
        summarizeModelErrors([]);

    assert.strictEqual(result.count, 0);

    assert.strictEqual(result.maeHours, null);

    assert.strictEqual(result.p50Hours, null);

});

test("summarizeModelErrors(): reutiliza MAE/RMSE/error máximo de aggregateErrors y agrega percentiles", () => {

    const errors =
        [1.8, 3.9, 6.2, 18.4]; // ejemplo de la especificación (sección 5)

    const result =
        summarizeModelErrors(errors);

    assert.strictEqual(result.count, 4);

    assert.strictEqual(result.maxAbsoluteErrorHours, 18.4);

    assert.ok(typeof result.maeHours === "number");

    assert.ok(typeof result.rmseHours === "number");

    assert.ok(typeof result.p25Hours === "number");

    assert.ok(typeof result.p50Hours === "number");

    assert.ok(typeof result.p75Hours === "number");

});

test("summarizeModelErrors(): ignora valores no numéricos", () => {

    const result =
        summarizeModelErrors([2, null, undefined, 4]);

    assert.strictEqual(result.count, 2);

    assert.strictEqual(result.maeHours, 3);

});

// --- determineBestModel() ---

test("determineBestModel(): con menos lotes que el mínimo, no declara nada (INSUFFICIENT)", () => {

    const linear =
        summarizeModelErrors([1, 2, 3]); // 3 lotes, mínimo es 5

    const exponential =
        summarizeModelErrors([1, 1, 1]);

    const result =
        determineBestModel(linear, exponential);

    assert.strictEqual(result.bestModel, null);

    assert.strictEqual(result.confidence, "INSUFFICIENT");

});

test("determineBestModel(): usa el ejemplo textual de la especificación (4.21h vs 4.25h) -> SIMILAR", () => {

    // Construimos arreglos de 5 elementos cuyo promedio sea exactamente
    // 4.21 y 4.25 respectivamente.
    const linear =
        summarizeModelErrors([4.21, 4.21, 4.21, 4.21, 4.21]);

    const exponential =
        summarizeModelErrors([4.25, 4.25, 4.25, 4.25, 4.25]);

    const result =
        determineBestModel(linear, exponential);

    assert.strictEqual(result.bestModel, "SIMILAR");

    assert.ok(result.message.includes("no existe una diferencia relevante entre los modelos".toLowerCase()) ||
              result.message.toLowerCase().includes("no existe una diferencia relevante"));

});

test("determineBestModel(): usa el ejemplo textual de la especificación (5.2h vs 3.8h) -> EXPONENTIAL", () => {

    const linear =
        summarizeModelErrors([5.2, 5.2, 5.2, 5.2, 5.2]);

    const exponential =
        summarizeModelErrors([3.8, 3.8, 3.8, 3.8, 3.8]);

    const result =
        determineBestModel(linear, exponential);

    assert.strictEqual(result.bestModel, "EXPONENTIAL");

    assert.notStrictEqual(result.confidence, "INSUFFICIENT");

});

test("determineBestModel(): diferencia relativa grande (>=50%) da confianza HIGH", () => {

    const linear =
        summarizeModelErrors([8, 8, 8, 8, 8]);

    const exponential =
        summarizeModelErrors([2, 2, 2, 2, 2]); // mejora relativa (8-2)/8 = 0.75

    const result =
        determineBestModel(linear, exponential);

    assert.strictEqual(result.bestModel, "EXPONENTIAL");

    assert.strictEqual(result.confidence, "HIGH");

});

test("determineBestModel(): diferencia relativa moderada (~30%) da confianza MEDIUM", () => {

    const linear =
        summarizeModelErrors([5, 5, 5, 5, 5]);

    const exponential =
        summarizeModelErrors([3.5, 3.5, 3.5, 3.5, 3.5]); // mejora relativa 0.30

    const result =
        determineBestModel(linear, exponential);

    assert.strictEqual(result.confidence, "MEDIUM");

});

test("determineBestModel(): recomienda LINEAR cuando su MAE es menor", () => {

    const linear =
        summarizeModelErrors([1, 1, 1, 1, 1]);

    const exponential =
        summarizeModelErrors([5, 5, 5, 5, 5]);

    const result =
        determineBestModel(linear, exponential);

    assert.strictEqual(result.bestModel, "LINEAR");

});

test("determineBestModel(): con datos insuficientes (MAE null) no declara nada", () => {

    const linear =
        summarizeModelErrors([]); // count 0, maeHours null

    const exponential =
        summarizeModelErrors([]);

    // Forzamos un count artificialmente alto para pasar el primer gate
    // y verificar específicamente el gate de MAE null.
    linear.count = 10;

    exponential.count = 10;

    const result =
        determineBestModel(linear, exponential);

    assert.strictEqual(result.bestModel, null);

    assert.strictEqual(result.confidence, "INSUFFICIENT");

});

test("determineBestModel(): el umbral de similitud y el mínimo de muestra son configurables", () => {

    const linear =
        summarizeModelErrors([4, 4, 4]); // 3 lotes

    const exponential =
        summarizeModelErrors([3.9, 3.9, 3.9]);

    const withDefaults =
        determineBestModel(linear, exponential);

    assert.strictEqual(withDefaults.confidence, "INSUFFICIENT");

    const withLowerMinimum =
        determineBestModel(linear, exponential, { minSampleSize: 3, similarityThreshold: 0.01 });

    assert.notStrictEqual(withLowerMinimum.confidence, "INSUFFICIENT");

});

test("SIMILARITY_THRESHOLD_RELATIVE y MIN_EVALUATED_BATCHES_FOR_COMPARISON están expuestos", () => {

    assert.strictEqual(SIMILARITY_THRESHOLD_RELATIVE, 0.05);

    assert.strictEqual(MIN_EVALUATED_BATCHES_FOR_COMPARISON, 5);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
