const assert =
    require("assert");

const {
    DEFAULT_TRAINING_RATIO,
    MIN_TRAINING_BATCHES,
    MIN_VALIDATION_BATCHES,
    sortByChronologicalKey,
    splitTemporal,
    computeGeneralizationGap,
    summarizeModelTemporalValidation,
    determineBestValidationModel,
    buildTemporalValidation
} = require("../utils/TemporalValidation");

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

console.log("TemporalValidation tests\n");

// --- sortByChronologicalKey() ---

test("sortByChronologicalKey(): ordena ascendentemente por la clave numérica", () => {

    const items =
        [{ id: "c", t: 30 }, { id: "a", t: 10 }, { id: "b", t: 20 }];

    const sorted =
        sortByChronologicalKey(items, i => i.t);

    assert.deepStrictEqual(sorted.map(i => i.id), ["a", "b", "c"]);

});

test("sortByChronologicalKey(): elementos sin clave válida quedan al final, en su orden original", () => {

    const items =
        [{ id: "a", t: null }, { id: "b", t: 20 }, { id: "c", t: undefined }, { id: "d", t: 10 }];

    const sorted =
        sortByChronologicalKey(items, i => i.t);

    assert.deepStrictEqual(sorted.map(i => i.id), ["d", "b", "a", "c"]);

});

test("sortByChronologicalKey(): NaN se trata como clave inválida", () => {

    const items =
        [{ id: "a", t: NaN }, { id: "b", t: 5 }];

    const sorted =
        sortByChronologicalKey(items, i => i.t);

    assert.deepStrictEqual(sorted.map(i => i.id), ["b", "a"]);

});

test("sortByChronologicalKey(): es estable ante claves empatadas", () => {

    const items =
        [{ id: "a", t: 5 }, { id: "b", t: 5 }, { id: "c", t: 5 }];

    const sorted =
        sortByChronologicalKey(items, i => i.t);

    assert.deepStrictEqual(sorted.map(i => i.id), ["a", "b", "c"]);

});

// --- splitTemporal() ---

test("splitTemporal(): 30 lotes con 80/20 da 24 entrenamiento / 6 validación (ejemplo de la sección 2)", () => {

    const items =
        Array.from({ length: 30 }, (_, i) => i + 1);

    const { training, validation, trainingSize, validationSize } =
        splitTemporal(items);

    assert.strictEqual(trainingSize, 24);

    assert.strictEqual(validationSize, 6);

    assert.deepStrictEqual(training, Array.from({ length: 24 }, (_, i) => i + 1));

    assert.deepStrictEqual(validation, [25, 26, 27, 28, 29, 30]);

});

test("splitTemporal(): 7 lotes da 5 entrenamiento / 2 validación (ejemplo de la sección 9)", () => {

    const items =
        Array.from({ length: 7 }, (_, i) => i + 1);

    const { trainingSize, validationSize } =
        splitTemporal(items);

    assert.strictEqual(trainingSize, 5);

    assert.strictEqual(validationSize, 2);

});

test("splitTemporal(): la razón de entrenamiento es configurable", () => {

    const items =
        Array.from({ length: 10 }, (_, i) => i + 1);

    const { trainingSize, validationSize } =
        splitTemporal(items, 0.5);

    assert.strictEqual(trainingSize, 5);

    assert.strictEqual(validationSize, 5);

});

test("splitTemporal(): arreglo vacío no falla", () => {

    const { trainingSize, validationSize } =
        splitTemporal([]);

    assert.strictEqual(trainingSize, 0);

    assert.strictEqual(validationSize, 0);

});

// --- computeGeneralizationGap() ---

test("computeGeneralizationGap(): resta validación - entrenamiento (ejemplo lineal de la sección 6)", () => {

    assert.strictEqual(computeGeneralizationGap(5.1, 3.8), 1.3);

});

test("computeGeneralizationGap(): ejemplo exponencial de la sección 6 (sobreajuste)", () => {

    assert.strictEqual(computeGeneralizationGap(9.8, 2.1), 7.7);

});

test("computeGeneralizationGap(): null si falta cualquiera de los dos MAE", () => {

    assert.strictEqual(computeGeneralizationGap(null, 3.8), null);

    assert.strictEqual(computeGeneralizationGap(5.1, null), null);

    assert.strictEqual(computeGeneralizationGap(undefined, undefined), null);

});

// --- summarizeModelTemporalValidation() ---

test("summarizeModelTemporalValidation(): reproduce el ejemplo lineal completo de la sección 7", () => {

    // Construimos arreglos cuyo MAE sea exactamente el del ejemplo.
    const trainingErrors =
        [3.8, 3.8, 3.8, 3.8, 3.8];

    const validationErrors =
        [5.1, 5.1, 5.1, 5.1, 5.1];

    const result =
        summarizeModelTemporalValidation(trainingErrors, validationErrors);

    assert.strictEqual(result.training.maeHours, 3.8);

    assert.strictEqual(result.validation.maeHours, 5.1);

    assert.strictEqual(result.generalizationGapHours, 1.3);

});

test("summarizeModelTemporalValidation(): incluye el error máximo absoluto de validación, no de entrenamiento", () => {

    const result =
        summarizeModelTemporalValidation([1, 1], [2, 8, 3]);

    assert.strictEqual(result.validation.maxAbsoluteErrorHours, 8);

    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.training, "maxAbsoluteErrorHours"), false);

});

test("summarizeModelTemporalValidation(): con validación vacía, sus métricas son null (no inventa un promedio)", () => {

    const result =
        summarizeModelTemporalValidation([1, 2, 3], []);

    assert.strictEqual(result.validation.maeHours, null);

    assert.strictEqual(result.generalizationGapHours, null);

});

// --- determineBestValidationModel() ---

test("determineBestValidationModel(): gana el modelo con menor MAE de validación (ejemplo de la sección 7)", () => {

    // Lineal validación 5.1h, Exponencial validación 9.8h -> LINEAR gana
    // a pesar de que Exponencial tenía mejor MAE de entrenamiento.
    assert.strictEqual(determineBestValidationModel(5.1, 9.8), "LINEAR");

});

test("determineBestValidationModel(): EXPONENTIAL cuando su MAE de validación es menor", () => {

    assert.strictEqual(determineBestValidationModel(9.8, 5.1), "EXPONENTIAL");

});

test("determineBestValidationModel(): null en empate exacto (no declara ganador artificial)", () => {

    assert.strictEqual(determineBestValidationModel(4, 4), null);

});

test("determineBestValidationModel(): null si falta cualquiera de los dos MAE", () => {

    assert.strictEqual(determineBestValidationModel(null, 4), null);

    assert.strictEqual(determineBestValidationModel(4, undefined), null);

});

// --- buildTemporalValidation() (integración de todo el módulo) ---

function evaluatedBatch(chronoKey, linearErrorHours, exponentialErrorHours) {

    return { chronoKey, linearErrorHours, exponentialErrorHours };

}

test("buildTemporalValidation(): con 7 lotes evaluables, marca insufficientData (ejemplo de la sección 9)", () => {

    const batches =
        Array.from({ length: 7 }, (_, i) => evaluatedBatch(i, 3, 3));

    const result =
        buildTemporalValidation(batches);

    assert.strictEqual(result.sampleSize, 7);

    assert.strictEqual(result.trainingSize, 5);

    assert.strictEqual(result.validationSize, 2);

    assert.strictEqual(result.insufficientData, true);

    assert.ok(result.message.toLowerCase().includes("datos insuficientes"));

    assert.strictEqual(result.linear, null);

    assert.strictEqual(result.exponential, null);

    assert.strictEqual(result.bestValidationModel, null);

});

test("buildTemporalValidation(): reproduce el ejemplo completo de la sección 7 con 30 lotes", () => {

    // 24 lotes de entrenamiento con error constante (MAE = valor exacto),
    // 6 lotes de validación con error constante también, para poder
    // afirmar el MAE/RMSE exactos sin ambigüedad de redondeo.
    const training =
        Array.from({ length: 24 }, (_, i) => evaluatedBatch(i, 3.8, 2.1));

    const validation =
        [
            evaluatedBatch(100, 5.1, 9.8),
            evaluatedBatch(101, 5.1, 9.8),
            evaluatedBatch(102, 5.1, 9.8),
            evaluatedBatch(103, 5.1, 9.8),
            evaluatedBatch(104, 5.1, 9.8),
            evaluatedBatch(105, 5.1, 9.8)
        ];

    const result =
        buildTemporalValidation([...training, ...validation]);

    assert.strictEqual(result.sampleSize, 30);

    assert.strictEqual(result.trainingSize, 24);

    assert.strictEqual(result.validationSize, 6);

    assert.strictEqual(result.insufficientData, false);

    assert.strictEqual(result.linear.training.maeHours, 3.8);

    assert.strictEqual(result.linear.validation.maeHours, 5.1);

    assert.strictEqual(result.linear.generalizationGapHours, 1.3);

    assert.strictEqual(result.exponential.training.maeHours, 2.1);

    assert.strictEqual(result.exponential.validation.maeHours, 9.8);

    assert.ok(Math.abs(result.exponential.generalizationGapHours - 7.7) < 1e-9);

    assert.strictEqual(result.bestValidationModel, "LINEAR");

});

test("buildTemporalValidation(): respeta el orden de entrada (no vuelve a ordenar) — responsabilidad del servicio", () => {

    // Si le pasamos un arreglo ya ordenado descendente por error, debe
    // dividir tal cual está, sin reordenar internamente.
    const batches =
        [
            evaluatedBatch(1, 10, 10),
            evaluatedBatch(2, 1, 1),
            evaluatedBatch(3, 1, 1),
            evaluatedBatch(4, 1, 1),
            evaluatedBatch(5, 1, 1),
            evaluatedBatch(6, 1, 1),
            evaluatedBatch(7, 1, 1),
            evaluatedBatch(8, 1, 1),
            evaluatedBatch(9, 1, 1),
            evaluatedBatch(10, 1, 1)
        ];

    const result =
        buildTemporalValidation(batches);

    // trainingSize=8, validationSize=2 -> por debajo del mínimo de
    // validación (3), debe marcar insuficiente sin importar el
    // contenido de los errores.
    assert.strictEqual(result.insufficientData, true);

});

test("buildTemporalValidation(): con 11 lotes (mínimo para pasar ambos umbrales) sí calcula resultados", () => {

    const batches =
        Array.from({ length: 11 }, (_, i) => evaluatedBatch(i, 2, 2));

    const result =
        buildTemporalValidation(batches);

    assert.strictEqual(result.trainingSize, 8);

    assert.strictEqual(result.validationSize, 3);

    assert.strictEqual(result.insufficientData, false);

});

test("buildTemporalValidation(): los umbrales mínimos son configurables", () => {

    const batches =
        Array.from({ length: 7 }, (_, i) => evaluatedBatch(i, 2, 2));

    const withDefaults =
        buildTemporalValidation(batches);

    assert.strictEqual(withDefaults.insufficientData, true);

    const withLowerMinimums =
        buildTemporalValidation(batches, { minTrainingBatches: 5, minValidationBatches: 2 });

    assert.strictEqual(withLowerMinimums.insufficientData, false);

});

test("buildTemporalValidation(): detecta sobreajuste — el modelo con mejor entrenamiento puede perder en validación", () => {

    const training =
        Array.from({ length: 8 }, (_, i) => evaluatedBatch(i, 3.8, 2.1)); // exponencial gana en entrenamiento

    const validation =
        [
            evaluatedBatch(100, 5.1, 9.8),
            evaluatedBatch(101, 5.1, 9.8),
            evaluatedBatch(102, 5.1, 9.8)
        ]; // lineal gana en validación

    const result =
        buildTemporalValidation([...training, ...validation]);

    assert.strictEqual(result.exponential.training.maeHours < result.linear.training.maeHours, true);

    assert.strictEqual(result.bestValidationModel, "LINEAR");

    assert.ok(result.exponential.generalizationGapHours > result.linear.generalizationGapHours);

});

test("constantes exportadas: DEFAULT_TRAINING_RATIO=0.8, MIN_TRAINING_BATCHES=5, MIN_VALIDATION_BATCHES=3", () => {

    assert.strictEqual(DEFAULT_TRAINING_RATIO, 0.8);

    assert.strictEqual(MIN_TRAINING_BATCHES, 5);

    assert.strictEqual(MIN_VALIDATION_BATCHES, 3);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
