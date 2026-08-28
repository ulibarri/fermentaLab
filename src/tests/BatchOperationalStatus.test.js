const assert =
    require("assert");

const BatchOperationalStatus =
    require("../utils/BatchOperationalStatus");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

const LOWER =
    "2026-08-18T11:00:00.000Z";

const UPPER =
    "2026-08-18T18:00:00.000Z";
// Ventana de 7h -> el 25% final (NEAR_LIMIT_WINDOW_FRACTION) son las
// últimas 1.75h, es decir desde las 16:15.

// ---- classifyRangeStatus() (sección 3) --------------------------------

{
    const early = BatchOperationalStatus.classifyRangeStatus({ now: "2026-08-18T12:00:00.000Z", lowerBound: LOWER, upperBound: UPPER });

    check(early.code === "IN_RANGE", `12:00, bien dentro de la ventana -> 🟢 EN RANGO -- got ${early.code}`);
    check(early.emoji === "🟢", "emoji verde");
}

{
    const nearLimit = BatchOperationalStatus.classifyRangeStatus({ now: "2026-08-18T17:00:00.000Z", lowerBound: LOWER, upperBound: UPPER });

    check(nearLimit.code === "NEAR_LIMIT", `17:00, dentro del último 25%% antes de las 18:00 -> 🟡 CERCA DEL LÍMITE -- got ${nearLimit.code}`);
}

{
    const justBeforeLimit = BatchOperationalStatus.classifyRangeStatus({ now: "2026-08-18T16:10:00.000Z", lowerBound: LOWER, upperBound: UPPER });

    check(justBeforeLimit.code === "IN_RANGE", "16:10, justo ANTES del umbral de 16:15 -> todavía EN RANGO (borde correcto)");
}

{
    const atLimit = BatchOperationalStatus.classifyRangeStatus({ now: UPPER, lowerBound: LOWER, upperBound: UPPER });

    check(atLimit.code === "OUT_OF_RANGE", "exactamente en el límite superior -> 🔴 FUERA DE PREDICCIÓN (>=, no solo >)");
}

{
    const outOfRange = BatchOperationalStatus.classifyRangeStatus({ now: "2026-08-18T20:00:00.000Z", lowerBound: LOWER, upperBound: UPPER });

    check(outOfRange.code === "OUT_OF_RANGE", `20:00, pasado el límite -> 🔴 FUERA DE PREDICCIÓN -- got ${outOfRange.code}`);
}

{
    const unavailable = BatchOperationalStatus.classifyRangeStatus({ now: "2026-08-18T12:00:00.000Z", lowerBound: null, upperBound: null });

    check(unavailable.code === "UNAVAILABLE", "sin ventana de confianza -> UNAVAILABLE, nunca un estado inventado");
}

// ---- classifyDrift() (sección 6) --------------------------------------

{
    const spec = BatchOperationalStatus.classifyDrift({

        previousPredictedMaturationAt: "2026-08-18T18:00:00.000Z",

        currentPredictedMaturationAt: "2026-08-18T22:15:00.000Z"

    });

    check(spec.code === "SIGNIFICANT", `spec sección 6, ejemplo literal: 18:00 -> 22:15 (+4h15) -> SIGNIFICANT -- got ${spec.code}`);
    check(spec.driftHours === 4.25, `+4.25h -- got ${spec.driftHours}`);
    check(spec.direction === "SLOWER", "predicción se atrasó -> SLOWER (fermentación más lenta de lo esperado)");
}

{
    const faster = BatchOperationalStatus.classifyDrift({

        previousPredictedMaturationAt: "2026-08-18T18:00:00.000Z",

        currentPredictedMaturationAt: "2026-08-18T14:00:00.000Z"

    });

    check(faster.code === "SIGNIFICANT" && faster.direction === "FASTER" && faster.driftHours === -4, "predicción se adelantó 4h -> SIGNIFICANT, FASTER, driftHours negativo");
}

{
    const minor = BatchOperationalStatus.classifyDrift({

        previousPredictedMaturationAt: "2026-08-18T18:00:00.000Z",

        currentPredictedMaturationAt: "2026-08-18T19:30:00.000Z"

    });

    check(minor.code === "NONE", "deriva de 1.5h, por debajo del umbral de 2h -> NONE (ruido normal, no alerta)");
}

{
    const noPrevious = BatchOperationalStatus.classifyDrift({ previousPredictedMaturationAt: null, currentPredictedMaturationAt: "2026-08-18T18:00:00.000Z" });

    check(noPrevious.code === "NONE" && noPrevious.driftHours === null, "sin predicción anterior (primera del lote) -> NONE, nada que comparar todavía");
}

{
    const customThreshold = BatchOperationalStatus.classifyDrift({

        previousPredictedMaturationAt: "2026-08-18T18:00:00.000Z",

        currentPredictedMaturationAt: "2026-08-18T19:30:00.000Z",

        thresholdHours: 1

    });

    check(customThreshold.code === "SIGNIFICANT", "umbral configurable -- 1.5h supera un umbral de 1h aunque no supere el default de 2h");
}

console.log(`\n${passed} assertions passed.`);
