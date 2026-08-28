const assert =
    require("assert");

const RecalibrationProcessAnalysis =
    require("../utils/RecalibrationProcessAnalysis");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

function rec({

    id,

    score = null,

    isRegression = false,

    status = "VALID",

    expectedMae = null,

    actualMae = null,

    modelType = "LINEAR",

    version,

    activatedAt,

    applicable = true,

    sampleSize = 12,

    simulatedHours = 3,

    realHours = 3.5,

    biasBeforeHours = 1.1,

    biasExpectedHours = 0.2,

    biasRealHours = 0.3

}) {

    if (!applicable) {

        return { applicable: false, calibrationId: id, status: "NOT_APPLICABLE" };

    }

    return {

        applicable: true,

        calibrationId: id,

        modelType,

        version,

        activatedAt,

        status,

        isRegression,

        sampleSize,

        effectivenessScore: score,

        expected: { mae: expectedMae, rmse: expectedMae, bias: expectedMae },

        actual: { mae: actualMae, rmse: actualMae, bias: actualMae },

        simulationBaseline: { maeHours: 5, rmseHours: 5, biasHours: 1 },

        simulated: { maeHours: simulatedHours, rmseHours: simulatedHours, biasHours: biasExpectedHours },

        realBaseline: { maeHours: 5.2, rmseHours: 5.2, biasHours: biasBeforeHours },

        real: { maeHours: realHours, rmseHours: realHours, biasHours: biasRealHours }

    };

}

// ---- classifyDistributionBand() (sección 6) -------------------------------

{

    check(RecalibrationProcessAnalysis.classifyDistributionBand(29.9).code === "BELOW_30", "29.9 -> BELOW_30");
    check(RecalibrationProcessAnalysis.classifyDistributionBand(30).code === "RANGE_30_69", "30 (borde) -> RANGE_30_69");
    check(RecalibrationProcessAnalysis.classifyDistributionBand(69.9).code === "RANGE_30_69", "69.9 -> RANGE_30_69");
    check(RecalibrationProcessAnalysis.classifyDistributionBand(70).code === "RANGE_70_89", "70 (borde) -> RANGE_70_89");
    check(RecalibrationProcessAnalysis.classifyDistributionBand(89.9).code === "RANGE_70_89", "89.9 -> RANGE_70_89");
    check(RecalibrationProcessAnalysis.classifyDistributionBand(90).code === "RANGE_90_110", "90 (borde) -> RANGE_90_110");
    check(RecalibrationProcessAnalysis.classifyDistributionBand(110).code === "RANGE_90_110", "110 (borde) -> RANGE_90_110, no ABOVE_110");
    check(RecalibrationProcessAnalysis.classifyDistributionBand(110.1).code === "ABOVE_110", "110.1 -> ABOVE_110 (sección 8 de 2.6.1.32: >100%% no es un error)");

}

// ---- classifyHealthTier() (sección 11) ------------------------------------

{

    check(RecalibrationProcessAnalysis.classifyHealthTier(95).code === "EXCELLENT", "95 -> EXCELLENT");
    check(RecalibrationProcessAnalysis.classifyHealthTier(90).code === "EXCELLENT", "90 (borde) -> EXCELLENT");
    check(RecalibrationProcessAnalysis.classifyHealthTier(89).code === "GOOD", "89 -> GOOD");
    check(RecalibrationProcessAnalysis.classifyHealthTier(88).code === "GOOD", "88 (ejemplo literal del spec, sección 11) -> GOOD/BUENO");
    check(RecalibrationProcessAnalysis.classifyHealthTier(75).code === "GOOD", "75 (borde) -> GOOD");
    check(RecalibrationProcessAnalysis.classifyHealthTier(74).code === "FAIR", "74 -> FAIR");
    check(RecalibrationProcessAnalysis.classifyHealthTier(50).code === "FAIR", "50 (borde) -> FAIR");
    check(RecalibrationProcessAnalysis.classifyHealthTier(49).code === "CRITICAL", "49 -> CRITICAL");
    check(RecalibrationProcessAnalysis.classifyHealthTier(null) === null, "null -> null (sin datos)");

}

// ---- summarize() -- reproduce el ejemplo literal de la sección 1 ---------

{

    const records =
        [];

    for (let i = 1; i <= 8; i++) {

        records.push(rec({ id: i, score: 90 + i, expectedMae: 25, actualMae: 24, version: i, activatedAt: `2026-0${(i % 9) + 1}-01` }));

    }

    for (let i = 9; i <= 10; i++) {

        records.push(rec({ id: i, score: 75, expectedMae: 25, actualMae: 19, version: i, activatedAt: "2026-06-01" }));

    }

    records.push(rec({ id: 11, score: 20, expectedMae: 25, actualMae: 5, version: 11, activatedAt: "2026-07-01" }));

    records.push(rec({ id: 12, score: null, isRegression: true, status: "REGRESSION", expectedMae: 24, actualMae: -8, version: 12, activatedAt: "2026-08-01" }));

    for (let i = 13; i <= 15; i++) {

        records.push(rec({ id: i, score: null, status: "PRELIMINARY", version: i, activatedAt: "2026-08-05" }));

    }

    for (let i = 16; i <= 17; i++) {

        records.push(rec({ id: i, score: null, status: "PENDING", version: i, activatedAt: "2026-08-10" }));

    }

    records.push(rec({ id: 18, applicable: false }));

    const summary =
        RecalibrationProcessAnalysis.summarize(records);

    check(summary.evidence.evaluated === 12, `12 recalibraciones evaluadas (sección 1) -- got ${summary.evidence.evaluated}`);
    check(summary.evidence.preliminary === 3, "3 preliminares (sección 13) excluidas de los indicadores");
    check(summary.evidence.pending === 2, "2 pendientes (sección 13) excluidas de los indicadores");
    check(summary.evidence.notApplicable === 1, "1 sin calibración origen, reportada aparte");

    check(summary.counts.successful === 8, `8 exitosas (sección 1) -- got ${summary.counts.successful}`);
    check(summary.counts.moderate === 2, `2 moderadas -- got ${summary.counts.moderate}`);
    check(summary.counts.ineffective === 1, `1 inefectiva -- got ${summary.counts.ineffective}`);
    check(summary.counts.regressions === 1, `1 regresión -- got ${summary.counts.regressions}`);

    check(Math.abs(summary.rates.regression - 8.3) < 0.2, `tasa de regresión ~8.3%% (2/12... 1/12, sección 1/7) -- got ${summary.rates.regression}`);

    check(summary.processHealth.score === 88, `RECALIBRATION PROCESS HEALTH == 88 (sección 11, ejemplo literal) -- got ${summary.processHealth.score}`);
    check(summary.processHealth.tier.code === "GOOD", "88 -> 🟢 BUENO (sección 11, ejemplo literal)");
    check(summary.processHealth.components.success !== null && summary.processHealth.components.effectiveness !== null && summary.processHealth.components.regressions !== null && summary.processHealth.components.consistency !== null, "los 4 componentes del health score siempre viajan junto al número (sección 11: nunca ocultar la información real)");

    check(summary.distribution.reduce((total, band) => total + band.count, 0) === 11, "la suma de las 5 bandas de distribución == recalibraciones con score (11, excluye la regresión que no tiene score)");

    check(summary.regressionDetails.length === 1 && summary.regressionDetails[0].calibrationId === 12, "sección 7 -- detalle de la única regresión expuesto");

    check(summary.timeline.length === 12, "sección 8 -- la línea de tiempo incluye las 12 evaluadas (incluye la regresión, marcada con isRegression)");

    check(summary.improvement.estimationBiasDirection === "OPTIMISTIC", `sesgo de estimación positivo (esperado > real en promedio) -> OPTIMISTIC -- got ${summary.improvement.estimationBiasDirection}`);

    check(summary.byModel.length === 1 && summary.byModel[0].modelType === "LINEAR" && summary.byModel[0].evaluatedCount === 12, "sección 9 -- agrupado por modelo (un solo modelo en este fixture)");

}

// ---- Sección 4/5 -- sesgo de estimación en ambas direcciones -------------

{

    const optimistic =
        RecalibrationProcessAnalysis.summarize([

            rec({ id: 1, score: 76, expectedMae: 28.4, actualMae: 21.7, version: 1, activatedAt: "2026-08-01" })

        ]);

    check(optimistic.improvement.estimationBiasDirection === "OPTIMISTIC", `esperada 28.4%%, real 21.7%% (sección 4, ejemplo literal) -> OPTIMISTIC -- got ${optimistic.improvement.estimationBiasDirection}`);
    check(Math.abs(optimistic.improvement.estimationBias - 6.7) < 0.2, `sesgo ~+6.7pp (sección 4, ejemplo literal) -- got ${optimistic.improvement.estimationBias}`);

    const conservative =
        RecalibrationProcessAnalysis.summarize([

            rec({ id: 1, score: 100, expectedMae: 18.5, actualMae: 24.2, version: 1, activatedAt: "2026-08-01" })

        ]);

    check(conservative.improvement.estimationBiasDirection === "CONSERVATIVE", `esperada 18.5%%, real 24.2%% (sección 5, ejemplo literal) -> CONSERVATIVE -- got ${conservative.improvement.estimationBiasDirection}`);
    check(Math.abs(conservative.improvement.estimationBias - (-5.7)) < 0.2, `sesgo ~-5.7pp (sección 5, ejemplo literal) -- got ${conservative.improvement.estimationBias}`);

    const accurate =
        RecalibrationProcessAnalysis.summarize([

            rec({ id: 1, score: 97, expectedMae: 25, actualMae: 24.5, version: 1, activatedAt: "2026-08-01" })

        ]);

    check(accurate.improvement.estimationBiasDirection === "ACCURATE", `diferencia dentro del umbral de ruido -> ACCURATE -- got ${accurate.improvement.estimationBiasDirection}`);

}

// ---- Sección 3 -- advertencia de dispersión --------------------------------

{

    const dispersed =
        RecalibrationProcessAnalysis.summarize([

            rec({ id: 1, score: 20, expectedMae: 25, actualMae: 5, version: 1, activatedAt: "2026-08-01" }),

            rec({ id: 2, score: 20, expectedMae: 25, actualMae: 5, version: 2, activatedAt: "2026-08-02" }),

            rec({ id: 3, score: 130, expectedMae: 25, actualMae: 32.5, version: 3, activatedAt: "2026-08-03" })

        ]);

    check(dispersed.effectiveness.dispersionWarning === true, "media y mediana muy distintas -> dispersionWarning true (sección 3)");

    const consistent =
        RecalibrationProcessAnalysis.summarize([

            rec({ id: 1, score: 90, expectedMae: 25, actualMae: 22.5, version: 1, activatedAt: "2026-08-01" }),

            rec({ id: 2, score: 92, expectedMae: 25, actualMae: 23, version: 2, activatedAt: "2026-08-02" }),

            rec({ id: 3, score: 88, expectedMae: 25, actualMae: 22, version: 3, activatedAt: "2026-08-03" })

        ]);

    check(consistent.effectiveness.dispersionWarning === false, "media y mediana cercanas -> dispersionWarning false");

}

// ---- Sección 9 -- comparación por modelo -----------------------------------

{

    const summary =
        RecalibrationProcessAnalysis.summarize([

            rec({ id: 1, score: 91, expectedMae: 25, actualMae: 22.75, modelType: "LINEAR", version: 1, activatedAt: "2026-08-01" }),

            rec({ id: 2, score: 76, expectedMae: 25, actualMae: 19, modelType: "EXPONENTIAL", version: 1, activatedAt: "2026-08-01" }),

            rec({ id: 3, score: 104, expectedMae: 25, actualMae: 26, modelType: "EXPONENTIAL", version: 2, activatedAt: "2026-08-02" })

        ]);

    check(summary.byModel.length === 2, "dos modelos distintos -> dos grupos (sección 9)");

    const exponential =
        summary.byModel.find(m => m.modelType === "EXPONENTIAL");

    check(exponential.evaluatedCount === 2 && Math.abs(exponential.averageEffectiveness - 90) < 0.5, `EXPONENTIAL: 2 evaluadas, efectividad media ~90%% -- got ${JSON.stringify(exponential)}`);

}

// ---- Sección 10 -- agregados MAE/RMSE/Bias ---------------------------------

{

    const summary =
        RecalibrationProcessAnalysis.summarize([

            rec({ id: 1, score: 90, expectedMae: 25, actualMae: 22.5, version: 1, activatedAt: "2026-08-01", simulatedHours: 2, realHours: 3, biasBeforeHours: 1, biasExpectedHours: 0.1, biasRealHours: 0.2 }),

            rec({ id: 2, score: 90, expectedMae: 25, actualMae: 22.5, version: 2, activatedAt: "2026-08-02", simulatedHours: 4, realHours: 5, biasBeforeHours: 1.2, biasExpectedHours: 0.3, biasRealHours: 0.4 })

        ]);

    check(summary.metrics.mae.expectedHours === 3 && summary.metrics.mae.realHours === 4, `MAE agregado: esperado 3h, real 4h -- got ${JSON.stringify(summary.metrics.mae)}`);
    check(summary.metrics.bias.beforeHours === 1.1 && summary.metrics.bias.expectedHours === 0.2 && summary.metrics.bias.realHours === 0.3, `Bias agregado: antes -> esperado -> real preserva signo (sección 10) -- got ${JSON.stringify(summary.metrics.bias)}`);

}

// ---- Caso vacío -- no debe fallar nunca ------------------------------------

{

    const empty =
        RecalibrationProcessAnalysis.summarize([]);

    check(empty.evidence.evaluated === 0, "array vacío -> 0 evaluadas, sin lanzar excepción");
    check(empty.processHealth.score === null, "sin datos -> health score null, no un 0 fabricado");
    check(empty.effectiveness.mean === null && empty.effectiveness.median === null, "sin datos -> media/mediana null");
    check(empty.byModel.length === 0, "sin datos -> sin modelos que comparar");
    check(empty.distribution.every(band => band.count === 0), "sin datos -> todas las bandas en 0");

}

console.log(`\n${passed} assertions passed.`);
