const assert =
    require("assert");

const PredictionConfidence =
    require("../utils/PredictionConfidence");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

// ---- computeWindow() -------------------------------------------------

{
    const w = PredictionConfidence.computeWindow("2026-08-18T14:30:00.000Z", 3.5);

    check(w.lowerBound === "2026-08-18T11:00:00.000Z", `spec sección 1, ejemplo literal: predicción 14:30 -3.5h -> 11:00 -- got ${w.lowerBound}`);
    check(w.upperBound === "2026-08-18T18:00:00.000Z", `spec sección 1, ejemplo literal: predicción 14:30 +3.5h -> 18:00 -- got ${w.upperBound}`);
    check(w.windowHours === 7, "ancho total = 2x el rmse (semiancho)");

    check(PredictionConfidence.computeWindow(null, 3) === null, "sin predictedMaturationAt -> null, nunca fabricado");
    check(PredictionConfidence.computeWindow("2026-08-18T14:30:00.000Z", null) === null, "sin rmseHours -> null");
    check(PredictionConfidence.computeWindow("2026-08-18T14:30:00.000Z", -2).lowerBound !== undefined, "rmse negativo se trata como magnitud (Math.abs), no revierte el rango");
}

// ---- computeConfidencePercentage() ------------------------------------

{
    check(PredictionConfidence.computeConfidencePercentage(8) === 87, `sección 1, ejemplo literal: muestra suficiente (>=5) -> 87%% -- got ${PredictionConfidence.computeConfidencePercentage(8)}`);
    check(PredictionConfidence.computeConfidencePercentage(5) === 87, "n=5 (mínimo exacto de ModelAccuracyMetrics.MIN_SUFFICIENT_SAMPLE) -> 87%");
    check(PredictionConfidence.computeConfidencePercentage(4) === 55, "n=4 (por debajo del mínimo) -> confianza baja, no 87%");
    check(PredictionConfidence.computeConfidencePercentage(0) === null, "n=0 -> null, nunca 0%% (0%% sugeriría certeza de error, no ausencia de evidencia)");
    check(PredictionConfidence.computeConfidencePercentage(null) === null, "sampleSize null -> null");
}

// ---- evaluate() --------------------------------------------------------

{
    const result = PredictionConfidence.evaluate({

        predictedMaturationAt: "2026-08-18T14:30:00.000Z",

        rmseHours: 3.5,

        sampleSize: 8,

        basis: "CALIBRATION"

    });

    check(result.applicable === true, "con rmse y muestra suficientes -> applicable true");
    check(result.basis === "CALIBRATION", "basis se conserva tal cual lo decide el llamador");
    check(result.confidencePercentage === 87, "87%% (spec, sección 1)");
    check(result.windowHours === 7, "ventana de 7h total");
    check(result.sampleSize === 8, "sampleSize expuesto para trazabilidad (sección 8)");
}

{
    const unavailable = PredictionConfidence.evaluate({

        predictedMaturationAt: "2026-08-18T14:30:00.000Z",

        rmseHours: null,

        sampleSize: 0,

        basis: "MODEL"

    });

    check(unavailable.applicable === false, "sin evidencia -> applicable false");
    check(unavailable.basis === "UNAVAILABLE", "basis se fuerza a UNAVAILABLE cuando no hay ventana calculable, sin importar lo que pidiera el llamador");
    check(unavailable.lowerBound === null && unavailable.upperBound === null && unavailable.confidencePercentage === null, "ningún campo fabricado");
}

{
    const noEta = PredictionConfidence.evaluate({ predictedMaturationAt: null, rmseHours: 3, sampleSize: 10, basis: "MODEL" });

    check(noEta.applicable === false, "sin predictedMaturationAt (modelo divergente/insuficiente) -> applicable false, nunca lanza error");
}

console.log(`\n${passed} assertions passed.`);
