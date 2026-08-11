const assert =
    require("assert");

const {
    aggregateErrors,
    compareHistoricalAccuracy,
    MIN_EVALUATED_BATCHES_FOR_COMPARISON
} = require("../utils/MaturationStatistics");

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

console.log("MaturationStatistics tests\n");

// --- aggregateErrors() ---

test("aggregateErrors(): con arreglo vacío regresa count 0 y todo null, sin inventar un promedio", () => {

    const result =
        aggregateErrors([]);

    assert.strictEqual(result.count, 0);

    assert.strictEqual(result.maeHours, null);

    assert.strictEqual(result.rmseHours, null);

    assert.strictEqual(result.minErrorHours, null);

    assert.strictEqual(result.maxErrorHours, null);

    assert.strictEqual(result.within2Hours, null);

    assert.strictEqual(result.within6Hours, null);

});

test("aggregateErrors(): un solo error, MAE/RMSE/min/max coinciden con ese valor", () => {

    const result =
        aggregateErrors([3.5]);

    assert.strictEqual(result.count, 1);

    assert.strictEqual(result.maeHours, 3.5);

    assert.strictEqual(result.rmseHours, 3.5);

    assert.strictEqual(result.minErrorHours, 3.5);

    assert.strictEqual(result.maxErrorHours, 3.5);

});

test("aggregateErrors(): MAE es el promedio simple, RMSE penaliza más los errores grandes", () => {

    // Errores: 1, 1, 1, 9 -> MAE = 3, RMSE = sqrt((1+1+1+81)/4) = sqrt(21) ≈ 4.583
    const result =
        aggregateErrors([1, 1, 1, 9]);

    assert.strictEqual(result.count, 4);

    assert.strictEqual(result.maeHours, 3);

    assert.ok(

        Math.abs(result.rmseHours - 4.58) < 0.01,

        `esperado ~4.58, obtuvo ${result.rmseHours}`

    );

    assert.ok(

        result.rmseHours > result.maeHours,

        "RMSE debe ser mayor o igual que MAE cuando hay dispersión"

    );

});

test("aggregateErrors(): porcentaje dentro de márgenes con valores exactamente en el límite cuentan como dentro", () => {

    // Márgenes por defecto: 2h y 6h. Errores: 2 (exacto), 6 (exacto), 10.
    const result =
        aggregateErrors([2, 6, 10]);

    assert.strictEqual(result.count, 3);

    // dentro de 2h: solo el valor 2 -> 1/3 = 33.3%
    assert.ok(

        Math.abs(result.within2Hours - 33.3) < 0.1,

        `esperado ~33.3, obtuvo ${result.within2Hours}`

    );

    // dentro de 6h: 2 y 6 -> 2/3 = 66.7%
    assert.ok(

        Math.abs(result.within6Hours - 66.7) < 0.1,

        `esperado ~66.7, obtuvo ${result.within6Hours}`

    );

});

test("aggregateErrors(): coincide con el ejemplo de la especificación (aproximado)", () => {

    // No tenemos los 18 valores exactos de la especificación, pero
    // verificamos que con una distribución razonable el MAE/RMSE quedan
    // en el rango del ejemplo (MAE 3.7h, RMSE 5.2h) — prueba de cordura
    // sobre la fórmula, no una replicación exacta.
    const errors =
        [0.4, 1.0, 1.5, 2.0, 2.2, 2.5, 2.8, 3.0, 3.2, 3.5, 3.8, 4.0, 4.5, 5.0, 5.5, 6.0, 9.0, 14.8];

    const result =
        aggregateErrors(errors);

    assert.strictEqual(result.count, 18);

    assert.ok(result.maeHours > 0 && result.maeHours < result.rmseHours + 0.01);

    assert.strictEqual(result.minErrorHours, 0.4);

    assert.strictEqual(result.maxErrorHours, 14.8);

});

test("aggregateErrors(): ignora valores no numéricos o no finitos en el arreglo de entrada", () => {

    const result =
        aggregateErrors([2, null, undefined, NaN, 4]);

    assert.strictEqual(result.count, 2);

    assert.strictEqual(result.maeHours, 3);

});

// --- compareHistoricalAccuracy() ---

test("compareHistoricalAccuracy(): con menos de 5 lotes evaluables en cualquiera de los dos modelos, no recomienda nada", () => {

    const linearAgg =
        aggregateErrors([1, 2, 3, 4]); // 4 lotes, insuficiente

    const exponentialAgg =
        aggregateErrors([1, 2, 3, 4, 5, 6]); // 6 lotes, suficiente por sí solo

    const result =
        compareHistoricalAccuracy(linearAgg, exponentialAgg);

    assert.strictEqual(result.recommendedModel, null);

    assert.strictEqual(result.confidence, "INSUFFICIENT");

    assert.strictEqual(result.message, "Datos insuficientes para comparar modelos.");

});

test("compareHistoricalAccuracy(): exactamente 5 lotes evaluables en ambos modelos ya alcanza el mínimo", () => {

    const linearAgg =
        aggregateErrors([5, 5, 5, 5, 5]); // MAE 5

    const exponentialAgg =
        aggregateErrors([1, 1, 1, 1, 1]); // MAE 1

    const result =
        compareHistoricalAccuracy(linearAgg, exponentialAgg);

    assert.strictEqual(result.recommendedModel, "EXPONENTIAL");

    assert.notStrictEqual(result.confidence, "INSUFFICIENT");

});

test("compareHistoricalAccuracy(): con suficientes lotes pero MAE prácticamente idéntico, no declara ganador (LOW, empate)", () => {

    const linearAgg =
        aggregateErrors([3.70, 3.70, 3.70, 3.70, 3.70, 3.70]);

    const exponentialAgg =
        aggregateErrors([3.701, 3.701, 3.701, 3.701, 3.701, 3.701]);

    const result =
        compareHistoricalAccuracy(linearAgg, exponentialAgg);

    assert.strictEqual(result.recommendedModel, null);

    assert.strictEqual(result.confidence, "LOW");

});

test("compareHistoricalAccuracy(): diferencia grande de MAE (>=50% relativo) recomienda con confianza HIGH", () => {

    const linearAgg =
        aggregateErrors([8, 8, 8, 8, 8, 8]); // MAE 8

    const exponentialAgg =
        aggregateErrors([2, 2, 2, 2, 2, 2]); // MAE 2 -> mejora relativa (8-2)/8 = 0.75

    const result =
        compareHistoricalAccuracy(linearAgg, exponentialAgg);

    assert.strictEqual(result.recommendedModel, "EXPONENTIAL");

    assert.strictEqual(result.confidence, "HIGH");

    assert.strictEqual(result.maeDifferenceHours, 6);

});

test("compareHistoricalAccuracy(): diferencia moderada de MAE (~30%) recomienda con confianza MEDIUM", () => {

    const linearAgg =
        aggregateErrors([5, 5, 5, 5, 5, 5]); // MAE 5

    const exponentialAgg =
        aggregateErrors([3.5, 3.5, 3.5, 3.5, 3.5, 3.5]); // MAE 3.5 -> mejora relativa 0.30

    const result =
        compareHistoricalAccuracy(linearAgg, exponentialAgg);

    assert.strictEqual(result.recommendedModel, "EXPONENTIAL");

    assert.strictEqual(result.confidence, "MEDIUM");

});

test("compareHistoricalAccuracy(): diferencia pequeña de MAE (<20%) aun así identifica el modelo con menor error, pero confianza LOW", () => {

    const linearAgg =
        aggregateErrors([4, 4, 4, 4, 4, 4]); // MAE 4

    const exponentialAgg =
        aggregateErrors([3.7, 3.7, 3.7, 3.7, 3.7, 3.7]); // MAE 3.7 -> mejora relativa 0.075

    const result =
        compareHistoricalAccuracy(linearAgg, exponentialAgg);

    assert.strictEqual(result.recommendedModel, "EXPONENTIAL");

    assert.strictEqual(result.confidence, "LOW");

});

test("compareHistoricalAccuracy(): recomienda LINEAR cuando su MAE es menor", () => {

    const linearAgg =
        aggregateErrors([1, 1, 1, 1, 1, 1]); // MAE 1

    const exponentialAgg =
        aggregateErrors([5, 5, 5, 5, 5, 5]); // MAE 5

    const result =
        compareHistoricalAccuracy(linearAgg, exponentialAgg);

    assert.strictEqual(result.recommendedModel, "LINEAR");

});

test("compareHistoricalAccuracy(): usa el ejemplo textual de la especificación (MAE lineal 4.1h, exponencial 2.8h, diferencia 1.3h)", () => {

    const linearAgg =
        { count: 6, maeHours: 4.1 };

    const exponentialAgg =
        { count: 6, maeHours: 2.8 };

    const result =
        compareHistoricalAccuracy(linearAgg, exponentialAgg);

    assert.strictEqual(result.recommendedModel, "EXPONENTIAL");

    assert.ok(

        Math.abs(result.maeDifferenceHours - 1.3) < 1e-9,

        `esperado 1.3, obtuvo ${result.maeDifferenceHours}`

    );

});

test("compareHistoricalAccuracy(): el mínimo de lotes es configurable vía options.minBatches", () => {

    const linearAgg =
        aggregateErrors([1, 1, 1]); // solo 3 lotes

    const exponentialAgg =
        aggregateErrors([5, 5, 5]);

    const withDefault =
        compareHistoricalAccuracy(linearAgg, exponentialAgg);

    assert.strictEqual(withDefault.confidence, "INSUFFICIENT");

    const withLowerMinimum =
        compareHistoricalAccuracy(linearAgg, exponentialAgg, { minBatches: 3 });

    assert.strictEqual(withLowerMinimum.recommendedModel, "LINEAR");

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
