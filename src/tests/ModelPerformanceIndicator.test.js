const assert =
    require("assert");

const ModelPerformanceIndicator =
    require("../utils/ModelPerformanceIndicator");

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

console.log("ModelPerformanceIndicator tests\n");

test("GOOD: calibrated MAE < raw MAE y health HEALTHY", () => {

    const result =
        ModelPerformanceIndicator.classifyIndicator({

            sampleSize: 42, maeRaw: 2.46, maeCalibrated: 1.72, calibrationHealth: "HEALTHY"

        });

    assert.strictEqual(result, "GOOD");

});

test("WARNING: calibrated MAE < raw MAE pero health WARNING", () => {

    const result =
        ModelPerformanceIndicator.classifyIndicator({

            sampleSize: 30, maeRaw: 2.0, maeCalibrated: 1.8, calibrationHealth: "WARNING"

        });

    assert.strictEqual(result, "WARNING");

});

test("POOR: calibrated MAE >= raw MAE, sin importar el health", () => {

    const result =
        ModelPerformanceIndicator.classifyIndicator({

            sampleSize: 30, maeRaw: 2.0, maeCalibrated: 2.5, calibrationHealth: "HEALTHY"

        });

    assert.strictEqual(result, "POOR");

});

test("POOR: health DEGRADED, aunque calibrated MAE < raw MAE", () => {

    const result =
        ModelPerformanceIndicator.classifyIndicator({

            sampleSize: 30, maeRaw: 3.0, maeCalibrated: 1.5, calibrationHealth: "DEGRADED"

        });

    assert.strictEqual(result, "POOR");

});

test("INSUFFICIENT_DATA: sampleSize < 5", () => {

    const result =
        ModelPerformanceIndicator.classifyIndicator({

            sampleSize: 3, maeRaw: 2.0, maeCalibrated: 1.5, calibrationHealth: "HEALTHY"

        });

    assert.strictEqual(result, "INSUFFICIENT_DATA");

});

test("INSUFFICIENT_DATA: sampleSize 0/null/undefined", () => {

    assert.strictEqual(ModelPerformanceIndicator.classifyIndicator({ sampleSize: 0, maeRaw: 2, maeCalibrated: 1, calibrationHealth: "HEALTHY" }), "INSUFFICIENT_DATA");
    assert.strictEqual(ModelPerformanceIndicator.classifyIndicator({ sampleSize: null, maeRaw: 2, maeCalibrated: 1, calibrationHealth: "HEALTHY" }), "INSUFFICIENT_DATA");

});

test("INSUFFICIENT_DATA: nunca hubo una calibración activa (calibrationHealth ausente)", () => {

    const result =
        ModelPerformanceIndicator.classifyIndicator({

            sampleSize: 30, maeRaw: 2.0, maeCalibrated: 1.5, calibrationHealth: null

        });

    assert.strictEqual(result, "INSUFFICIENT_DATA");

});

test("INSUFFICIENT_DATA: la calibración misma reporta INSUFFICIENT_DATA -> se propaga", () => {

    const result =
        ModelPerformanceIndicator.classifyIndicator({

            sampleSize: 30, maeRaw: 2.0, maeCalibrated: 1.5, calibrationHealth: "INSUFFICIENT_DATA"

        });

    assert.strictEqual(result, "INSUFFICIENT_DATA");

});

test("INSUFFICIENT_DATA: falta maeRaw o maeCalibrated (defensivo, nunca compara con null)", () => {

    assert.strictEqual(ModelPerformanceIndicator.classifyIndicator({ sampleSize: 30, maeRaw: null, maeCalibrated: 1.5, calibrationHealth: "HEALTHY" }), "INSUFFICIENT_DATA");
    assert.strictEqual(ModelPerformanceIndicator.classifyIndicator({ sampleSize: 30, maeRaw: 2.0, maeCalibrated: null, calibrationHealth: "HEALTHY" }), "INSUFFICIENT_DATA");

});

test("empate exacto (calibrated === raw) cuenta como POOR (>=), nunca como GOOD", () => {

    const result =
        ModelPerformanceIndicator.classifyIndicator({

            sampleSize: 30, maeRaw: 2.0, maeCalibrated: 2.0, calibrationHealth: "HEALTHY"

        });

    assert.strictEqual(result, "POOR");

});

console.log(`\n${passed} pasaron, ${failed} fallaron.`);

if (failed > 0) {

    process.exit(1);

}
