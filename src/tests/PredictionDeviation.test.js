const assert =
    require("assert");

const PredictionDeviation =
    require("../utils/PredictionDeviation");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

// ---- classifySeverityByMinutes() (sección 3) ---------------------------

{
    check(PredictionDeviation.classifySeverityByMinutes(60) === "NORMAL", "60 min, bajo el umbral WARNING (120) -> NORMAL");
    check(PredictionDeviation.classifySeverityByMinutes(120) === "WARNING", "exactamente 120 min -> WARNING (>=, no solo >)");
    check(PredictionDeviation.classifySeverityByMinutes(135) === "WARNING", `sección 2, ejemplo literal: +2h15 (135 min) -> WARNING -- got ${PredictionDeviation.classifySeverityByMinutes(135)}`);
    check(PredictionDeviation.classifySeverityByMinutes(300) === "SIGNIFICANT", `sección 2, ejemplo literal: +5h (300 min) -> SIGNIFICANT -- got ${PredictionDeviation.classifySeverityByMinutes(300)}`);
    check(PredictionDeviation.classifySeverityByMinutes(480) === "CRITICAL", "exactamente 480 min -> CRITICAL");
    check(PredictionDeviation.classifySeverityByMinutes(600) === "CRITICAL", "600 min, por encima del umbral CRITICAL -> CRITICAL");
    check(PredictionDeviation.classifySeverityByMinutes(null) === "NORMAL", "null -> NORMAL, nunca lanza");

    const customThresholds =
        PredictionDeviation.classifySeverityByMinutes(90, { warningMinutes: 60, significantMinutes: 200, criticalMinutes: 400 });

    check(customThresholds === "WARNING", "umbrales configurables -- 90 min supera un warningMinutes de 60 aunque no supere el default de 120");
}

// ---- evaluate() -- sección 4: cambio pequeño nunca alerta --------------

{
    const result =
        PredictionDeviation.evaluate({

            expectedFinishAt: "2026-08-18T18:00:00.000Z",

            expectedLowerBound: "2026-08-18T16:00:00.000Z",

            expectedUpperBound: "2026-08-18T20:00:00.000Z",

            predictedFinishAt: "2026-08-18T18:20:00.000Z"

        });

    check(result.applicable === true, "hay predicción anterior con la que comparar -> applicable true");
    check(result.status === "NORMAL", `sección 4: 18:00 -> 18:20 nunca debería alertar -- got ${result.status}`);
    check(result.deviationMinutes === 20, "desviación de 20 minutos calculada correctamente");
}

// ---- evaluate() -- sección 5, ejemplo 1: dentro del intervalo ----------

{
    const result =
        PredictionDeviation.evaluate({

            expectedFinishAt: "2026-08-18T18:00:00.000Z",

            expectedLowerBound: "2026-08-18T16:00:00.000Z",

            expectedUpperBound: "2026-08-18T20:00:00.000Z",

            predictedFinishAt: "2026-08-18T19:15:00.000Z"

        });

    check(result.intervalStatus === "IN_RANGE", "19:15 cae dentro de 16:00-20:00 -> IN_RANGE");
    check(result.status === "NORMAL" && result.severity === "NORMAL", `sección 5, ejemplo literal: 19:15 sigue dentro del rango -> Estado NORMAL -- got ${result.status}`);
}

// ---- evaluate() -- sección 5, ejemplo 2: fuera del intervalo -----------

{
    const result =
        PredictionDeviation.evaluate({

            expectedFinishAt: "2026-08-18T18:00:00.000Z",

            expectedLowerBound: "2026-08-18T16:00:00.000Z",

            expectedUpperBound: "2026-08-18T20:00:00.000Z",

            predictedFinishAt: "2026-08-18T22:30:00.000Z"

        });

    check(result.intervalStatus === "OUT_OF_RANGE", "22:30 cae fuera de 16:00-20:00 -> OUT_OF_RANGE");
    check(result.status === "DEVIATION", `sección 5, ejemplo literal: 22:30 está claramente fuera -> Estado DESVIACIÓN -- got ${result.status}`);
    check(result.severity === "WARNING", `+4h30 (270 min), por debajo del umbral SIGNIFICANT (300) pero por encima de WARNING (120) -> WARNING -- got ${result.severity}`);
    check(result.direction === "SLOWER", "predicción se atrasó -> SLOWER");
}

// ---- evaluate() -- sin intervalo disponible: fallback a minutos --------

{
    const result =
        PredictionDeviation.evaluate({

            expectedFinishAt: "2026-08-18T17:00:00.000Z",

            expectedLowerBound: null,

            expectedUpperBound: null,

            predictedFinishAt: "2026-08-18T22:00:00.000Z"

        });

    check(result.intervalStatus === "UNAVAILABLE", "sin ventana de confianza en la predicción base -> UNAVAILABLE");
    check(result.severity === "SIGNIFICANT", `sección 2, ejemplo literal: 17:00 -> 22:00 (+5h) -> SIGNIFICANT -- got ${result.severity}`);
    check(result.status === "DEVIATION", "sin intervalo, la severidad por minutos decide el estado");
}

// ---- evaluate() -- robustez ---------------------------------------------

{
    const noBaseline =
        PredictionDeviation.evaluate({ expectedFinishAt: null, predictedFinishAt: "2026-08-18T18:00:00.000Z" });

    check(noBaseline.applicable === false, "sin predicción anterior (primera del lote) -> applicable false, nunca fabrica una desviación");
}

{
    const noPrediction =
        PredictionDeviation.evaluate({ expectedFinishAt: "2026-08-18T18:00:00.000Z", predictedFinishAt: null });

    check(noPrediction.applicable === false, "sin predicción actual -> applicable false");
}

{
    const faster =
        PredictionDeviation.evaluate({

            expectedFinishAt: "2026-08-18T18:00:00.000Z",

            expectedLowerBound: "2026-08-18T17:00:00.000Z",

            expectedUpperBound: "2026-08-18T19:00:00.000Z",

            predictedFinishAt: "2026-08-18T12:00:00.000Z"

        });

    check(faster.direction === "FASTER", "predicción se adelantó -> FASTER");
    check(faster.deviationMinutes === -360, "desviación negativa para adelantos");
    check(faster.severity === "SIGNIFICANT", "6h de adelanto, fuera de rango -> también gradúa severidad (no solo desviaciones tardías)");
}

console.log(`\n${passed} assertions passed.`);
