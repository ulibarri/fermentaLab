const assert =
    require("assert");

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

console.log("ModelAccuracyMetrics tests\n");

// --- MAE (sección 2) ---

test("MAE: [2,4,1,3] -> 2.5", () => {

    assert.strictEqual(ModelAccuracyMetrics.computeMAE([2, 4, 1, 3]), 2.5);

});

test("MAE: usa valor absoluto (errores negativos no se cancelan)", () => {

    assert.strictEqual(ModelAccuracyMetrics.computeMAE([-2, 4, -1, 3]), 2.5);

});

test("MAE: arreglo vacío -> null", () => {

    assert.strictEqual(ModelAccuracyMetrics.computeMAE([]), null);

});

// --- RMSE (sección 3) ---

test("RMSE: [1,2,2,10] penaliza el error grande más que el MAE", () => {

    const mae =
        ModelAccuracyMetrics.computeMAE([1, 2, 2, 10]);

    const rmse =
        ModelAccuracyMetrics.computeRMSE([1, 2, 2, 10]);

    // MAE = (1+2+2+10)/4 = 3.75
    assert.strictEqual(mae, 3.75);

    // RMSE = sqrt((1+4+4+100)/4) = sqrt(27.25) ~ 5.220...
    assert.ok(Math.abs(rmse - Math.sqrt(27.25)) < 1e-9);

    assert.ok(rmse > mae, "RMSE debe ser mayor que MAE cuando hay un error atípico grande");

});

test("RMSE: arreglo vacío -> null", () => {

    assert.strictEqual(ModelAccuracyMetrics.computeRMSE([]), null);

});

// --- Bias (sección 4) ---

test("Bias: [+2,+3,+1,+2] -> +2 (tendencia a predecir antes)", () => {

    assert.strictEqual(ModelAccuracyMetrics.computeBias([2, 3, 1, 2]), 2);

});

test("Bias: errores negativos -> bias negativo (tendencia a predecir tarde)", () => {

    assert.strictEqual(ModelAccuracyMetrics.computeBias([-2, -3, -1, -2]), -2);

});

test("Bias: MAE y Bias difieren cuando los errores tienen signos mixtos", () => {

    const errors =
        [3, -3, 3, -3];

    assert.strictEqual(ModelAccuracyMetrics.computeMAE(errors), 3);

    assert.strictEqual(ModelAccuracyMetrics.computeBias(errors), 0);

});

// --- clasificación de muestra (sección 10) ---

test("classifySampleSize: N < 5 -> LOW_SAMPLE", () => {

    assert.strictEqual(ModelAccuracyMetrics.classifySampleSize(1), "LOW_SAMPLE");
    assert.strictEqual(ModelAccuracyMetrics.classifySampleSize(4), "LOW_SAMPLE");

});

test("classifySampleSize: N >= 5 -> SUFFICIENT_SAMPLE", () => {

    assert.strictEqual(ModelAccuracyMetrics.classifySampleSize(5), "SUFFICIENT_SAMPLE");
    assert.strictEqual(ModelAccuracyMetrics.classifySampleSize(100), "SUFFICIENT_SAMPLE");

});

// --- distribución EARLY/LATE/EXACT (sección 5) ---

test("distribución: 14 EARLY, 5 LATE, 1 EXACT de 20 -> 70%/25%/5%", () => {

    const evaluations = [

        ...Array(14).fill({ errorHours: 1, direction: "EARLY" }),

        ...Array(5).fill({ errorHours: -1, direction: "LATE" }),

        ...Array(1).fill({ errorHours: 0.1, direction: "EXACT" })

    ];

    const summary =
        ModelAccuracyMetrics.summarizeModelAccuracy("LINEAR", evaluations);

    assert.strictEqual(summary.sampleSize, 20);
    assert.strictEqual(summary.earlyCount, 14);
    assert.strictEqual(summary.lateCount, 5);
    assert.strictEqual(summary.exactCount, 1);
    assert.strictEqual(summary.earlyPercentage, 70);
    assert.strictEqual(summary.latePercentage, 25);
    assert.strictEqual(summary.exactPercentage, 5);

});

// --- reproduce el ejemplo JSON completo de la sección 8 ---

test("summarizeModelAccuracy: reproduce el ejemplo LINEAR de la sección 8 (N=18)", () => {

    const evaluations = [

        ...Array(14).fill({ errorHours: 3, direction: "EARLY" }),

        ...Array(3).fill({ errorHours: -3, direction: "LATE" }),

        ...Array(1).fill({ errorHours: 0.1, direction: "EXACT" })

    ];

    const summary =
        ModelAccuracyMetrics.summarizeModelAccuracy("LINEAR", evaluations);

    assert.strictEqual(summary.modelType, "LINEAR");
    assert.strictEqual(summary.sampleSize, 18);
    assert.strictEqual(summary.earlyCount, 14);
    assert.strictEqual(summary.lateCount, 3);
    assert.strictEqual(summary.exactCount, 1);
    assert.strictEqual(summary.earlyPercentage, 77.78);
    assert.strictEqual(summary.latePercentage, 16.67);
    assert.strictEqual(summary.exactPercentage, 5.56);
    assert.strictEqual(summary.sampleClassification, "SUFFICIENT_SAMPLE");

});

// --- Entrega 2.7.0.9 -- medianAbsoluteErrorHours (aditivo) ---

test("summarizeModelAccuracy: medianAbsoluteErrorHours con N impar = valor central", () => {

    // |errorHours| = [1, 2, 3, 4, 400] -> mediana = 3
    const evaluations = [

        { errorHours: 1, direction: "EARLY" },

        { errorHours: -2, direction: "LATE" },

        { errorHours: 3, direction: "EARLY" },

        { errorHours: -4, direction: "LATE" },

        { errorHours: 400, direction: "EARLY" }

    ];

    const summary =
        ModelAccuracyMetrics.summarizeModelAccuracy("LINEAR", evaluations);

    assert.strictEqual(summary.medianAbsoluteErrorHours, 3);

    // La mediana no se deja arrastrar por el outlier de 400h, a
    // diferencia del MAE (que sí lo refleja) -- exactamente la razón por
    // la que la sección 3 del spec pide ambos números por separado.
    assert.ok(summary.maeHours > summary.medianAbsoluteErrorHours);

});

test("summarizeModelAccuracy: medianAbsoluteErrorHours con N par = promedio de los dos centrales", () => {

    // |errorHours| = [1, 2, 3, 4] -> mediana = (2+3)/2 = 2.5
    const evaluations = [

        { errorHours: 1, direction: "EARLY" },

        { errorHours: -2, direction: "LATE" },

        { errorHours: 3, direction: "EARLY" },

        { errorHours: -4, direction: "LATE" }

    ];

    const summary =
        ModelAccuracyMetrics.summarizeModelAccuracy("EXPONENTIAL", evaluations);

    assert.strictEqual(summary.medianAbsoluteErrorHours, 2.5);

});

test("summarizeModelAccuracy: N=0 -> medianAbsoluteErrorHours también null", () => {

    const summary =
        ModelAccuracyMetrics.summarizeModelAccuracy("LINEAR", []);

    assert.strictEqual(summary.medianAbsoluteErrorHours, null);

});

test("summarizeModelAccuracy: N=0 -> métricas null, LOW_SAMPLE, nunca NaN/Infinity", () => {

    const summary =
        ModelAccuracyMetrics.summarizeModelAccuracy("EXPONENTIAL", []);

    assert.strictEqual(summary.sampleSize, 0);
    assert.strictEqual(summary.maeHours, null);
    assert.strictEqual(summary.rmseHours, null);
    assert.strictEqual(summary.biasHours, null);
    assert.strictEqual(summary.earlyPercentage, null);
    assert.strictEqual(summary.latePercentage, null);
    assert.strictEqual(summary.exactPercentage, null);
    assert.strictEqual(summary.sampleClassification, "LOW_SAMPLE");

});

test("summarizeModelAccuracy: N=1 -> LOW_SAMPLE aunque el error individual sea pequeño", () => {

    const summary =
        ModelAccuracyMetrics.summarizeModelAccuracy("LINEAR", [{ errorHours: 0.4, direction: "EXACT" }]);

    assert.strictEqual(summary.sampleSize, 1);
    assert.strictEqual(summary.sampleClassification, "LOW_SAMPLE", "una sola muestra nunca debe leerse como evidencia concluyente");

});

// --- buildComparison (sección 13) ---

test("buildComparison: reproduce el ejemplo de la sección 13 (LINEAR menor MAE y RMSE)", () => {

    const models = [

        { modelType: "LINEAR", sampleSize: 18, maeHours: 3.2, rmseHours: 4.7, biasHours: 1.8 },

        { modelType: "EXPONENTIAL", sampleSize: 15, maeHours: 4.5, rmseHours: 7.1, biasHours: -2.3 }

    ];

    const comparison =
        ModelAccuracyMetrics.buildComparison(models);

    assert.strictEqual(comparison.lowerMae, "LINEAR");
    assert.strictEqual(comparison.lowerRmse, "LINEAR");

});

test("buildComparison: empate exacto -> null (nunca inventa un ganador)", () => {

    const models = [

        { modelType: "LINEAR", sampleSize: 6, maeHours: 3.0, rmseHours: 4.0, biasHours: 0 },

        { modelType: "EXPONENTIAL", sampleSize: 6, maeHours: 3.0, rmseHours: 4.0, biasHours: 0 }

    ];

    const comparison =
        ModelAccuracyMetrics.buildComparison(models);

    assert.strictEqual(comparison.lowerMae, null);
    assert.strictEqual(comparison.lowerRmse, null);

});

test("buildComparison: un modelo sin muestras -> no compara (null)", () => {

    const models = [

        { modelType: "LINEAR", sampleSize: 6, maeHours: 3.0, rmseHours: 4.0, biasHours: 1 },

        { modelType: "EXPONENTIAL", sampleSize: 0, maeHours: null, rmseHours: null, biasHours: null }

    ];

    const comparison =
        ModelAccuracyMetrics.buildComparison(models);

    assert.strictEqual(comparison.lowerMae, null);
    assert.strictEqual(comparison.lowerRmse, null);

});

// --- buildInterpretation (sección 12) ---

test("buildInterpretation: reproduce ambas frases literales de la sección 12", () => {

    const models = [

        { modelType: "LINEAR", sampleSize: 18, maeHours: 3.2, rmseHours: 4.7, biasHours: 1.8 },

        { modelType: "EXPONENTIAL", sampleSize: 15, maeHours: 4.5, rmseHours: 7.1, biasHours: -2.3 }

    ];

    const sentences =
        ModelAccuracyMetrics.buildInterpretation(models);

    assert.ok(

        sentences.includes("LINEAR presenta menor MAE que EXPONENTIAL en los lotes evaluados."),

        "debe incluir la frase de comparación de MAE"

    );

    assert.ok(

        sentences.includes("LINEAR presenta un Bias positivo, lo que indica una tendencia a predecir antes de la maduración real."),

        "debe incluir la frase de tendencia de Bias positivo para LINEAR"

    );

    assert.ok(

        sentences.includes("EXPONENTIAL presenta un Bias negativo, lo que indica una tendencia a predecir después de la maduración real."),

        "debe incluir la frase de tendencia de Bias negativo para EXPONENTIAL"

    );

});

test("buildInterpretation: nunca declara superioridad estadística", () => {

    const models = [

        { modelType: "LINEAR", sampleSize: 18, maeHours: 3.2, rmseHours: 4.7, biasHours: 1.8 },

        { modelType: "EXPONENTIAL", sampleSize: 15, maeHours: 4.5, rmseHours: 7.1, biasHours: -2.3 }

    ];

    const sentences =
        ModelAccuracyMetrics.buildInterpretation(models);

    const joined =
        sentences.join(" ").toLowerCase();

    assert.ok(!joined.includes("estadísticamente"), "no debe usar la palabra 'estadísticamente'");
    assert.ok(!joined.includes("mejor"), "no debe declarar un modelo como 'mejor'");

});

test("buildInterpretation: bias casi nulo no genera una frase de tendencia (ruido, no señal)", () => {

    const models = [

        { modelType: "LINEAR", sampleSize: 6, maeHours: 3.0, rmseHours: 4.0, biasHours: 0.05 },

        { modelType: "EXPONENTIAL", sampleSize: 6, maeHours: 3.5, rmseHours: 4.5, biasHours: -0.02 }

    ];

    const sentences =
        ModelAccuracyMetrics.buildInterpretation(models);

    assert.ok(!sentences.some(s => s.includes("Bias")), "bias casi nulo no debe mencionarse como tendencia");

});

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {

    process.exit(1);

}
