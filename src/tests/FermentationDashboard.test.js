const assert =
    require("assert");

const FermentationDashboard =
    require("../utils/FermentationDashboard");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

// ---- classifyPredictionAvailability() (secciones 11/12) ----------------

{
    check(FermentationDashboard.classifyPredictionAvailability({ hasCurrentPrediction: true, hasF1Measurement: true }) === "AVAILABLE", "con predicción vigente -> AVAILABLE, sin importar mediciones");

    check(FermentationDashboard.classifyPredictionAvailability({ hasCurrentPrediction: false, hasF1Measurement: false }) === "ESPERANDO_DATOS", "sección 11: sin predicción y sin mediciones F1 -> ESPERANDO_DATOS");

    check(FermentationDashboard.classifyPredictionAvailability({ hasCurrentPrediction: false, hasF1Measurement: true }) === "NO_DISPONIBLE", "sección 12: hay mediciones pero no hay predicción -> NO_DISPONIBLE (ej. sin modelo activo)");
}

// ---- resolveSeverity() ---------------------------------------------------

{
    check(FermentationDashboard.resolveSeverity({ activeAlertSeverity: "CRITICAL", predictionAvailability: "AVAILABLE" }) === "CRITICAL", "alerta activa siempre gana -- nunca se recalcula la severidad aquí");

    check(FermentationDashboard.resolveSeverity({ activeAlertSeverity: null, predictionAvailability: "AVAILABLE" }) === "NORMAL", "predicción disponible sin alerta -> NORMAL");

    check(FermentationDashboard.resolveSeverity({ activeAlertSeverity: null, predictionAvailability: "ESPERANDO_DATOS" }) === "ESPERANDO_DATOS", "sin predicción -> el código de disponibilidad, nunca NORMAL inventado");
}

// ---- priorityRank() / comparePriority() (sección 2) ---------------------

{
    check(FermentationDashboard.priorityRank("CRITICAL") < FermentationDashboard.priorityRank("SIGNIFICANT"), "CRITICAL antes que SIGNIFICANT");
    check(FermentationDashboard.priorityRank("SIGNIFICANT") < FermentationDashboard.priorityRank("WARNING"), "SIGNIFICANT antes que WARNING");
    check(FermentationDashboard.priorityRank("WARNING") < FermentationDashboard.priorityRank("NORMAL"), "WARNING antes que NORMAL");
    check(FermentationDashboard.priorityRank("NORMAL") < FermentationDashboard.priorityRank("NO_DISPONIBLE"), "NORMAL antes que NO_DISPONIBLE -- sin predicción nunca se trata como desviación");
    check(FermentationDashboard.priorityRank("NO_DISPONIBLE") < FermentationDashboard.priorityRank("ESPERANDO_DATOS"), "NO_DISPONIBLE antes que ESPERANDO_DATOS (más digno de revisión)");
}

{
    const items = [

        { severity: "NORMAL", lastMeasurementMinutesAgo: 10 },

        { severity: "CRITICAL", alertCreatedAt: "2026-08-19T10:00:00.000Z" },

        { severity: "WARNING", alertCreatedAt: "2026-08-19T08:00:00.000Z" },

        { severity: "SIGNIFICANT", alertCreatedAt: "2026-08-19T09:00:00.000Z" }

    ];

    const sorted =
        [...items].sort((a, b) => FermentationDashboard.comparePriority(a, b));

    check(sorted.map(i => i.severity).join(",") === "CRITICAL,SIGNIFICANT,WARNING,NORMAL", `sección 2, orden literal: críticas, luego significativas, luego advertencias, luego normales -- got ${sorted.map(i => i.severity).join(",")}`);
}

{
    const sameTier = [

        { severity: "WARNING", alertCreatedAt: "2026-08-19T09:00:00.000Z" },

        { severity: "WARNING", alertCreatedAt: "2026-08-19T06:00:00.000Z" }

    ];

    const sorted =
        [...sameTier].sort((a, b) => FermentationDashboard.comparePriority(a, b));

    check(sorted[0].alertCreatedAt === "2026-08-19T06:00:00.000Z", "sección 2: dentro del mismo nivel, ordena por antigüedad de la alerta (la más vieja primero)");
}

// ---- classifyActivity() (sección 5) --------------------------------------

{
    const recent =
        FermentationDashboard.classifyActivity({ lastMeasurementDate: "2026-08-19T11:35:00.000Z", now: "2026-08-19T12:00:00.000Z" });

    check(recent.minutesAgo === 25, `sección 5, ejemplo literal: "hace 25 min" -- got ${recent.minutesAgo}`);
    check(recent.stale === false, "25 min no es antiguo -- sin ⚠");
}

{
    const stale =
        FermentationDashboard.classifyActivity({ lastMeasurementDate: "2026-08-19T05:00:00.000Z", now: "2026-08-19T12:00:00.000Z" });

    check(stale.minutesAgo === 420, "7 horas = 420 minutos");
    check(stale.stale === true, `sección 5, ejemplo literal: "hace 7 h ⚠" -- por encima del umbral, debe marcarse como antiguo -- got ${stale.stale}`);
}

{
    const noMeasurement =
        FermentationDashboard.classifyActivity({ lastMeasurementDate: null });

    check(noMeasurement.minutesAgo === null && noMeasurement.stale === false, "sin ninguna medición todavía -> null, nunca fabricado ni marcado ⚠ por defecto");
}

{
    const customThreshold =
        FermentationDashboard.classifyActivity({ lastMeasurementDate: "2026-08-19T11:00:00.000Z", now: "2026-08-19T12:00:00.000Z", staleThresholdMinutes: 30 });

    check(customThreshold.stale === true, "umbral configurable -- 60 min supera un staleThresholdMinutes de 30 aunque no supere el default de 360");
}

// ---- summarize() (sección 3/13) ------------------------------------------

{
    const items = [

        { severity: "NORMAL" },

        { severity: "NORMAL" },

        { severity: "NORMAL" },

        { severity: "WARNING" },

        { severity: "SIGNIFICANT" },

        { severity: "CRITICAL" }

    ];

    const summary =
        FermentationDashboard.summarize(items);

    check(summary.active === 6, "sección 3, ejemplo literal: 6 lotes activos");
    check(summary.normal === 3, "3 normales");
    check(summary.warning === 2, "WARNING+SIGNIFICANT plegados en una sola categoría 'atención' -- 2 (1 WARNING + 1 SIGNIFICANT)");
    check(summary.critical === 1, "1 crítico");
    check(summary.active === summary.normal + summary.warning + summary.critical + summary.noPrediction, "las categorías siempre suman exactamente el total activo -- ningún lote desaparece del resumen");
}

{
    const withoutPrediction =
        FermentationDashboard.summarize([ { severity: "ESPERANDO_DATOS" }, { severity: "NO_DISPONIBLE" } ]);

    check(withoutPrediction.noPrediction === 2, "lotes sin predicción -> categoría aparte, nunca contados como normales");
    check(withoutPrediction.normal === 0, "nunca se asume NORMAL para un lote sin predicción todavía");
}

console.log(`\n${passed} assertions passed.`);
