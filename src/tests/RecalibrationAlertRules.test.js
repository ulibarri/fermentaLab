const assert =
    require("assert");

const RecalibrationAlertRules =
    require("../utils/RecalibrationAlertRules");

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

console.log("RecalibrationAlertRules tests\n");

// --- classify: sección 1 (INSUFFICIENT_DATA) ---

test("classify: sin calibración activa -> INSUFFICIENT_DATA", () => {

    const result =
        RecalibrationAlertRules.classify({ hasCalibration: false });

    assert.strictEqual(result.severity, "INSUFFICIENT_DATA");
    assert.strictEqual(result.type, "INSUFFICIENT_DATA");

});

test("classify: salud INSUFFICIENT_DATA (ventana reciente < 5) -> INSUFFICIENT_DATA aunque haya otras señales", () => {

    const result =
        RecalibrationAlertRules.classify({

            hasCalibration: true,

            calibrationHealth: "INSUFFICIENT_DATA",

            sampleSize: 3,

            maeHistorical: 1.5,

            maeRecent: 4.0

        });

    assert.strictEqual(result.severity, "INSUFFICIENT_DATA");

});

test("classify: sampleSize por debajo del mínimo (5) -> INSUFFICIENT_DATA", () => {

    const result =
        RecalibrationAlertRules.classify({

            hasCalibration: true,

            calibrationHealth: "HEALTHY",

            sampleSize: 4,

            maeHistorical: 1.5,

            maeRecent: 1.5

        });

    assert.strictEqual(result.severity, "INSUFFICIENT_DATA");

});

// --- classify: sección 4, ejemplo 1 (CRITICAL) ---

test("classify: reproduce el ejemplo CRITICAL de la sección 4 (MAE↑, Bias↑, DEGRADED, WORSENING)", () => {

    const result =
        RecalibrationAlertRules.classify({

            hasCalibration: true,

            calibrationHealth: "DEGRADED",

            trend: "DETERIORATING",

            recommendRecalibration: true,

            sampleSize: 10,

            maeHistorical: 1.5,

            maeRecent: 2.2,

            biasHistorical: 0.2,

            biasRecent: 0.9

        });

    assert.strictEqual(result.severity, "CRITICAL");
    assert.strictEqual(result.type, "PERFORMANCE_DETERIORATION");
    assert.strictEqual(result.signals.maeIncreased, true);
    assert.strictEqual(result.signals.biasIncreased, true);

});

// --- classify: sección 4, ejemplo 2 (WARNING) ---

test("classify: reproduce el ejemplo WARNING de la sección 4 (MAE↑, Bias estable, HEALTHY, STABLE)", () => {

    const result =
        RecalibrationAlertRules.classify({

            hasCalibration: true,

            calibrationHealth: "HEALTHY",

            trend: "STABLE",

            recommendRecalibration: false,

            sampleSize: 12,

            maeHistorical: 1.5,

            maeRecent: 1.9,

            biasHistorical: 0.2,

            biasRecent: 0.2

        });

    assert.strictEqual(result.severity, "WARNING");
    assert.strictEqual(result.signals.maeIncreased, true);
    assert.strictEqual(result.signals.biasIncreased, false);

});

test("classify: MAE estable/decreciente + salud HEALTHY + tendencia STABLE -> INFO (nunca se persiste)", () => {

    const result =
        RecalibrationAlertRules.classify({

            hasCalibration: true,

            calibrationHealth: "HEALTHY",

            trend: "STABLE",

            recommendRecalibration: false,

            sampleSize: 12,

            maeHistorical: 1.8,

            maeRecent: 1.6,

            biasHistorical: 0.2,

            biasRecent: 0.15

        });

    assert.strictEqual(result.severity, "INFO");
    assert.strictEqual(result.type, null);

});

test("classify: salud WARNING por sí sola (aunque MAE no haya subido) -> WARNING", () => {

    const result =
        RecalibrationAlertRules.classify({

            hasCalibration: true,

            calibrationHealth: "WARNING",

            trend: "STABLE",

            recommendRecalibration: false,

            sampleSize: 8,

            maeHistorical: 1.8,

            maeRecent: 1.7,

            biasHistorical: 0.2,

            biasRecent: 0.2

        });

    assert.strictEqual(result.severity, "WARNING");

});

test("classify: tendencia DETERIORATING por sí sola -> WARNING", () => {

    const result =
        RecalibrationAlertRules.classify({

            hasCalibration: true,

            calibrationHealth: "HEALTHY",

            trend: "DETERIORATING",

            recommendRecalibration: false,

            sampleSize: 8,

            maeHistorical: 1.8,

            maeRecent: 1.7,

            biasHistorical: 0.2,

            biasRecent: 0.2

        });

    assert.strictEqual(result.severity, "WARNING");

});

test("classify: DEGRADED sin recommendRecalibration (ventana reciente incompleta, <10) nunca escala solo a CRITICAL", () => {

    const result =
        RecalibrationAlertRules.classify({

            hasCalibration: true,

            calibrationHealth: "DEGRADED",

            trend: "DETERIORATING",

            recommendRecalibration: false,

            sampleSize: 6,

            maeHistorical: 1.5,

            maeRecent: 2.5,

            biasHistorical: 0.2,

            biasRecent: 0.9

        });

    assert.strictEqual(result.severity, "WARNING");

});

test("classify: RMSE se calcula como señal de apoyo, nunca gatilla por sí solo un nivel distinto de INFO", () => {

    const result =
        RecalibrationAlertRules.classify({

            hasCalibration: true,

            calibrationHealth: "HEALTHY",

            trend: "STABLE",

            recommendRecalibration: false,

            sampleSize: 12,

            maeHistorical: 1.8,

            maeRecent: 1.6,

            biasHistorical: 0.2,

            biasRecent: 0.15,

            rmseHistorical: 2.0,

            rmseRecent: 2.6

        });

    assert.strictEqual(result.severity, "INFO");
    assert.strictEqual(result.signals.rmseIncreased, true);

});

// --- buildMessage: reproduce los 4 ejemplos literales de la sección 1 ---

test("buildMessage: INSUFFICIENT_DATA reproduce el ejemplo literal de la sección 1", () => {

    const message =
        RecalibrationAlertRules.buildMessage({ severity: "INSUFFICIENT_DATA" });

    assert.strictEqual(

        message,

        "No existen suficientes evaluaciones recientes para determinar si el modelo requiere recalibración."

    );

});

test("buildMessage: INFO reproduce el ejemplo literal de la sección 1", () => {

    const message =
        RecalibrationAlertRules.buildMessage({ severity: "INFO" });

    assert.strictEqual(message, "La calibración activa mantiene un desempeño estable.");

});

test("buildMessage: CRITICAL reproduce exactamente el ejemplo de la sección 7", () => {

    const message =
        RecalibrationAlertRules.buildMessage({

            severity: "CRITICAL",

            maeHistorical: 1.62,

            maeRecent: 2.31,

            biasIncreased: true,

            rmseIncreased: false,

            calibrationHealth: "DEGRADED"

        });

    assert.strictEqual(

        message,

        "El MAE reciente aumentó de 1.62 h a 2.31 h. El Bias también aumentó y la calibración activa actualmente presenta estado DEGRADED. Se recomienda crear una nueva propuesta de calibración."

    );

});

test("buildMessage: WARNING sin Bias creciente termina en 'continuar monitoreando'", () => {

    const message =
        RecalibrationAlertRules.buildMessage({

            severity: "WARNING",

            maeHistorical: 1.5,

            maeRecent: 1.9,

            biasIncreased: false,

            rmseIncreased: false

        });

    assert.strictEqual(

        message,

        "El MAE reciente aumentó de 1.5 h a 1.9 h. Se recomienda continuar monitoreando."

    );

});

test("buildMessage: CRITICAL sin Bias creciente igual menciona el estado DEGRADED", () => {

    const message =
        RecalibrationAlertRules.buildMessage({

            severity: "CRITICAL",

            maeHistorical: 1.5,

            maeRecent: 2.9,

            biasIncreased: false,

            rmseIncreased: false

        });

    assert.strictEqual(

        message,

        "El MAE reciente aumentó de 1.5 h a 2.9 h. La calibración activa actualmente presenta estado DEGRADED. Se recomienda crear una nueva propuesta de calibración."

    );

});

// --- suggestOffsetHours: sección 14 ---

test("suggestOffsetHours: reproduce el ejemplo de la sección 14 (+1.6h actual, Bias reciente -0.5h -> +1.1h sugerido)", () => {

    assert.strictEqual(RecalibrationAlertRules.suggestOffsetHours(1.6, -0.5), 1.1);

});

test("suggestOffsetHours: null si falta cualquiera de los dos valores", () => {

    assert.strictEqual(RecalibrationAlertRules.suggestOffsetHours(null, -0.5), null);
    assert.strictEqual(RecalibrationAlertRules.suggestOffsetHours(1.6, null), null);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.`);

if (failed > 0) {

    process.exit(1);

}
