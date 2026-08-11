const assert =
    require("assert");

const PredictionEvaluation =
    require("../utils/PredictionEvaluation");

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

console.log("PredictionEvaluation tests\n");

// --- computeErrorHours / sign convention (sección 3) ---

test("errorHours: real después de lo predicho -> positivo (predicción adelantada)", () => {

    const errorHours =
        PredictionEvaluation.computeErrorHours(

            "2026-08-09T10:00:00.000Z",

            "2026-08-09T13:00:00.000Z"

        );

    assert.strictEqual(errorHours, 3);

});

test("errorHours: real antes de lo predicho -> negativo (predicción retrasada)", () => {

    const errorHours =
        PredictionEvaluation.computeErrorHours(

            "2026-08-09T13:00:00.000Z",

            "2026-08-09T10:00:00.000Z"

        );

    assert.strictEqual(errorHours, -3);

});

// --- ejemplo de la sección 1 ---

test("ejemplo sección 1: predicción 11:00, real 13:30 -> error = +2.5h, EARLY", () => {

    const result =
        PredictionEvaluation.evaluatePrediction({

            predictedMaturationAt: "2026-08-09T11:00:00.000Z",

            predictedDurationHours: null,

            actualMaturationAt: "2026-08-09T13:30:00.000Z"

        });

    assert.strictEqual(result.status, "EVALUATED");
    assert.strictEqual(result.errorHours, 2.5);
    assert.strictEqual(result.absoluteErrorHours, 2.5);
    assert.strictEqual(result.direction, "EARLY");

});

// --- dirección: EARLY / LATE / EXACT ---

test("direction: error > +umbral -> EARLY", () => {

    assert.strictEqual(PredictionEvaluation.determineDirection(3), "EARLY");

});

test("direction: error < -umbral -> LATE", () => {

    assert.strictEqual(PredictionEvaluation.determineDirection(-3), "LATE");

});

test("direction: |error| <= 0.25h -> EXACT (justo en el borde superior)", () => {

    assert.strictEqual(PredictionEvaluation.determineDirection(0.25), "EXACT");

});

test("direction: |error| <= 0.25h -> EXACT (justo en el borde inferior)", () => {

    assert.strictEqual(PredictionEvaluation.determineDirection(-0.25), "EXACT");

});

test("direction: error de pocos minutos (0.1h) -> EXACT, no error significativo", () => {

    assert.strictEqual(PredictionEvaluation.determineDirection(0.1), "EXACT");

});

test("direction: apenas fuera del umbral (0.26h) -> EARLY", () => {

    assert.strictEqual(PredictionEvaluation.determineDirection(0.26), "EARLY");

});

test("direction: apenas fuera del umbral (-0.26h) -> LATE", () => {

    assert.strictEqual(PredictionEvaluation.determineDirection(-0.26), "LATE");

});

// --- errorPercentage (sección 5) ---

test("errorPercentage: duración real 100h, error 4h -> 4%", () => {

    // predictedDurationHours + errorHours = actualDurationHours = 100
    // => predictedDurationHours = 96, errorHours = 4
    const percentage =
        PredictionEvaluation.computeErrorPercentage(96, 4, 4);

    assert.strictEqual(percentage, 4);

});

test("errorPercentage: sin predictedDurationHours -> null (no se fabrica con otra referencia)", () => {

    const percentage =
        PredictionEvaluation.computeErrorPercentage(null, 4, 4);

    assert.strictEqual(percentage, null);

});

test("errorPercentage: actualDurationHours <= 0 -> null", () => {

    // predictedDurationHours=2, errorHours=-3 => actualDurationHours=-1
    const percentage =
        PredictionEvaluation.computeErrorPercentage(2, 3, -3);

    assert.strictEqual(percentage, null);

});

// --- evaluatePrediction: sección 6, ejemplo JSON completo ---

test("evaluatePrediction: reproduce el ejemplo JSON de la sección 6 (errorPercentage ~2.71%)", () => {

    // predictedDurationHours tal que actualDurationHours ~ 92.25h,
    // consistente con errorHours=2.5 -> 2.5/92.25*100 ~ 2.71%
    const result =
        PredictionEvaluation.evaluatePrediction({

            predictedMaturationAt: "2026-08-09T11:00:00.000Z",

            predictedDurationHours: 89.75,

            actualMaturationAt: "2026-08-09T13:30:00.000Z"

        });

    assert.strictEqual(result.status, "EVALUATED");
    assert.strictEqual(result.errorHours, 2.5);
    assert.strictEqual(result.absoluteErrorHours, 2.5);
    assert.strictEqual(result.direction, "EARLY");
    assert.strictEqual(result.errorPercentage, 2.71);

});

// --- casos PENDING / UNAVAILABLE (secciones 14/15) ---

test("evaluatePrediction: sin actualMaturationAt -> PENDING (nunca error 0 / EXACT)", () => {

    const result =
        PredictionEvaluation.evaluatePrediction({

            predictedMaturationAt: "2026-08-09T11:00:00.000Z",

            predictedDurationHours: 48,

            actualMaturationAt: null

        });

    assert.strictEqual(result.status, "PENDING");
    assert.strictEqual(result.errorHours, null);
    assert.strictEqual(result.direction, null);

});

test("evaluatePrediction: PENDING nunca se confunde con EXACT", () => {

    const pending =
        PredictionEvaluation.evaluatePrediction({

            predictedMaturationAt: "2026-08-09T11:00:00.000Z",

            predictedDurationHours: 48,

            actualMaturationAt: null

        });

    assert.notStrictEqual(pending.status, "EXACT");
    assert.notStrictEqual(pending.direction, "EXACT");

});

test("evaluatePrediction: hay actual pero la predicción no tenía ETA -> UNAVAILABLE", () => {

    const result =
        PredictionEvaluation.evaluatePrediction({

            predictedMaturationAt: null,

            predictedDurationHours: null,

            actualMaturationAt: "2026-08-09T13:30:00.000Z"

        });

    assert.strictEqual(result.status, "UNAVAILABLE");
    assert.strictEqual(result.errorHours, null);

});

// --- predicción retrasada (sección 3, segundo ejemplo) ---

test("predicción retrasada: predicción 13:00, real 10:00 -> error = -3h, LATE", () => {

    const result =
        PredictionEvaluation.evaluatePrediction({

            predictedMaturationAt: "2026-08-09T13:00:00.000Z",

            predictedDurationHours: null,

            actualMaturationAt: "2026-08-09T10:00:00.000Z"

        });

    assert.strictEqual(result.errorHours, -3);
    assert.strictEqual(result.direction, "LATE");

});

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {

    process.exit(1);

}
