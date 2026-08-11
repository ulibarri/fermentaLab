const assert =
    require("assert");

const CalibrationEffectiveness =
    require("../utils/CalibrationEffectiveness");

const ModelAccuracyMetrics =
    require("../utils/ModelAccuracyMetrics");

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

console.log("CalibrationEffectiveness tests\n");

// --- computeImprovement (sección 7/18) ---

test("computeImprovement: reproduce el ejemplo de la sección 7 (3.2h -> 1.8h = 43.75%)", () => {

    const result =
        CalibrationEffectiveness.computeImprovement(3.2, 1.8);

    assert.strictEqual(result.maeImprovementHours, 1.4);

    assert.strictEqual(result.maeImprovementPercentage, 43.75);

});

test("computeImprovement: empeora cuando maeCalibrated > maeRaw (porcentaje negativo)", () => {

    const result =
        CalibrationEffectiveness.computeImprovement(2.0, 3.0);

    assert.strictEqual(result.maeImprovementHours, -1);

    assert.strictEqual(result.maeImprovementPercentage, -50);

});

test("computeImprovement: sin cambio da 0h / 0%", () => {

    const result =
        CalibrationEffectiveness.computeImprovement(2.5, 2.5);

    assert.strictEqual(result.maeImprovementHours, 0);

    assert.strictEqual(result.maeImprovementPercentage, 0);

});

test("computeImprovement: maeRaw null -> ambos null (nunca se fabrica un porcentaje)", () => {

    const result =
        CalibrationEffectiveness.computeImprovement(null, 1.8);

    assert.strictEqual(result.maeImprovementHours, null);

    assert.strictEqual(result.maeImprovementPercentage, null);

});

test("computeImprovement: maeRaw=0 -> porcentaje null (nunca divide entre cero)", () => {

    const result =
        CalibrationEffectiveness.computeImprovement(0, 0.5);

    assert.strictEqual(result.maeImprovementHours, -0.5);

    assert.strictEqual(result.maeImprovementPercentage, null);

});

// --- classifyResult (sección 8) ---

test("classifyResult: sampleSize=0 -> INSUFFICIENT_DATA sin importar el porcentaje", () => {

    assert.strictEqual(CalibrationEffectiveness.classifyResult(0, 90), "INSUFFICIENT_DATA");

});

test("classifyResult: mejora > 5% -> IMPROVED (ejemplo de la sección 7: 43.75%)", () => {

    assert.strictEqual(CalibrationEffectiveness.classifyResult(12, 43.75), "IMPROVED");

});

test("classifyResult: empeora > 5% -> DEGRADED", () => {

    assert.strictEqual(CalibrationEffectiveness.classifyResult(10, -12), "DEGRADED");

});

test("classifyResult: dentro de -5%..+5% -> NO_SIGNIFICANT_CHANGE", () => {

    assert.strictEqual(CalibrationEffectiveness.classifyResult(10, 3), "NO_SIGNIFICANT_CHANGE");

    assert.strictEqual(CalibrationEffectiveness.classifyResult(10, -3), "NO_SIGNIFICANT_CHANGE");

});

test("classifyResult: exactamente en el borde (+5%/-5%) -> NO_SIGNIFICANT_CHANGE, no IMPROVED/DEGRADED", () => {

    assert.strictEqual(CalibrationEffectiveness.classifyResult(10, 5), "NO_SIGNIFICANT_CHANGE");

    assert.strictEqual(CalibrationEffectiveness.classifyResult(10, -5), "NO_SIGNIFICANT_CHANGE");

});

test("classifyResult: porcentaje null con muestra > 0 -> NO_SIGNIFICANT_CHANGE (caso límite maeRaw=0)", () => {

    assert.strictEqual(CalibrationEffectiveness.classifyResult(5, null), "NO_SIGNIFICANT_CHANGE");

});

// --- buildEvaluation: reproduce el ejemplo JSON completo de la sección 10 ---

test("buildEvaluation: reproduce exactamente el ejemplo de la sección 10 (LINEAR, calibration #7)", () => {

    const raw = {

        modelType: "RAW", sampleSize: 12, maeHours: 3.2, rmseHours: 4.1, biasHours: 2.7,
        earlyPercentage: 83.3, latePercentage: 8.3, exactPercentage: 8.4

    };

    const calibrated = {

        modelType: "CALIBRATED", sampleSize: 12, maeHours: 1.8, rmseHours: 2.3, biasHours: 0.3,
        earlyPercentage: 50, latePercentage: 41.7, exactPercentage: 8.3

    };

    const evaluation =
        CalibrationEffectiveness.buildEvaluation({

            calibrationId: 7, modelType: "LINEAR", recipeVersionId: 3, raw, calibrated

        });

    assert.strictEqual(evaluation.calibrationId, 7);
    assert.strictEqual(evaluation.modelType, "LINEAR");
    assert.strictEqual(evaluation.recipeVersionId, 3);
    assert.strictEqual(evaluation.evaluationSampleSize, 12);

    assert.deepStrictEqual(evaluation.raw, {

        maeHours: 3.2, rmseHours: 4.1, biasHours: 2.7, earlyPercentage: 83.3, latePercentage: 8.3, exactPercentage: 8.4

    });

    assert.deepStrictEqual(evaluation.calibrated, {

        maeHours: 1.8, rmseHours: 2.3, biasHours: 0.3, earlyPercentage: 50, latePercentage: 41.7, exactPercentage: 8.3

    });

    assert.strictEqual(evaluation.maeImprovementPercentage, 43.75);

    assert.strictEqual(evaluation.maeImprovementHours, 1.4);

    assert.strictEqual(evaluation.result, "IMPROVED");

});

test("buildEvaluation: sampleSize 0 -> INSUFFICIENT_DATA, raw/calibrated en null (nunca ceros fabricados)", () => {

    const raw = { modelType: "RAW", sampleSize: 0, maeHours: null, rmseHours: null, biasHours: null, earlyPercentage: null, latePercentage: null, exactPercentage: null };
    const calibrated = { modelType: "CALIBRATED", sampleSize: 0, maeHours: null, rmseHours: null, biasHours: null, earlyPercentage: null, latePercentage: null, exactPercentage: null };

    const evaluation =
        CalibrationEffectiveness.buildEvaluation({ calibrationId: 9, modelType: "EXPONENTIAL", recipeVersionId: 5, raw, calibrated });

    assert.strictEqual(evaluation.evaluationSampleSize, 0);
    assert.strictEqual(evaluation.raw, null);
    assert.strictEqual(evaluation.calibrated, null);
    assert.strictEqual(evaluation.maeImprovementHours, null);
    assert.strictEqual(evaluation.maeImprovementPercentage, null);
    assert.strictEqual(evaluation.result, "INSUFFICIENT_DATA");

});

// --- Reproduce el ejemplo de la sección 5 (una sola predicción) usando
//     el flujo real: PredictionEvaluation.computeErrorHours() para cada
//     escenario -> ModelAccuracyMetrics.summarizeModelAccuracy() ->
//     CalibrationEffectiveness.buildEvaluation() -- prueba end-to-end
//     puramente funcional (sin repositorios), confirmando que los tres
//     módulos encajan como el servicio los compondrá.
test("flujo completo: ejemplo de la sección 5 (real 10:00, raw 07:00, offset +2h -> calibrada 09:00)", () => {

    const actual = "2026-08-05T10:00:00.000Z";
    const raw = "2026-08-05T07:00:00.000Z";
    const calibratedPrediction = "2026-08-05T09:00:00.000Z"; // raw + 2h

    const errorRaw =
        PredictionEvaluation.computeErrorHours(raw, actual);

    const errorCalibrated =
        PredictionEvaluation.computeErrorHours(calibratedPrediction, actual);

    assert.strictEqual(errorRaw, 3);
    assert.strictEqual(errorCalibrated, 1);

    const rawSummary =
        ModelAccuracyMetrics.summarizeModelAccuracy("RAW", [
            { errorHours: errorRaw, direction: PredictionEvaluation.determineDirection(errorRaw) }
        ]);

    const calibratedSummary =
        ModelAccuracyMetrics.summarizeModelAccuracy("CALIBRATED", [
            { errorHours: errorCalibrated, direction: PredictionEvaluation.determineDirection(errorCalibrated) }
        ]);

    const evaluation =
        CalibrationEffectiveness.buildEvaluation({

            calibrationId: 1, modelType: "LINEAR", recipeVersionId: 3,
            raw: rawSummary, calibrated: calibratedSummary

        });

    assert.strictEqual(evaluation.raw.maeHours, 3);
    assert.strictEqual(evaluation.calibrated.maeHours, 1);
    assert.strictEqual(evaluation.maeImprovementHours, 2);
    assert.strictEqual(evaluation.result, "IMPROVED");

});

console.log(`\n${passed} pasaron, ${failed} fallaron.`);

if (failed > 0) {

    process.exit(1);

}
