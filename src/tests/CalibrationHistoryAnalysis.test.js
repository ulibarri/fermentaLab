const assert =
    require("assert");

const CalibrationHistoryAnalysis =
    require("../utils/CalibrationHistoryAnalysis");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

// ---- classifyEvidenceLevel() (sección 10) --------------------------------

{
    const insufficient =
        CalibrationHistoryAnalysis.classifyEvidenceLevel(3);

    check(insufficient.code === "INSUFFICIENT" && insufficient.label === "INSUFICIENTE", "n=3 (<5) -> INSUFICIENTE");
}

{
    const initial8 =
        CalibrationHistoryAnalysis.classifyEvidenceLevel(8);

    check(initial8.code === "INITIAL" && initial8.label === "INICIAL", "n=8 (5-9, spec's own v5 sección 9 example) -> INICIAL");
}

{
    const significant18 =
        CalibrationHistoryAnalysis.classifyEvidenceLevel(18);

    check(significant18.code === "SIGNIFICANT" && significant18.label === "SIGNIFICATIVA", "n=18 (spec's own sección 10 example) -> SIGNIFICATIVA");
}

{
    const boundary =
        CalibrationHistoryAnalysis.classifyEvidenceLevel(10);

    check(boundary.code === "SIGNIFICANT", "n=10 (boundary, >=10) -> SIGNIFICATIVA");
}

// ---- compareConsecutiveVersions() (secciones 5/7) ------------------------

{
    // Reproduce la intención de la sección 7 (v3 -> v4 "empeoró"),
    // usando una tripleta sintética consistente (MAE/RMSE/Bias
    // empeorando los tres) ya que el ejemplo numérico de esa sección no
    // trae RMSE/Bias propios.
    const degraded =
        CalibrationHistoryAnalysis.compareConsecutiveVersions(

            { sampleSize: 15, maeHours: 1.82, rmseHours: 2.31, biasHours: 0.41 },

            { sampleSize: 12, maeHours: 2.14, rmseHours: 2.83, biasHours: 0.72 }

        );

    check(degraded.result === "DEGRADED" && degraded.resultLabel === "DEGRADACIÓN", "sección 7 -- MAE/RMSE/Bias empeorando los tres -> DEGRADED/DEGRADACIÓN");
}

{
    // Sección 2/5 -- v4 -> v5 mejorando en las tres métricas.
    const improved =
        CalibrationHistoryAnalysis.compareConsecutiveVersions(

            { sampleSize: 22, maeHours: 1.82, rmseHours: 2.31, biasHours: 0.41 },

            { sampleSize: 18, maeHours: 1.43, rmseHours: 1.91, biasHours: 0.18 }

        );

    check(improved.result === "IMPROVED" && improved.resultLabel === "MEJORA", "sección 5 -- v4 -> v5 mejorando -> IMPROVED/MEJORA");

    check(typeof improved.metrics.mae === "number" && improved.metrics.mae > 0, "expone el % de mejora de MAE (sección 5: '1.82 -> 1.43 h, Mejora: 21.4%')");
}

{
    const noPrevious =
        CalibrationHistoryAnalysis.compareConsecutiveVersions(null, { sampleSize: 18, maeHours: 1.43, rmseHours: 1.91, biasHours: 0.18 });

    check(noPrevious.result === null && noPrevious.reason === "NO_PREVIOUS_EVALUATION", "sin evaluación de la versión anterior -> result null, nunca fabricado (sección 13)");
}

{
    const noCurrent =
        CalibrationHistoryAnalysis.compareConsecutiveVersions({ sampleSize: 18, maeHours: 1.43, rmseHours: 1.91, biasHours: 0.18 }, null);

    check(noCurrent.result === null && noCurrent.reason === "NO_CURRENT_EVALUATION", "sin evaluación de la versión actual -> result null, nunca fabricado");
}

// ---- computeCumulativeImprovement() (sección 6) --------------------------

{
    // Sección 6, ejemplo literal: MAE 3.42 -> 1.43, mejora acumulada 58.2%.
    const cumulative =
        CalibrationHistoryAnalysis.computeCumulativeImprovement(

            { maeHours: 3.42, rmseHours: 4.11, biasHours: 2.10 },

            { maeHours: 1.43, rmseHours: 1.91, biasHours: 0.18 }

        );

    check(Math.abs(cumulative.mae - 58.19) < 0.1, `mejora acumulada de MAE ~58.2% (spec section 6) -- got ${cumulative.mae}`);

    check(cumulative.rmse > 0 && cumulative.bias > 0, "RMSE y Bias también se reportan como mejora acumulada");
}

{
    const noData =
        CalibrationHistoryAnalysis.computeCumulativeImprovement(null, { maeHours: 1.43, rmseHours: 1.91, biasHours: 0.18 });

    check(noData === null, "sin métricas de la primera calibración -> null, nunca fabricado");
}

// ---- computeActiveDuration() (sección 8) ---------------------------------

{
    // Sección 8, ejemplo literal: v3 activada 01 Ago, reemplazada 07
    // Ago -> 6 días.
    const v3 =
        CalibrationHistoryAnalysis.computeActiveDuration({

            activatedAt: "2026-08-01T00:00:00.000Z",

            deactivatedAt: "2026-08-07T00:00:00.000Z"

        });

    check(v3.applicable === true && v3.durationDays === 6 && v3.isOngoing === false, `v3: activada 01 Ago, reemplazada 07 Ago -> 6 días, no en curso -- got ${JSON.stringify(v3)}`);
}

{
    // v4 activada 07 Ago, reemplazada 13 Ago -> 6 días.
    const v4 =
        CalibrationHistoryAnalysis.computeActiveDuration({

            activatedAt: "2026-08-07T00:00:00.000Z",

            deactivatedAt: "2026-08-13T00:00:00.000Z"

        });

    check(v4.durationDays === 6, `v4: 07 Ago -> 13 Ago -> 6 días -- got ${v4.durationDays}`);
}

{
    // v5 activada 13 Ago, "activa desde hace 2 días" -- now = 15 Ago.
    const v5 =
        CalibrationHistoryAnalysis.computeActiveDuration({

            activatedAt: "2026-08-13T00:00:00.000Z",

            deactivatedAt: null,

            now: "2026-08-15T00:00:00.000Z"

        });

    check(v5.applicable === true && v5.durationDays === 2 && v5.isOngoing === true, `v5: activa desde 13 Ago, ahora 15 Ago -> 2 días, EN CURSO -- got ${JSON.stringify(v5)}`);
}

{
    const neverActivated =
        CalibrationHistoryAnalysis.computeActiveDuration({ activatedAt: null, deactivatedAt: null });

    check(neverActivated.applicable === false && neverActivated.durationDays === null, "nunca activada (PROPOSED/APPROVED/REJECTED) -> no aplica, nunca un 0 fabricado");
}

console.log(`${passed} passed`);
