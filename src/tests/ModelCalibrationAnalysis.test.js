const assert =
    require("assert");

const ModelCalibrationAnalysis =
    require("../utils/ModelCalibrationAnalysis");

const ModelAccuracyMetrics =
    require("../utils/ModelAccuracyMetrics");

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

console.log("ModelCalibrationAnalysis tests\n");

// --- computeDirectionConsistency (sección 5/10) ---

test("directionConsistency: EARLY 80%/LATE 15%/EXACT 5% -> 80% (dominante, no suma EXACT)", () => {

    assert.strictEqual(ModelCalibrationAnalysis.computeDirectionConsistency(80, 15), 80);

});

test("directionConsistency: reproduce el ejemplo de la sección 8 (77.8%)", () => {

    assert.strictEqual(ModelCalibrationAnalysis.computeDirectionConsistency(77.8, 16.7), 77.8);

});

test("directionConsistency: LATE dominante -> usa LATE, no EARLY", () => {

    assert.strictEqual(ModelCalibrationAnalysis.computeDirectionConsistency(20, 66.67), 66.67);

});

// --- classifyBias (secciones 3/4) ---

test("classifyBias: N < 5 -> INSUFFICIENT_DATA sin importar el Bias", () => {

    assert.strictEqual(ModelCalibrationAnalysis.classifyBias(4, 5.0), "INSUFFICIENT_DATA");
    assert.strictEqual(ModelCalibrationAnalysis.classifyBias(0, 0), "INSUFFICIENT_DATA");

});

test("classifyBias: N >= 5, Bias = +2.3h -> EARLY_BIASED (ejemplo sección 3)", () => {

    assert.strictEqual(ModelCalibrationAnalysis.classifyBias(10, 2.3), "EARLY_BIASED");

});

test("classifyBias: N >= 5, Bias = -2.8h -> LATE_BIASED (ejemplo sección 3)", () => {

    assert.strictEqual(ModelCalibrationAnalysis.classifyBias(10, -2.8), "LATE_BIASED");

});

test("classifyBias: N >= 5, Bias = +0.2h -> WELL_CALIBRATED (ejemplo sección 3)", () => {

    assert.strictEqual(ModelCalibrationAnalysis.classifyBias(10, 0.2), "WELL_CALIBRATED");

});

test("classifyBias: umbral exacto ±0.5h -> WELL_CALIBRATED (límite inclusivo)", () => {

    assert.strictEqual(ModelCalibrationAnalysis.classifyBias(10, 0.5), "WELL_CALIBRATED");
    assert.strictEqual(ModelCalibrationAnalysis.classifyBias(10, -0.5), "WELL_CALIBRATED");

});

test("classifyBias: apenas fuera del umbral -> EARLY_BIASED / LATE_BIASED", () => {

    assert.strictEqual(ModelCalibrationAnalysis.classifyBias(10, 0.51), "EARLY_BIASED");
    assert.strictEqual(ModelCalibrationAnalysis.classifyBias(10, -0.51), "LATE_BIASED");

});

// --- buildCalibrationRecommendation (sección 6) ---

test("calibrationRecommendation: las tres condiciones se cumplen -> recommended=true, offset=Bias", () => {

    const rec =
        ModelCalibrationAnalysis.buildCalibrationRecommendation({

            sampleSize: 18,

            biasHours: 1.8,

            directionConsistency: 77.8

        });

    assert.strictEqual(rec.recommended, true);
    assert.strictEqual(rec.offsetHours, 1.8);

});

test("calibrationRecommendation: muestra insuficiente (N<5) -> nunca recomienda aunque el resto cumpla", () => {

    const rec =
        ModelCalibrationAnalysis.buildCalibrationRecommendation({

            sampleSize: 4,

            biasHours: 3.0,

            directionConsistency: 100

        });

    assert.strictEqual(rec.recommended, false);
    assert.strictEqual(rec.offsetHours, null);

});

test("calibrationRecommendation: consistencia < 70% -> no recomienda aunque el Bias sea grande", () => {

    const rec =
        ModelCalibrationAnalysis.buildCalibrationRecommendation({

            sampleSize: 10,

            biasHours: 3.0,

            directionConsistency: 60

        });

    assert.strictEqual(rec.recommended, false);

});

test("calibrationRecommendation: |Bias| <= 0.5h -> no recomienda aunque la consistencia sea alta", () => {

    const rec =
        ModelCalibrationAnalysis.buildCalibrationRecommendation({

            sampleSize: 10,

            biasHours: 0.3,

            directionConsistency: 90

        });

    assert.strictEqual(rec.recommended, false);

});

// --- reproduce el ejemplo JSON completo de la sección 6 ---

test("summarizeCalibration: reproduce el ejemplo LINEAR completo de la sección 6", () => {

    const modelMetrics = {

        modelType: "LINEAR",

        sampleSize: 18,

        maeHours: 3.2,

        rmseHours: 4.7,

        biasHours: 1.8,

        earlyPercentage: 77.8,

        latePercentage: 16.7,

        exactPercentage: 5.5

    };

    const summary =
        ModelCalibrationAnalysis.summarizeCalibration(modelMetrics);

    assert.strictEqual(summary.modelType, "LINEAR");
    assert.strictEqual(summary.sampleSize, 18);
    assert.strictEqual(summary.directionConsistency, 77.8);
    assert.strictEqual(summary.biasClassification, "EARLY_BIASED");
    assert.strictEqual(summary.calibrationRecommendation.recommended, true);
    assert.strictEqual(summary.calibrationRecommendation.offsetHours, 1.8);

    // métricas originales deben preservarse intactas (nunca se
    // recalculan) -- criterio "reutilizar las métricas existentes"
    assert.strictEqual(summary.maeHours, 3.2);
    assert.strictEqual(summary.rmseHours, 4.7);
    assert.strictEqual(summary.biasHours, 1.8);

});

test("summarizeCalibration: modelo WELL_CALIBRATED (Bias -0.2h, sección 10)", () => {

    const modelMetrics = {

        modelType: "EXPONENTIAL",

        sampleSize: 15,

        maeHours: 4.5,

        rmseHours: 7.1,

        biasHours: -0.2,

        earlyPercentage: 26,

        latePercentage: 48,

        exactPercentage: 26

    };

    const summary =
        ModelCalibrationAnalysis.summarizeCalibration(modelMetrics);

    assert.strictEqual(summary.biasClassification, "WELL_CALIBRATED");
    assert.strictEqual(summary.calibrationRecommendation.recommended, false);
    assert.strictEqual(summary.calibrationRecommendation.offsetHours, null);
    assert.strictEqual(summary.interpretation.recommendationMessage, "No requiere calibración.");

});

// --- sección 2: patrón consistente reproducido de punta a punta ---

test("sección 2: errores [+2.1,+1.8,+2.5,+2.0,+1.6,+2.3] -> Bias~+2.05h, 100% EARLY, calibración recomendada", () => {

    const errors =
        [2.1, 1.8, 2.5, 2.0, 1.6, 2.3];

    // Todos claramente EARLY (> umbral EXACT de 0.25h de 2.6.1.13)
    const evaluations =
        errors.map(e => ({ errorHours: e, direction: "EARLY" }));

    const modelMetrics =
        ModelAccuracyMetrics.summarizeModelAccuracy("LINEAR", evaluations);

    const summary =
        ModelCalibrationAnalysis.summarizeCalibration(modelMetrics);

    assert.strictEqual(summary.sampleSize, 6);
    assert.strictEqual(summary.biasHours, 2.05);
    assert.strictEqual(summary.directionConsistency, 100);
    assert.strictEqual(summary.biasClassification, "EARLY_BIASED");
    assert.strictEqual(summary.calibrationRecommendation.recommended, true);
    assert.strictEqual(summary.calibrationRecommendation.offsetHours, 2.05);

});

// --- sección 5: Bias=0 no implica precisión (errores dispersos) ---

test("sección 5: errores [+10,-10,0,0,0] -> Bias=0 (WELL_CALIBRATED) pero MAE alto y consistencia baja", () => {

    const evaluations = [

        { errorHours: 10, direction: "EARLY" },

        { errorHours: -10, direction: "LATE" },

        { errorHours: 0, direction: "EXACT" },

        { errorHours: 0, direction: "EXACT" },

        { errorHours: 0, direction: "EXACT" }

    ];

    const modelMetrics =
        ModelAccuracyMetrics.summarizeModelAccuracy("LINEAR", evaluations);

    const summary =
        ModelCalibrationAnalysis.summarizeCalibration(modelMetrics);

    assert.strictEqual(summary.biasHours, 0);
    assert.strictEqual(summary.maeHours, 4, "el MAE revela que el modelo no es preciso pese al Bias de 0");
    assert.strictEqual(summary.biasClassification, "WELL_CALIBRATED", "sin tendencia sistemática de dirección, la clasificación de Bias sigue siendo WELL_CALIBRATED");
    assert.strictEqual(summary.directionConsistency, 20, "la consistencia direccional (20%) expone que los errores no van todos en una dirección");
    assert.strictEqual(summary.calibrationRecommendation.recommended, false);

});

// --- interpretación (sección 9) ---

test("buildInterpretation: EARLY_BIASED", () => {

    const { headline, recommendationMessage } =
        ModelCalibrationAnalysis.buildInterpretation("EARLY_BIASED", { recommended: true, offsetHours: 1.8 });

    assert.strictEqual(headline, "El modelo tiende a predecir la maduración antes de lo que ocurre realmente.");
    assert.strictEqual(recommendationMessage, "Considerar una calibración de +1.8 horas.");

});

test("buildInterpretation: LATE_BIASED", () => {

    const { headline } =
        ModelCalibrationAnalysis.buildInterpretation("LATE_BIASED", { recommended: true, offsetHours: -2.8 });

    assert.strictEqual(headline, "El modelo tiende a predecir la maduración después de lo que ocurre realmente.");

});

test("buildInterpretation: WELL_CALIBRATED nunca recomienda calibración", () => {

    const { recommendationMessage } =
        ModelCalibrationAnalysis.buildInterpretation("WELL_CALIBRATED", { recommended: false, offsetHours: null });

    assert.strictEqual(recommendationMessage, "No requiere calibración.");

});

test("buildInterpretation: INSUFFICIENT_DATA tiene su propio mensaje, distinto de WELL_CALIBRATED", () => {

    const insufficient =
        ModelCalibrationAnalysis.buildInterpretation("INSUFFICIENT_DATA", { recommended: false, offsetHours: null });

    const wellCalibrated =
        ModelCalibrationAnalysis.buildInterpretation("WELL_CALIBRATED", { recommended: false, offsetHours: null });

    assert.notStrictEqual(insufficient.headline, wellCalibrated.headline);

});

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {

    process.exit(1);

}
