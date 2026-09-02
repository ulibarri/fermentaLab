const assert =
    require("assert");

const OperationalReport =
    require("../utils/OperationalReport");

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

console.log("OperationalReport tests\n");

// --- buildPriorityAlerts (sección 8: CRITICAL, luego antigüedad, luego severidad) ---

test("buildPriorityAlerts: CRITICAL siempre primero sin importar antigüedad", () => {

    const oldestActive = [

        { id: 1, batchId: 10, batchNumber: "TP-1", severity: "WARNING", activeMinutes: 1000 },

        { id: 2, batchId: 11, batchNumber: "TP-2", severity: "CRITICAL", activeMinutes: 10 }

    ];

    const result =
        OperationalReport.buildPriorityAlerts(oldestActive);

    assert.strictEqual(result[0].id, 2, "CRITICAL debe ir primero aunque sea la más reciente");
    assert.strictEqual(result[1].id, 1);

});

test("buildPriorityAlerts: dentro del mismo nivel (ambas CRITICAL), ordena por antigüedad", () => {

    const oldestActive = [

        { id: 1, severity: "CRITICAL", activeMinutes: 60 },

        { id: 2, severity: "CRITICAL", activeMinutes: 360 },

        { id: 3, severity: "CRITICAL", activeMinutes: 180 }

    ];

    const result =
        OperationalReport.buildPriorityAlerts(oldestActive);

    assert.deepStrictEqual(result.map(a => a.id), [2, 3, 1]);

});

test("buildPriorityAlerts: no CRITICAL -- ordena por antigüedad, severidad como desempate", () => {

    const oldestActive = [

        { id: 1, severity: "WARNING", activeMinutes: 100 },

        { id: 2, severity: "SIGNIFICANT", activeMinutes: 100 },

        { id: 3, severity: "WARNING", activeMinutes: 500 }

    ];

    const result =
        OperationalReport.buildPriorityAlerts(oldestActive);

    // id 3 primero (más antigua). Entre id 1/id 2 (misma antigüedad),
    // SIGNIFICANT (id 2) desempata antes que WARNING (id 1).
    assert.deepStrictEqual(result.map(a => a.id), [3, 2, 1]);

});

test("buildPriorityAlerts: reproduce el ejemplo literal de la sección 8", () => {

    const oldestActive = [

        { id: 1, batchNumber: "KT-20260827-001", severity: "SIGNIFICANT", activeMinutes: 660 }, // 11h

        { id: 2, batchNumber: "TP-20260828-003", severity: "CRITICAL", activeMinutes: 360 } // 6h

    ];

    const result =
        OperationalReport.buildPriorityAlerts(oldestActive);

    assert.strictEqual(result[0].batchNumber, "TP-20260828-003");
    assert.strictEqual(result[1].batchNumber, "KT-20260827-001");

});

test("buildPriorityAlerts: lista vacía -> arreglo vacío", () => {

    assert.deepStrictEqual(OperationalReport.buildPriorityAlerts([]), []);
    assert.deepStrictEqual(OperationalReport.buildPriorityAlerts(null), []);

});

test("buildPriorityAlerts: respeta el límite MAX_PRIORITY_ALERTS", () => {

    const many =
        Array.from({ length: 15 }, (_, i) => ({ id: i, severity: "WARNING", activeMinutes: i }));

    const result =
        OperationalReport.buildPriorityAlerts(many);

    assert.strictEqual(result.length, OperationalReport.MAX_PRIORITY_ALERTS);

});

// --- buildPredictionPerformanceSummary (sección 3) ---

test("buildPredictionPerformanceSummary: bestModel/worstModel a partir de comparison.lowerMae ya calculado", () => {

    const predictionPerformance = {

        batchesConsidered: 42,

        excluded: { pending: 2, noPrediction: 1, unavailable: 3 },

        models: [

            { modelType: "LINEAR", sampleSize: 20, maeHours: 1.5 },

            { modelType: "EXPONENTIAL", sampleSize: 22, maeHours: 2.1 }

        ],

        comparison: { lowerMae: "LINEAR", lowerRmse: "LINEAR" }

    };

    const summary =
        OperationalReport.buildPredictionPerformanceSummary(predictionPerformance);

    assert.strictEqual(summary.bestModel, "LINEAR");
    assert.strictEqual(summary.worstModel, "EXPONENTIAL");
    assert.strictEqual(summary.predictionsVerified, 42);

    // predictionsMade = batchesConsidered + excluded.unavailable = 42 + 3 = 45
    assert.strictEqual(summary.predictionsMade, 45);
    assert.strictEqual(summary.hasSufficientData, true);

});

test("buildPredictionPerformanceSummary: sin comparación posible (empate/null) -> bestModel/worstModel null", () => {

    const predictionPerformance = {

        batchesConsidered: 0,

        excluded: { pending: 0, noPrediction: 0, unavailable: 0 },

        models: [

            { modelType: "LINEAR", sampleSize: 0, maeHours: null },

            { modelType: "EXPONENTIAL", sampleSize: 0, maeHours: null }

        ],

        comparison: { lowerMae: null, lowerRmse: null }

    };

    const summary =
        OperationalReport.buildPredictionPerformanceSummary(predictionPerformance);

    assert.strictEqual(summary.bestModel, null);
    assert.strictEqual(summary.worstModel, null);
    assert.strictEqual(summary.hasSufficientData, false);

});

test("buildPredictionPerformanceSummary: null de entrada -> null", () => {

    assert.strictEqual(OperationalReport.buildPredictionPerformanceSummary(null), null);

});

// --- buildAlertPeriodTotals (sección 5) ---

test("buildAlertPeriodTotals: suma created/resolved ya calculados por el timeline, sin clasificar tendencia", () => {

    const alertTrends = {

        timeline: [

            { periodStart: "2026-08-03", created: 10, resolved: 8 },

            { periodStart: "2026-08-10", created: 8, resolved: 10 },

            { periodStart: "2026-08-17", created: 10, resolved: 13 }

        ]

    };

    const totals =
        OperationalReport.buildAlertPeriodTotals(alertTrends);

    assert.strictEqual(totals.createdInPeriod, 28);
    assert.strictEqual(totals.resolvedInPeriod, 31);

    // Nunca agrega una clave de clasificación de tendencia.
    assert.strictEqual(totals.trend, undefined);

});

test("buildAlertPeriodTotals: sin timeline -> ceros", () => {

    assert.deepStrictEqual(OperationalReport.buildAlertPeriodTotals(null), { createdInPeriod: 0, resolvedInPeriod: 0 });
    assert.deepStrictEqual(OperationalReport.buildAlertPeriodTotals({ timeline: [] }), { createdInPeriod: 0, resolvedInPeriod: 0 });

});

// --- buildExecutiveSummary (sección 7) ---

test("buildExecutiveSummary: reproduce el ejemplo literal de la sección 7", () => {

    const predictionPerformance = {

        models: [

            { modelType: "LINEAR", sampleSize: 42, exactPercentage: 84 },

            { modelType: "EXPONENTIAL", sampleSize: 40, exactPercentage: 70 }

        ]

    };

    const predictionPerformanceSummary = {

        predictionsVerified: 42,

        bestModel: "LINEAR",

        worstModel: "EXPONENTIAL"

    };

    const calibration = {

        alertsSummary: { open: 1, acknowledged: 0, resolved: 5 }

    };

    const alertTrends = {

        summary: { total: 10, active: 3, resolved: 7, critical: 0 }

    };

    const actionAnalytics = {

        summary: { evaluated: 18 }

    };

    const summary =
        OperationalReport.buildExecutiveSummary({ predictionPerformance, predictionPerformanceSummary, calibration, alertTrends, actionAnalytics });

    assert.strictEqual(summary.predictionsVerified, 42);
    assert.strictEqual(summary.accuracyObservedPercentage, 84);
    assert.strictEqual(summary.accuracyObservedModel, "LINEAR");
    assert.strictEqual(summary.activeAlerts, 3);
    assert.strictEqual(summary.criticalAlerts, 0);
    assert.strictEqual(summary.actionsEvaluated, 18);
    assert.strictEqual(summary.calibrationAlertsOpen, 1);

});

test("buildExecutiveSummary: bloques ausentes (null) -> ceros/null, nunca lanza", () => {

    const summary =
        OperationalReport.buildExecutiveSummary({

            predictionPerformance: null,

            predictionPerformanceSummary: null,

            calibration: null,

            alertTrends: null,

            actionAnalytics: null

        });

    assert.strictEqual(summary.predictionsVerified, 0);
    assert.strictEqual(summary.accuracyObservedPercentage, null);
    assert.strictEqual(summary.accuracyObservedModel, null);
    assert.strictEqual(summary.activeAlerts, 0);
    assert.strictEqual(summary.criticalAlerts, 0);
    assert.strictEqual(summary.actionsEvaluated, 0);
    assert.strictEqual(summary.calibrationAlertsOpen, 0);

});

// --- dateSources / methodology (secciones 14/16) ---

test("buildDateSources: documenta los cuatro bloques", () => {

    const sources =
        OperationalReport.buildDateSources();

    const blocks =
        new Set(sources.map(s => s.block));

    assert.ok(blocks.has("predictionPerformance"));
    assert.ok(blocks.has("calibration"));
    assert.ok(blocks.has("alerts"));
    assert.ok(blocks.has("actions"));

});

test("buildMethodologyNotes: incluye advertencia explícita de no-causalidad de acciones", () => {

    const notes =
        OperationalReport.buildMethodologyNotes();

    assert.ok(notes.some(n => n.toLowerCase().includes("causalidad")));
    assert.ok(notes.some(n => n.toLowerCase().includes("muestra pequeña")));

});

// --- buildOperationalReportDTO (sección 11 -- integración) ---

test("buildOperationalReportDTO: forma completa con los cuatro bloques presentes", () => {

    const dto =
        OperationalReport.buildOperationalReportDTO({

            period: { from: "2026-08-01", to: "2026-08-31" },

            predictionPerformance: {

                batchesConsidered: 42,

                excluded: { pending: 0, noPrediction: 0, unavailable: 0 },

                models: [{ modelType: "LINEAR", sampleSize: 42, maeHours: 1.2, exactPercentage: 84 }],

                comparison: { lowerMae: null, lowerRmse: null }

            },

            calibration: { calibrations: [], alertsSummary: { open: 0, acknowledged: 0, resolved: 0 }, pendingProposalsCount: 0 },

            alertTrends: {

                summary: { total: 86, active: 7, resolved: 79, critical: 12, resolutionRate: 91.9 },

                duration: { sampleSize: 79, averageMinutes: 222, medianMinutes: 165, minMinutes: 12, maxMinutes: 1710, smallSample: false },

                timeline: [{ periodStart: "2026-08-03", created: 28, resolved: 31 }],

                oldestActive: [{ id: 1, batchId: 5, batchNumber: "TP-1", severity: "CRITICAL", activeMinutes: 360 }]

            },

            actionAnalytics: { summary: { total: 42, evaluated: 35, pending: 7, improved: 14, unchanged: 10, worsened: 3, resolved: 8 } }

        });

    assert.deepStrictEqual(dto.period, { from: "2026-08-01", to: "2026-08-31" });
    assert.ok(dto.executiveSummary);
    assert.ok(dto.predictionPerformance);
    assert.strictEqual(dto.predictionPerformance.bestModel, null);
    assert.ok(dto.calibration);
    assert.ok(dto.alerts);
    assert.strictEqual(dto.alerts.createdInPeriod, 28);
    assert.strictEqual(dto.alerts.resolvedInPeriod, 31);
    assert.ok(dto.actions);
    assert.strictEqual(dto.priorityAlerts.length, 1);
    assert.strictEqual(dto.priorityAlerts[0].severity, "CRITICAL");
    assert.ok(Array.isArray(dto.dateSources));
    assert.ok(Array.isArray(dto.methodology));

});

test("buildOperationalReportDTO: sección 14 -- bloques ausentes (null) no rompen el DTO completo", () => {

    const dto =
        OperationalReport.buildOperationalReportDTO({

            period: { from: "2026-08-01", to: "2026-08-31" },

            predictionPerformance: null,

            calibration: null,

            alertTrends: null,

            actionAnalytics: null

        });

    assert.strictEqual(dto.predictionPerformance, null);
    assert.strictEqual(dto.calibration, null);
    assert.strictEqual(dto.alerts, null);
    assert.strictEqual(dto.actions, null);
    assert.deepStrictEqual(dto.priorityAlerts, []);
    assert.ok(dto.executiveSummary);
    assert.strictEqual(dto.executiveSummary.predictionsVerified, 0);

});

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {

    process.exit(1);

}
