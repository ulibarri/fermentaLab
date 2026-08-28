const assert =
    require("assert");

const PredictionRelevance =
    require("../utils/PredictionRelevance");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

// ---- isRelevant() -------------------------------------------------------

{
    const relevant =
        PredictionRelevance.isRelevant({

            measurement: { phase: "F1", ph: 4.2 },

            maturationMetric: "ph"

        });

    check(relevant === true, "medición F1 con valor no nulo para la métrica del modelo -> relevante");
}

{
    const irrelevant =
        PredictionRelevance.isRelevant({

            measurement: { phase: "F1", ph: null, psi: 12 },

            maturationMetric: "ph"

        });

    check(irrelevant === false, "medición F1 sin valor para la métrica del modelo (solo PSI) -> NO relevante, sección 2");
}

{
    const missingField =
        PredictionRelevance.isRelevant({

            measurement: { phase: "F1", psi: 12 },

            maturationMetric: "brix"

        });

    check(missingField === false, "campo de la métrica ni siquiera presente en la medición -> NO relevante");
}

{
    const wrongPhase =
        PredictionRelevance.isRelevant({

            measurement: { phase: "F2", ph: 4.2 },

            maturationMetric: "ph"

        });

    check(wrongPhase === false, "medición de otra fase (F2) -> NO relevante para la predicción F1");
}

{
    const noMeasurement =
        PredictionRelevance.isRelevant({ measurement: null, maturationMetric: "ph" });

    check(noMeasurement === false, "sin medición -> NO relevante, nunca lanza");
}

{
    const noMetric =
        PredictionRelevance.isRelevant({ measurement: { phase: "F1", ph: 4.2 }, maturationMetric: null });

    check(noMetric === false, "sin maturationMetric configurado -> NO relevante");
}

{
    const zeroValue =
        PredictionRelevance.isRelevant({

            measurement: { phase: "F1", brix: 0 },

            maturationMetric: "brix"

        });

    check(zeroValue === true, "valor 0 es un valor válido (distinto de null/undefined) -> SÍ relevante");
}

{
    const emptyString =
        PredictionRelevance.isRelevant({

            measurement: { phase: "F1", specificGravity: "" },

            maturationMetric: "specificGravity"

        });

    check(emptyString === false, "cadena vacía se trata como 'sin valor' -> NO relevante");
}

console.log(`\n${passed} assertions passed.`);
