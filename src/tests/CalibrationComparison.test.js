const assert =
    require("assert");

const CalibrationComparison =
    require("../utils/CalibrationComparison");

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

console.log("CalibrationComparison tests\n");

// --- classifyEvaluationConfidence (sección 10) ---

test("classifyEvaluationConfidence: N < 10 -> LOW", () => {

    assert.strictEqual(CalibrationComparison.classifyEvaluationConfidence(0), "LOW");
    assert.strictEqual(CalibrationComparison.classifyEvaluationConfidence(9), "LOW");

});

test("classifyEvaluationConfidence: 10 <= N < 20 -> MEDIUM", () => {

    assert.strictEqual(CalibrationComparison.classifyEvaluationConfidence(10), "MEDIUM");
    assert.strictEqual(CalibrationComparison.classifyEvaluationConfidence(19), "MEDIUM");

});

test("classifyEvaluationConfidence: N >= 20 -> HIGH", () => {

    assert.strictEqual(CalibrationComparison.classifyEvaluationConfidence(20), "HIGH");
    assert.strictEqual(CalibrationComparison.classifyEvaluationConfidence(32), "HIGH");

});

// --- buildWarnings (sección 9) ---

test("buildWarnings: reproduce el ejemplo de la sección 9 (N=5 -> advertencia nombrando esa calibración)", () => {

    const warnings =
        CalibrationComparison.buildWarnings({

            labelA: "Calibration #7", sampleSizeA: 32,
            labelB: "Calibration #8", sampleSizeB: 5

        });

    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes("Calibration #8"));
    assert.ok(warnings[0].includes("5 evaluaciones"));
    assert.ok(warnings[0].includes("todavía no es concluyente"));

});

test("buildWarnings: ambas con evidencia baja -> dos advertencias, una por cada calibración", () => {

    const warnings =
        CalibrationComparison.buildWarnings({

            labelA: "Calibration #10", sampleSizeA: 3,
            labelB: "Calibration #11", sampleSizeB: 8

        });

    assert.strictEqual(warnings.length, 2);
    assert.ok(warnings[0].includes("Calibration #10"));
    assert.ok(warnings[1].includes("Calibration #11"));

});

test("buildWarnings: ambas con evidencia suficiente pero muy dispares (2x) -> advertencia de tamaños distintos", () => {

    const warnings =
        CalibrationComparison.buildWarnings({

            labelA: "Calibration #7", sampleSizeA: 40,
            labelB: "Calibration #8", sampleSizeB: 15

        });

    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes("tamaños de muestra muy distintos"));

});

test("buildWarnings: ambas con evidencia suficiente y comparables -> sin advertencias", () => {

    const warnings =
        CalibrationComparison.buildWarnings({

            labelA: "Calibration #7", sampleSizeA: 25,
            labelB: "Calibration #8", sampleSizeB: 22

        });

    assert.strictEqual(warnings.length, 0);

});

test("buildWarnings: una calibración sin ninguna evaluación (N=0) -> advertencia de evidencia baja, nunca división por cero", () => {

    const warnings =
        CalibrationComparison.buildWarnings({

            labelA: "Calibration #7", sampleSizeA: 20,
            labelB: "Calibration #9", sampleSizeB: 0

        });

    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes("Calibration #9"));
    assert.ok(warnings[0].includes("0 evaluaciones"));

});

// --- buildSummary (sección 8) ---

test("buildSummary: reproduce el ejemplo de la sección 8 (menor MAE y menor Bias)", () => {

    const summary =
        CalibrationComparison.buildSummary({

            labelA: "Calibration #7", maeHoursA: 2.1, biasHoursA: 0.9,
            labelB: "Calibration #8", maeHoursB: 1.6, biasHoursB: 0.2

        });

    assert.strictEqual(summary, "Calibration #8 presenta menor MAE y menor Bias que Calibration #7.");

});

test("buildSummary: MAE mejora pero Bias empeora -> se menciona el matiz, no se oculta", () => {

    const summary =
        CalibrationComparison.buildSummary({

            labelA: "Calibration #7", maeHoursA: 2.1, biasHoursA: 0.2,
            labelB: "Calibration #8", maeHoursB: 1.6, biasHoursB: 1.5

        });

    assert.strictEqual(summary, "Calibration #8 presenta menor MAE que Calibration #7, pero un Bias mayor.");

});

test("buildSummary: A mejor que B (orden inverso al ejemplo) -> nombra correctamente al ganador", () => {

    const summary =
        CalibrationComparison.buildSummary({

            labelA: "Calibration #7", maeHoursA: 1.4, biasHoursA: 0.1,
            labelB: "Calibration #8", maeHoursB: 2.9, biasHoursB: 0.3

        });

    assert.strictEqual(summary, "Calibration #7 presenta menor MAE que Calibration #8.");

});

test("buildSummary: sin evaluaciones en alguno de los dos -> mensaje explícito, nunca un número inventado", () => {

    const summary =
        CalibrationComparison.buildSummary({

            labelA: "Calibration #7", maeHoursA: 2.1, biasHoursA: 0.3,
            labelB: "Calibration #9", maeHoursB: null, biasHoursB: null

        });

    assert.strictEqual(summary, "No hay suficientes evaluaciones para comparar Calibration #7 y Calibration #9 todavía.");

});

// --- buildComparison: forma completa ---

test("buildComparison: arma la forma completa de la tabla + resumen + advertencias del ejemplo de las secciones 8/9", () => {

    const result =
        CalibrationComparison.buildComparison(

            { calibrationId: 7, offsetHours: 2.4, sampleSize: 32, maeHours: 2.1, rmseHours: 2.8, biasHours: 0.9, status: "INACTIVE" },

            { calibrationId: 8, offsetHours: 1.7, sampleSize: 5, maeHours: 1.6, rmseHours: 2.1, biasHours: 0.2, status: "ACTIVE" }

        );

    assert.strictEqual(result.calibrations[0].evaluationConfidence, "HIGH");
    assert.strictEqual(result.calibrations[1].evaluationConfidence, "LOW");
    assert.strictEqual(result.summary, "Calibration #8 presenta menor MAE y menor Bias que Calibration #7.");
    assert.strictEqual(result.warnings.length, 1);
    assert.ok(result.warnings[0].includes("Calibration #8"));

});

console.log(`\n${passed} pasaron, ${failed} fallaron.`);

if (failed > 0) {

    process.exit(1);

}
