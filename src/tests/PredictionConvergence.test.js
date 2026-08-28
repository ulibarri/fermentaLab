const assert =
    require("assert");

const PredictionConvergence =
    require("../utils/PredictionConvergence");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

function evaluated(id, predictedAt, absoluteErrorHours) {

    return {

        id,

        status: "EVALUATED",

        predictedAt,

        predictedMaturationAt: predictedAt,

        absoluteErrorHours

    };

}

// ---- spec sección 8, ejemplo literal -----------------------------------
// 08:00 -> +1h25 (1.4167h) / 12:00 -> +0h40 (0.6667h) / 16:00 -> +0h10 (0.1667h)

{
    const predictions = [

        evaluated(1, "2026-08-17T08:00:00.000Z", 1.42),

        evaluated(2, "2026-08-17T12:00:00.000Z", 0.67),

        evaluated(3, "2026-08-17T16:00:00.000Z", 0.17)

    ];

    const result =
        PredictionConvergence.summarize(predictions);

    check(result.applicable === true, "3 predicciones evaluadas -> applicable true");
    check(result.initial.id === 1, "inicial = primera cronológicamente (08:00)");
    check(result.intermediate.id === 2, "intermedia = la de en medio con exactamente 3 evaluadas (12:00), sección 8");
    check(result.final.id === 3, "final = última cronológicamente (16:00)");
    check(result.trend === "MEJORANDO", `spec sección 8: error decrece de 1.42h a 0.17h (>5%% de mejora) -> MEJORANDO -- got ${result.trend}`);
}

// ---- EMPEORANDO ----------------------------------------------------------

{
    const predictions = [

        evaluated(1, "2026-08-17T08:00:00.000Z", 0.5),

        evaluated(2, "2026-08-17T16:00:00.000Z", 2.0)

    ];

    const result =
        PredictionConvergence.summarize(predictions);

    check(result.trend === "EMPEORANDO", `error crece de 0.5h a 2h -> EMPEORANDO -- got ${result.trend}`);
    check(result.intermediate === null, "solo 2 evaluadas -> sin intermedia (sería igual a inicial o final)");
}

// ---- ESTABLE (cambio dentro del umbral de ruido, 5%) --------------------

{
    const predictions = [

        evaluated(1, "2026-08-17T08:00:00.000Z", 1.0),

        evaluated(2, "2026-08-17T16:00:00.000Z", 0.98)

    ];

    const result =
        PredictionConvergence.summarize(predictions);

    check(result.trend === "ESTABLE", `cambio de 2%%, por debajo del umbral de 5%% (reutilizado de PostActivationEvaluation) -> ESTABLE -- got ${result.trend}`);
}

// ---- Robustez (sección 9/10 del spec general -- nunca fabricar nada) ----

{
    const noPredictions =
        PredictionConvergence.summarize([]);

    check(noPredictions.applicable === false && noPredictions.reason === "NO_PREDICTIONS", "sin predicciones -> applicable false, reason NO_PREDICTIONS");
}

{
    const onlyPending =
        PredictionConvergence.summarize([

            { id: 1, status: "PENDING", absoluteErrorHours: null }

        ]);

    check(onlyPending.applicable === false && onlyPending.reason === "NOT_EVALUATED", "predicciones existen pero ninguna evaluada todavía (lote sin finalizar) -> NOT_EVALUATED, nunca inventa un error");
}

{
    const single =
        PredictionConvergence.summarize([ evaluated(1, "2026-08-17T08:00:00.000Z", 0.5) ]);

    check(single.applicable === true, "una sola predicción evaluada -> applicable true (hay al menos un punto que mostrar)");
    check(single.trend === "INSUFFICIENT_DATA", "una sola predicción -> no hay tendencia que calcular, nunca fabricada");
    check(single.initial.id === 1 && single.final.id === 1, "inicial y final son la misma única predicción");
}

{
    const zeroToZero =
        PredictionConvergence.summarize([

            evaluated(1, "2026-08-17T08:00:00.000Z", 0),

            evaluated(2, "2026-08-17T16:00:00.000Z", 0)

        ]);

    check(zeroToZero.trend === "ESTABLE", "error inicial ya era 0 y se mantiene en 0 -> ESTABLE, no una división por cero");
}

console.log(`\n${passed} assertions passed.`);
