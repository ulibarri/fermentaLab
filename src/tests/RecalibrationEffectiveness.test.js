const assert =
    require("assert");

const RecalibrationEffectiveness =
    require("../utils/RecalibrationEffectiveness");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

// ---- classifySampleStatus() (secciones 7/9/15) ---------------------------

{
    check(RecalibrationEffectiveness.classifySampleStatus(0) === "PENDING", "n=0 -> PENDING");
    check(RecalibrationEffectiveness.classifySampleStatus(4) === "PRELIMINARY", "n=4 (spec's own sección 9 example) -> PRELIMINARY");
    check(RecalibrationEffectiveness.classifySampleStatus(10) === "VALID", "n=10 (mínimo exacto, spec's own sección 9 example) -> VALID");
    check(RecalibrationEffectiveness.classifySampleStatus(18) === "VALID", "n=18 (sección 10 example) -> VALID");
    check(RecalibrationEffectiveness.classifySampleStatus(7, 20) === "PRELIMINARY", "mínimo configurable -- n=7 con mínimo=20 sigue siendo PRELIMINARY");
}

// ---- computeEffectivenessScore() (sección 2/3) ---------------------------

{
    // Sección 1/2, ejemplo literal (con tolerancia -- el propio spec
    // redondea 28.3/33.3 a 84.9%, pero la razón exacta 28.333.../
    // 33.333... = 85.0% cuando no se acumulan redondeos intermedios;
    // se documenta como una discrepancia menor del propio spec, mismo
    // patrón que en 2.6.1.30).
    const result =
        RecalibrationEffectiveness.computeEffectivenessScore(33.33, 28.33);

    check(Math.abs(result.score - 85.0) < 0.5, `mejora esperada 33.3%%, real 28.3%% -> efectividad ~84.9-85.0%% (sección 1/2) -- got ${result.score}`);
    check(result.isRegression === false && result.reason === null, "no es una regresión");
}

{
    // Sección 8 -- v4 -> v5.
    const r1 =
        RecalibrationEffectiveness.computeEffectivenessScore(31, 27);

    check(Math.abs(r1.score - 87.1) < 0.3, `esperado -31%%, real -27%% -> efectividad ~87%% -- got ${r1.score}`);

    // Sección 8 -- v5 -> v6, efectividad > 100% no es un error.
    const r2 =
        RecalibrationEffectiveness.computeEffectivenessScore(22, 25);

    check(r2.score > 100, `esperado -22%%, real -25%% -> efectividad > 100%% (sección 8: "no es un error") -- got ${r2.score}`);
    check(Math.abs(r2.score - 113.6) < 0.3, `efectividad ~114%% -- got ${r2.score}`);
}

{
    // Sección 3 -- REGRESIÓN: nunca se convierte un negativo en un
    // porcentaje de efectividad.
    const regression =
        RecalibrationEffectiveness.computeEffectivenessScore(20, -5);

    check(regression.score === null && regression.isRegression === true, "mejora_real < 0 -> score null, isRegression true, nunca un porcentaje fabricado (sección 3)");
}

{
    const noExpected =
        RecalibrationEffectiveness.computeEffectivenessScore(0, 10);

    check(noExpected.score === null && noExpected.reason === "NO_EXPECTED_IMPROVEMENT", "sin mejora esperada positiva -> score null con motivo explícito, nunca una división por cero");
}

// ---- classifyEffectivenessTier() (sección 3) ------------------------------

{
    check(RecalibrationEffectiveness.classifyEffectivenessTier(95).code === "HIGH", "95%% -> ALTA (>=90)");
    check(RecalibrationEffectiveness.classifyEffectivenessTier(90).code === "HIGH", "90%% (borde) -> ALTA");
    check(RecalibrationEffectiveness.classifyEffectivenessTier(84.9).code === "MODERATE", "84.9%% (sección 1 example) -> MODERADA (70-89)");
    check(RecalibrationEffectiveness.classifyEffectivenessTier(70).code === "MODERATE", "70%% (borde) -> MODERADA");
    check(RecalibrationEffectiveness.classifyEffectivenessTier(50).code === "LOW", "50%% -> BAJA (30-69)");
    check(RecalibrationEffectiveness.classifyEffectivenessTier(30).code === "LOW", "30%% (borde) -> BAJA");
    check(RecalibrationEffectiveness.classifyEffectivenessTier(15).code === "INEFFECTIVE", "15%% -> INEFECTIVA (<30)");
    check(RecalibrationEffectiveness.classifyEffectivenessTier(114).code === "HIGH", "114%% (>100, sección 8) -> sigue siendo ALTA, nunca se recorta a 100");
}

// ---- evaluate() orquestador (todas las secciones) -------------------------

{
    // Sección 1 -- caso completo v5.
    const result =
        RecalibrationEffectiveness.evaluate({

            simulationBaseline: { maeHours: 2.40, rmseHours: 3.10, biasHours: 0.90, sampleSize: 10 },

            simulated: { maeHours: 1.60, rmseHours: 2.26, biasHours: 0.20, sampleSize: 10 },

            realBaseline: { maeHours: 2.40, rmseHours: 3.10, biasHours: 0.82, sampleSize: 25 },

            real: { maeHours: 1.72, rmseHours: 2.75, biasHours: 0.31, sampleSize: 18 }

        });

    check(result.status === "VALID", `n=18 >= mínimo 10 -> VALID -- got ${result.status}`);
    check(Math.abs(result.expected.mae - 33.33) < 0.1, "mejora esperada de MAE ~33.3%%");
    check(Math.abs(result.actual.mae - 28.33) < 0.1, "mejora real de MAE ~28.3%%");
    check(Math.abs(result.effectivenessScore - 85.0) < 0.5, "efectividad ~84.9-85.0%%");
    check(result.tier.code === "MODERATE" && result.tier.label === "EFECTIVIDAD MODERADA", "84.9%% -> EFECTIVIDAD MODERADA (sección 10 mockup)");
    check(result.checks.mae === true, "MAE mejoró de verdad en el mundo real -> ✓");
    check(result.sampleSize === 18 && result.minimumSampleSize === 10, "expone muestra y mínimo -- 'Muestra: 18 / 10' (sección 10)");
}

{
    // Sección 9 -- n=4, PRELIMINAR, sin conclusión definitiva aunque el
    // número crudo daría una efectividad > 100%.
    const preliminary =
        RecalibrationEffectiveness.evaluate({

            simulationBaseline: { maeHours: 2.0, rmseHours: 2.5, biasHours: 0.5, sampleSize: 10 },

            simulated: { maeHours: 1.8, rmseHours: 2.3, biasHours: 0.4, sampleSize: 10 },

            realBaseline: { maeHours: 2.0, rmseHours: 2.5, biasHours: 0.5, sampleSize: 12 },

            real: { maeHours: 1.5, rmseHours: 2.0, biasHours: 0.3, sampleSize: 4 }

        });

    check(preliminary.status === "PRELIMINARY", `n=4 < mínimo 10 -> PRELIMINARY, nunca VALID -- got ${preliminary.status}`);
    check(preliminary.tier === null, "sin tier de efectividad mientras la evidencia es preliminar -- nunca se muestra un semáforo con datos insuficientes (sección 9)");
    check(preliminary.checks === null, "tampoco se muestran los checks ✓/✗ por métrica todavía");
}

{
    const pending =
        RecalibrationEffectiveness.evaluate({

            simulationBaseline: { maeHours: 2.0, rmseHours: 2.5, biasHours: 0.5, sampleSize: 10 },

            simulated: { maeHours: 1.8, rmseHours: 2.3, biasHours: 0.4, sampleSize: 10 },

            realBaseline: { maeHours: 2.0, rmseHours: 2.5, biasHours: 0.5, sampleSize: 0 },

            real: { maeHours: null, rmseHours: null, biasHours: null, sampleSize: 0 }

        });

    check(pending.status === "PENDING", "cero predicciones evaluadas todavía -> PENDING (recién activada)");
}

{
    // Sección 3/11 -- v5 del ejemplo de la sección 11: 20%% esperado,
    // -5%% real -> REGRESIÓN, muestra suficiente.
    const regressionCase =
        RecalibrationEffectiveness.evaluate({

            simulationBaseline: { maeHours: 2.5, rmseHours: 3.0, biasHours: 0.6, sampleSize: 10 },

            simulated: { maeHours: 2.0, rmseHours: 2.6, biasHours: 0.3, sampleSize: 10 },

            realBaseline: { maeHours: 2.5, rmseHours: 3.0, biasHours: 0.6, sampleSize: 22 },

            real: { maeHours: 2.625, rmseHours: 3.2, biasHours: 0.9, sampleSize: 15 }

        });

    check(regressionCase.status === "REGRESSION", `mejora real negativa con muestra VALID -> REGRESSION -- got ${regressionCase.status}`);
    check(regressionCase.effectivenessScore === null, "sin porcentaje de efectividad fabricado para una regresión (sección 3)");
    check(regressionCase.isRegression === true, "isRegression expuesto explícitamente para la UI ('⚠ REGRESIÓN')");
}

{
    // Regresión pero CON evidencia todavía preliminar -- no se anuncia
    // como REGRESSION definitiva todavía (sección 9 aplica también a
    // las malas noticias).
    const earlyBadSign =
        RecalibrationEffectiveness.evaluate({

            simulationBaseline: { maeHours: 2.0, rmseHours: 2.5, biasHours: 0.5, sampleSize: 10 },

            simulated: { maeHours: 1.6, rmseHours: 2.1, biasHours: 0.3, sampleSize: 10 },

            realBaseline: { maeHours: 2.0, rmseHours: 2.5, biasHours: 0.5, sampleSize: 6 },

            real: { maeHours: 2.3, rmseHours: 2.9, biasHours: 0.8, sampleSize: 3 }

        });

    check(earlyBadSign.status === "PRELIMINARY", "con solo 3 muestras, una señal de empeoramiento temprana se reporta como PRELIMINARY, no como REGRESSION todavía (evitar conclusiones prematuras, sección 9)");
}

console.log(`${passed} passed`);
