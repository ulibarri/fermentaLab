const assert =
    require("assert");

const CalibrationHealth =
    require("../utils/CalibrationHealth");

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

console.log("CalibrationHealth tests\n");

// --- computeMaeChangePercentage (sección 12) ---

test("computeMaeChangePercentage: reproduce el ejemplo de la sección 12 (1.8h -> 2.2h = +22.22%)", () => {

    assert.strictEqual(CalibrationHealth.computeMaeChangePercentage(1.8, 2.2), 22.22);

});

test("computeMaeChangePercentage: mejora da signo negativo (a diferencia de computeImprovement)", () => {

    assert.strictEqual(CalibrationHealth.computeMaeChangePercentage(2.2, 1.8), -18.18);

});

test("computeMaeChangePercentage: historicalMae null/0 -> null, nunca divide entre cero", () => {

    assert.strictEqual(CalibrationHealth.computeMaeChangePercentage(null, 2.2), null);

    assert.strictEqual(CalibrationHealth.computeMaeChangePercentage(0, 2.2), null);

});

// --- computeTrend (sección 11) ---

test("computeTrend: reproduce el primer ejemplo de la sección 11 (2.1h -> 1.7h -> IMPROVING)", () => {

    assert.strictEqual(CalibrationHealth.computeTrend(10, 2.1, 10, 1.7), "IMPROVING");

});

test("computeTrend: reproduce el segundo ejemplo de la sección 11 (1.8h -> 2.7h -> DETERIORATING)", () => {

    assert.strictEqual(CalibrationHealth.computeTrend(10, 1.8, 10, 2.7), "DETERIORATING");

});

test("computeTrend: cambio pequeño (<5%) -> STABLE", () => {

    assert.strictEqual(CalibrationHealth.computeTrend(10, 2.0, 10, 1.96), "STABLE");

});

test("computeTrend: ventana anterior con menos de 5 muestras -> null (nunca fabrica una dirección)", () => {

    assert.strictEqual(CalibrationHealth.computeTrend(3, 1.8, 10, 2.7), null);

});

test("computeTrend: ventana reciente con menos de 5 muestras -> null", () => {

    assert.strictEqual(CalibrationHealth.computeTrend(10, 1.8, 4, 2.7), null);

});

// --- classifyHealth (secciones 6-10) ---

test("classifyHealth: recentSampleSize < 5 -> INSUFFICIENT_DATA (sección 10), sin importar el resto", () => {

    const result =
        CalibrationHealth.classifyHealth({

            recentSampleSize: 3, recentRawMaeHours: 5, recentCalibratedMaeHours: 1,
            recentCalibratedBiasHours: 0, historicalCalibratedMaeHours: 1

        });

    assert.strictEqual(result, "INSUFFICIENT_DATA");

});

test("classifyHealth: reproduce el ejemplo de la sección 8 (histórico 1.8h -> reciente 2.4h = 33.3% -> DEGRADED)", () => {

    const result =
        CalibrationHealth.classifyHealth({

            recentSampleSize: 10, recentRawMaeHours: 5, recentCalibratedMaeHours: 2.4,
            recentCalibratedBiasHours: 0.2, historicalCalibratedMaeHours: 1.8

        });

    assert.strictEqual(result, "DEGRADED");

});

test("classifyHealth: reproduce el ejemplo de la sección 9 (raw 2.0h < calibrated 2.8h -> DEGRADED, sin importar el histórico)", () => {

    const result =
        CalibrationHealth.classifyHealth({

            recentSampleSize: 10, recentRawMaeHours: 2.0, recentCalibratedMaeHours: 2.8,
            recentCalibratedBiasHours: 0.1, historicalCalibratedMaeHours: 1.5 // histórico bueno, pero irrelevante aquí

        });

    assert.strictEqual(result, "DEGRADED");

});

test("classifyHealth: HEALTHY cuando mejora sobre raw, Bias en banda, y no empeoró vs. histórico", () => {

    const result =
        CalibrationHealth.classifyHealth({

            recentSampleSize: 10, recentRawMaeHours: 3.0, recentCalibratedMaeHours: 1.4,
            recentCalibratedBiasHours: 0.3, historicalCalibratedMaeHours: 1.6

        });

    assert.strictEqual(result, "HEALTHY");

});

test("classifyHealth: WARNING cuando el Bias reciente se sale de ±1h aunque el MAE mejore", () => {

    const result =
        CalibrationHealth.classifyHealth({

            recentSampleSize: 10, recentRawMaeHours: 3.0, recentCalibratedMaeHours: 1.4,
            recentCalibratedBiasHours: 1.3, historicalCalibratedMaeHours: 1.6

        });

    assert.strictEqual(result, "WARNING");

});

test("classifyHealth: WARNING -- síntesis secciones 6/7, deterioro leve vs. histórico (16.67% < 20%) aunque siga ganando al raw", () => {

    // Reproduce la narrativa de la sección 7 ("MAE histórico 1.8h ->
    // reciente 2.1h... comienza a perder efectividad") -- el raw se
    // elige deliberadamente peor que el reciente calibrado (2.5h) para
    // que recentResult siga siendo IMPROVED contra su propio raw, y
    // así probar que la cláusula "no empeoró vs. histórico" es la que
    // realmente evita que esto se declare HEALTHY.
    const result =
        CalibrationHealth.classifyHealth({

            recentSampleSize: 10, recentRawMaeHours: 2.5, recentCalibratedMaeHours: 2.1,
            recentCalibratedBiasHours: 0.2, historicalCalibratedMaeHours: 1.8

        });

    assert.strictEqual(result, "WARNING");

});

test("classifyHealth: reproduce la regla inicial de la sección 6 en su forma más simple (mejora clara, sin deterioro, bias en banda)", () => {

    const result =
        CalibrationHealth.classifyHealth({

            recentSampleSize: 5, recentRawMaeHours: 4.0, recentCalibratedMaeHours: 1.0,
            recentCalibratedBiasHours: -0.5, historicalCalibratedMaeHours: null // sin histórico disponible todavía

        });

    assert.strictEqual(result, "HEALTHY", "sin histórico disponible, la cláusula 'no empeoró' no debe bloquear HEALTHY");

});

// --- shouldRecommendRecalibration (sección 13) ---

test("shouldRecommendRecalibration: true solo con ventana completa (>=10) Y health=DEGRADED", () => {

    assert.strictEqual(CalibrationHealth.shouldRecommendRecalibration(10, "DEGRADED"), true);

    assert.strictEqual(CalibrationHealth.shouldRecommendRecalibration(9, "DEGRADED"), false, "menos de 10 muestras no debe recomendar recalibración todavía");

    assert.strictEqual(CalibrationHealth.shouldRecommendRecalibration(12, "WARNING"), false, "WARNING nunca recomienda recalibración, solo DEGRADED");

    assert.strictEqual(CalibrationHealth.shouldRecommendRecalibration(15, "HEALTHY"), false);

});

// --- buildHealthReport: forma completa de la sección 12 ---

test("buildHealthReport: arma la forma completa del ejemplo de la sección 12 -- nótese que sus propios números (22.22% de deterioro) superan el umbral del 20% de la sección 8, así que health da DEGRADED aquí aunque el JSON de la sección 12 lo etiquete como WARNING (inconsistencia del propio spec -- se documenta como decisión de diseño: la regla numerada de la sección 8 prevalece sobre el ejemplo ilustrativo de la sección 12, ver CalibrationHealth.js)", () => {

    const report =
        CalibrationHealth.buildHealthReport({

            calibrationId: 7, modelType: "LINEAR", recipeVersionId: 3, status: "ACTIVE",

            historical: { sampleSize: 32, maeHours: 1.8, biasHours: 0.3 },

            recent: { sampleSize: 10, maeHours: 2.2, biasHours: 1.1 },

            previousWindow: { sampleSize: 10, maeHours: 1.8, biasHours: 0.4 },

            recentRawMaeHours: 2.6

        });

    assert.strictEqual(report.calibrationId, 7);
    assert.strictEqual(report.modelType, "LINEAR");
    assert.strictEqual(report.recipeVersionId, 3);
    assert.strictEqual(report.status, "ACTIVE");
    assert.deepStrictEqual(report.historical, { sampleSize: 32, maeHours: 1.8, biasHours: 0.3 });
    assert.deepStrictEqual(report.recent, { sampleSize: 10, maeHours: 2.2, biasHours: 1.1 });
    assert.deepStrictEqual(report.previousWindow, { sampleSize: 10, maeHours: 1.8, biasHours: 0.4 });
    assert.strictEqual(report.maeChangePercentage, 22.22);
    assert.strictEqual(report.trend, "DETERIORATING");
    assert.strictEqual(report.health, "DEGRADED", "22.22% > 20% (sección 8) -> DEGRADED por la regla numerada, pese a que el JSON de ejemplo de la sección 12 dice WARNING");
    assert.strictEqual(report.recommendRecalibration, true, "ventana completa (10) + DEGRADED -> recomienda recalibración");

});

test("buildHealthReport: escenario WARNING real (deterioro leve, 16.67% < 20%)", () => {

    const report =
        CalibrationHealth.buildHealthReport({

            calibrationId: 10, modelType: "LINEAR", recipeVersionId: 3, status: "ACTIVE",

            historical: { sampleSize: 25, maeHours: 1.8, biasHours: 0.2 },

            recent: { sampleSize: 10, maeHours: 2.1, biasHours: 0.2 },

            previousWindow: { sampleSize: 10, maeHours: 1.8, biasHours: 0.2 },

            recentRawMaeHours: 2.5

        });

    assert.strictEqual(report.maeChangePercentage, 16.67);
    assert.strictEqual(report.health, "WARNING");
    assert.strictEqual(report.recommendRecalibration, false);

});

test("buildHealthReport: escenario DEGRADED con recommendRecalibration=true (ventana completa)", () => {

    const report =
        CalibrationHealth.buildHealthReport({

            calibrationId: 8, modelType: "EXPONENTIAL", recipeVersionId: 3, status: "ACTIVE",

            historical: { sampleSize: 20, maeHours: 1.8, biasHours: 0.2 },

            recent: { sampleSize: 12, maeHours: 3.1, biasHours: 1.9 },

            previousWindow: { sampleSize: 10, maeHours: 1.9, biasHours: 0.3 },

            recentRawMaeHours: 2.9

        });

    assert.strictEqual(report.health, "DEGRADED");
    assert.strictEqual(report.recommendRecalibration, true);
    assert.strictEqual(report.trend, "DETERIORATING");

});

console.log(`\n${passed} pasaron, ${failed} fallaron.`);

if (failed > 0) {

    process.exit(1);

}
