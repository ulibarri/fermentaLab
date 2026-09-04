const assert =
    require("assert");

const HydrometerBiasAnalysis =
    require("../utils/HydrometerBiasAnalysis");

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

console.log("HydrometerBiasAnalysis tests (Entrega 2.8.0.5)\n");

function entry({ id = 1, date = "2026-09-01T10:00:00.000Z", phase = "F1", error, brixReal = 7.0, tableId = 1, tableVersion = 1, tableName = "Brewer's Elite" }) {

    return { measurementId: id, date, phase, error, brixReal, tableId, tableVersion, tableName };

}

// --- Sección 3, ejemplo literal del spec: Bias = +0.05 ---

test("Ejemplo literal del spec: 4 comparaciones -> Bias +0.05", () => {

    const entries = [

        entry({ id: 1, error: 0.20 }),
        entry({ id: 2, error: 0.20 }),
        entry({ id: 3, error: -0.20 }),
        entry({ id: 4, error: 0.00 })

    ];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.bias, 0.05);
    assert.strictEqual(summary.sampleCount, 4);

});

// --- Bias positivo / negativo / cero ---

test("Bias positivo: todos los errores positivos", () => {

    const entries = [entry({ error: 0.10 }), entry({ error: 0.20 }), entry({ error: 0.30 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.ok(summary.bias > 0);
    assert.strictEqual(summary.bias, 0.20);

});

test("Bias negativo: todos los errores negativos", () => {

    const entries = [entry({ error: -0.10 }), entry({ error: -0.30 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.ok(summary.bias < 0);
    assert.strictEqual(summary.bias, -0.20);

});

test("Bias = 0: errores simétricos", () => {

    const entries = [entry({ error: 0.10 }), entry({ error: -0.10 }), entry({ error: 0.00 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.bias, 0);

});

// --- Mediana (sección 4.3) ---

test("Mediana: evita que un valor extremo domine la interpretación", () => {

    // Promedio = (0.1+0.1+0.1+2.0)/4 = 0.575, pero la mediana es 0.1 --
    // muestra que el "centro" real del conjunto es mucho más bajo que
    // el promedio, arrastrado por un solo extremo.
    const entries = [entry({ error: 0.10 }), entry({ error: 0.10 }), entry({ error: 0.10 }), entry({ error: 2.00 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.medianError, 0.10);
    assert.ok(summary.bias > summary.medianError, "el promedio queda arrastrado por el extremo, la mediana no");

});

test("Mediana: número par de elementos promedia los dos centrales", () => {

    assert.strictEqual(HydrometerBiasAnalysis.median([0.10, 0.20, 0.30, 0.40]), 0.25);

});

// --- MAE (sección 4.4) ---

test("MAE: promedio de errores absolutos, nunca se cancela el signo", () => {

    const entries = [entry({ error: 0.20 }), entry({ error: -0.20 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.bias, 0, "el bias sí se cancela (signos opuestos)");
    assert.strictEqual(summary.mae, 0.20, "el MAE NUNCA se cancela -- ambos aportan 0.20 de magnitud");

});

// --- Desviación estándar (sección 4.7) ---

test("Desviación estándar: 0 cuando todos los errores son idénticos", () => {

    const entries = [entry({ error: 0.15 }), entry({ error: 0.15 }), entry({ error: 0.15 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.standardDeviation, 0);

});

test("Desviación estándar: mayor cuando hay más dispersión con el mismo promedio (sección 5, Caso A vs. B)", () => {

    const casoA = [entry({ error: 0.20 }), entry({ error: 0.18 }), entry({ error: 0.22 }), entry({ error: 0.19 })]; // consistente

    const casoB = [entry({ error: 1.00 }), entry({ error: -0.80 }), entry({ error: 0.70 }), entry({ error: -0.10 })]; // disperso

    const summaryA = HydrometerBiasAnalysis.buildSummary(casoA);
    const summaryB = HydrometerBiasAnalysis.buildSummary(casoB);

    assert.ok(summaryA.standardDeviation < summaryB.standardDeviation, "Caso A (consistente) tiene menor desviación estándar que Caso B (disperso)");

});

// --- Conteo de positivos/negativos/coincidentes (sección 5) ---

test("Distribución de signos: cuenta positivos/cero/negativos correctamente", () => {

    const entries = [

        entry({ error: 0.20 }), entry({ error: 0.15 }), entry({ error: 0.30 }),
        entry({ error: 0.10 }), entry({ error: 0.25 }), entry({ error: 0.05 }),
        entry({ error: 0.00 }),
        entry({ error: -0.10 })

    ];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.sampleCount, 8);
    assert.strictEqual(summary.positiveErrors, 6);
    assert.strictEqual(summary.zeroErrors, 1);
    assert.strictEqual(summary.negativeErrors, 1);

});

test("computeDistribution() -- función pura aislada", () => {

    const dist = HydrometerBiasAnalysis.computeDistribution([0.1, -0.1, 0, 0.2, -0.2, 0]);

    assert.deepStrictEqual(dist, { positiveErrors: 2, zeroErrors: 2, negativeErrors: 2 });

});

// --- Agrupación por rango de Brix (sección 6) ---

test("groupByRange(): agrupa por el Brix REAL (BrixMate), no por el derivado", () => {

    const entries = [

        entry({ error: 0.05, brixReal: 2.0 }),   // 0-4
        entry({ error: 0.05, brixReal: 3.5 }),   // 0-4
        entry({ error: 0.12, brixReal: 5.0 }),   // 4-6
        entry({ error: 0.25, brixReal: 7.0 }),   // 6-8
        entry({ error: 0.25, brixReal: 7.9 }),   // 6-8
        entry({ error: 0.31, brixReal: 9.0 })    // 8-10

    ];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    const range04 = summary.ranges.find(r => r.range === "0-4");
    const range46 = summary.ranges.find(r => r.range === "4-6");
    const range68 = summary.ranges.find(r => r.range === "6-8");
    const range810 = summary.ranges.find(r => r.range === "8-10");
    const range10plus = summary.ranges.find(r => r.range === "10+");

    assert.strictEqual(range04.count, 2);
    assert.strictEqual(range04.bias, 0.05);
    assert.strictEqual(range46.count, 1);
    assert.strictEqual(range68.count, 2);
    assert.strictEqual(range810.count, 1);
    assert.strictEqual(range10plus.count, 0, "un rango sin datos sigue apareciendo en la salida, con count 0");
    assert.strictEqual(range10plus.bias, null, "un rango sin datos nunca reporta un bias fabricado");

});

test("groupByRange(): límites -- el valor exactamente igual al mínimo cae en ESE rango, no en el anterior", () => {

    const entries = [entry({ error: 0.10, brixReal: 4.0 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.ranges.find(r => r.range === "4-6").count, 1);
    assert.strictEqual(summary.ranges.find(r => r.range === "0-4").count, 0);

});

test("groupByRange(): rangos personalizados sobreescriben el default (sección 6, configurable)", () => {

    const customRanges = [{ label: "bajo", min: 0, max: 5 }, { label: "alto", min: 5, max: Infinity }];

    const entries = [entry({ error: 0.1, brixReal: 3 }), entry({ error: 0.2, brixReal: 8 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries, { ranges: customRanges });

    assert.strictEqual(summary.ranges.length, 2);
    assert.strictEqual(summary.ranges[0].range, "bajo");
    assert.strictEqual(summary.ranges[0].count, 1);
    assert.strictEqual(summary.ranges[1].count, 1);

});

// --- Agrupación por fase (sección 7) ---

test("groupByPhase(): agrupa F1 y Producto Final por separado, nunca mezclados", () => {

    const entries = [

        entry({ error: 0.10, phase: "F1" }),
        entry({ error: 0.20, phase: "F1" }),
        entry({ error: 0.30, phase: "FINAL" })

    ];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    const f1 = summary.byPhase.find(p => p.phase === "F1");
    const final = summary.byPhase.find(p => p.phase === "FINAL");

    assert.strictEqual(f1.count, 2);
    assert.strictEqual(f1.bias, 0.15);
    assert.strictEqual(final.count, 1);
    assert.strictEqual(final.bias, 0.30);
    assert.strictEqual(summary.byPhase.find(p => p.phase === "F2"), undefined, "F2 nunca aparece -- ya se excluyó río arriba en HydrometerAudit.evaluateComparability()");

});

// --- Agrupación por tabla/versión (sección 9) ---

test("groupByTable(): agrupa por tabla+versión, distingue v1 de v2 aunque compartan nombre", () => {

    const entries = [

        entry({ error: 0.20, tableId: 1, tableVersion: 1, tableName: "Fabricante X" }),
        entry({ error: 0.22, tableId: 1, tableVersion: 1, tableName: "Fabricante X" }),
        entry({ error: 0.08, tableId: 2, tableVersion: 2, tableName: "Fabricante X" })

    ];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.byTable.length, 2);

    const v1 = summary.byTable.find(t => t.tableId === 1);
    const v2 = summary.byTable.find(t => t.tableId === 2);

    assert.strictEqual(v1.tableVersion, 1);
    assert.strictEqual(v1.count, 2);
    assert.strictEqual(v2.tableVersion, 2);
    assert.strictEqual(v2.count, 1);
    assert.ok(v2.bias < v1.bias, "sección 9: permite ver que la v2 se acerca más al BrixMate real que la v1");

});

// --- Muestra insuficiente (sección 12) ---

test("Muestra insuficiente: n menor al mínimo -> status INSUFFICIENT (⚪), sin importar el bias", () => {

    const entries = [entry({ error: 0.50 }), entry({ error: 0.55 })]; // n=2, bias grande y consistente

    const summary = HydrometerBiasAnalysis.buildSummary(entries, { minimumSampleSize: 5 });

    assert.strictEqual(summary.status, HydrometerBiasAnalysis.BIAS_STATUS.INSUFFICIENT);

});

test("minimumSampleSize es configurable -- un umbral más bajo permite clasificar la misma muestra", () => {

    const entries = [entry({ error: 0.50 }), entry({ error: 0.55 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries, { minimumSampleSize: 2 });

    assert.notStrictEqual(summary.status, HydrometerBiasAnalysis.BIAS_STATUS.INSUFFICIENT);

});

// --- Clasificación 🟢/🟡/🔴 -- Caso A (consistente) vs. Caso B (disperso), sección 5/13 ---

test("Caso A: errores consistentes en la misma dirección -> CONSISTENT_BIAS (🔴)", () => {

    const entries = [

        entry({ error: 0.20 }), entry({ error: 0.18 }), entry({ error: 0.22 }),
        entry({ error: 0.19 }), entry({ error: 0.21 }), entry({ error: 0.20 })

    ];

    const summary = HydrometerBiasAnalysis.buildSummary(entries, { minimumSampleSize: 5 });

    assert.strictEqual(summary.status, HydrometerBiasAnalysis.BIAS_STATUS.CONSISTENT_BIAS);

});

test("Caso B: mismo bias promedio aproximado, pero disperso en ambas direcciones -> nunca CONSISTENT_BIAS", () => {

    const entries = [

        entry({ error: 1.00 }), entry({ error: -0.80 }), entry({ error: 0.70 }),
        entry({ error: -0.10 }), entry({ error: 0.30 }), entry({ error: -0.05 })

    ];

    const summary = HydrometerBiasAnalysis.buildSummary(entries, { minimumSampleSize: 5 });

    assert.notStrictEqual(summary.status, HydrometerBiasAnalysis.BIAS_STATUS.CONSISTENT_BIAS, "sección 5: un promedio parecido con mucha variabilidad NUNCA debe leerse como sesgo consistente");

});

test("Bias despreciable -> NO_EVIDENT_BIAS (🟢) incluso con muestra suficiente", () => {

    const entries = [entry({ error: 0.01 }), entry({ error: -0.02 }), entry({ error: 0.01 }), entry({ error: 0.00 }), entry({ error: 0.02 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries, { minimumSampleSize: 5 });

    assert.strictEqual(summary.status, HydrometerBiasAnalysis.BIAS_STATUS.NO_EVIDENT_BIAS);

});

test("Tendencia moderada -> POSSIBLE_BIAS (🟡), ni insuficiente ni consistente", () => {

    // 6 de 10 en la misma dirección (60%) -- por debajo del umbral alto
    // (70%), por encima del moderado (55%). Bias = (6*0.20 - 4*0.10)/10
    // = 0.08, por encima del umbral de sesgo despreciable (0.05).
    const entries = [

        entry({ error: 0.20 }), entry({ error: 0.20 }), entry({ error: 0.20 }),
        entry({ error: 0.20 }), entry({ error: 0.20 }), entry({ error: 0.20 }),
        entry({ error: -0.10 }), entry({ error: -0.10 }), entry({ error: -0.10 }), entry({ error: -0.10 })

    ];

    const summary = HydrometerBiasAnalysis.buildSummary(entries, { minimumSampleSize: 5 });

    assert.strictEqual(summary.status, HydrometerBiasAnalysis.BIAS_STATUS.POSSIBLE_BIAS);

});

// --- classifyBiasStatus() aislada -- umbrales personalizados ---

test("classifyBiasStatus(): los umbrales de sesgo/consistencia son sobreescribibles sin tocar los defaults", () => {

    const status = HydrometerBiasAnalysis.classifyBiasStatus({

        sampleCount: 10,
        bias: 0.5,
        positiveErrors: 6,
        negativeErrors: 4,
        minimumSampleSize: 5,
        negligibleBiasAbs: 1.0 // umbral alto a propósito -> 0.5 queda por debajo

    });

    assert.strictEqual(status, HydrometerBiasAnalysis.BIAS_STATUS.NO_EVIDENT_BIAS);

    // El default global no se ve afectado por pasar un threshold custom en la llamada anterior.
    const defaultStatus = HydrometerBiasAnalysis.classifyBiasStatus({

        sampleCount: 10, bias: 0.5, positiveErrors: 8, negativeErrors: 2, minimumSampleSize: 5

    });

    assert.notStrictEqual(defaultStatus, HydrometerBiasAnalysis.BIAS_STATUS.NO_EVIDENT_BIAS);

});

// --- Evolución temporal (sección 8) ---

test("buildTimeline(): ordena cronológicamente sin importar el orden de entrada", () => {

    const entries = [

        entry({ id: 3, date: "2026-09-03T10:00:00.000Z", error: 0.10 }),
        entry({ id: 1, date: "2026-09-01T10:00:00.000Z", error: 0.05 }),
        entry({ id: 2, date: "2026-09-02T10:00:00.000Z", error: 0.08 })

    ];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.deepStrictEqual(summary.timeline.map(t => t.measurementId), [1, 2, 3]);

});

test("buildTimeline(): conserva tableId/tableVersion por punto, para poder marcar cambios de versión", () => {

    const entries = [entry({ id: 1, date: "2026-09-01T10:00:00.000Z", error: 0.1, tableId: 1, tableVersion: 1 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.timeline[0].tableId, 1);
    assert.strictEqual(summary.timeline[0].tableVersion, 1);

});

// --- Error máximo positivo/negativo (secciones 4.5/4.6) ---

test("maxPositiveError / maxNegativeError: identifican la mayor sobre y subestimación por separado", () => {

    const entries = [entry({ error: 0.10 }), entry({ error: 0.40 }), entry({ error: -0.30 }), entry({ error: -0.05 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.maxPositiveError, 0.40);
    assert.strictEqual(summary.maxNegativeError, -0.30);

});

test("maxPositiveError / maxNegativeError: null cuando no existe ninguna comparación en esa dirección", () => {

    const entries = [entry({ error: 0.10 }), entry({ error: 0.20 })];

    const summary = HydrometerBiasAnalysis.buildSummary(entries);

    assert.strictEqual(summary.maxNegativeError, null, "nunca se fabrica un 'máximo negativo' cuando no hubo subestimaciones");

});

// --- Conjunto vacío -- nunca lanza ---

test("Conjunto vacío: nunca lanza, todo queda en null/0/INSUFFICIENT", () => {

    const summary = HydrometerBiasAnalysis.buildSummary([]);

    assert.strictEqual(summary.sampleCount, 0);
    assert.strictEqual(summary.bias, null);
    assert.strictEqual(summary.medianError, null);
    assert.strictEqual(summary.standardDeviation, null);
    assert.strictEqual(summary.status, HydrometerBiasAnalysis.BIAS_STATUS.INSUFFICIENT);
    assert.strictEqual(summary.ranges.length, 5, "los 5 rangos por defecto siguen apareciendo, todos en 0");
    assert.strictEqual(summary.byPhase.length, 0);
    assert.strictEqual(summary.byTable.length, 0);
    assert.strictEqual(summary.timeline.length, 0);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
