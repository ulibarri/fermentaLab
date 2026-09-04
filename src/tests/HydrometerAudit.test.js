const assert =
    require("assert");

const HydrometerAudit =
    require("../utils/HydrometerAudit");

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

console.log("HydrometerAudit tests (Entrega 2.8.0.4)\n");

// --- Sección 15, Caso 1: Derivado=7.20, Real=7.00, Δ=+0.20 ---

test("Caso 1: Derivado 7.20 / Real 7.00 -> Δ +0.20", () => {

    const result =
        HydrometerAudit.computeComparison(7.20, 7.00);

    assert.strictEqual(result.deltaBrix, 0.20);
    assert.strictEqual(result.absoluteError, 0.20);
    assert.strictEqual(result.relativeError, Math.round((0.20 / 7.00) * 100 * 100) / 100);

});

// --- Sección 15, Caso 2: Derivado=6.80, Real=7.00, Δ=-0.20 ---

test("Caso 2: Derivado 6.80 / Real 7.00 -> Δ -0.20 (conserva el signo)", () => {

    const result =
        HydrometerAudit.computeComparison(6.80, 7.00);

    assert.strictEqual(result.deltaBrix, -0.20);
    assert.strictEqual(result.absoluteError, 0.20);

});

// --- Sección 15, Caso 3: Derivado = Real, Δ = 0 ---

test("Caso 3: Derivado igual a Real -> Δ 0, error 0", () => {

    const result =
        HydrometerAudit.computeComparison(7.00, 7.00);

    assert.strictEqual(result.deltaBrix, 0);
    assert.strictEqual(result.absoluteError, 0);
    assert.strictEqual(result.relativeError, 0);

});

// --- Sección 4: el signo distingue sobreestimación de subestimación ---

test("Sección 4: deltaBrix positivo = el hidrómetro sobreestima", () => {

    const result =
        HydrometerAudit.computeComparison(7.85, 7.70);

    assert.ok(result.deltaBrix > 0);

});

test("Sección 4: deltaBrix negativo = el hidrómetro subestima", () => {

    const result =
        HydrometerAudit.computeComparison(6.90, 7.10);

    assert.ok(result.deltaBrix < 0);

});

// --- Sección 15, Caso 4: sin BrixMate -> No comparable ---

test("Caso 4: medición sin BrixMate -> no comparable (NO_BRIX_MATE)", () => {

    const measurement = {

        phase: "F1",

        brix: 7.20,

        hydrometerConversionMethod: "INTERPOLATED",

        brixLafmate: null

    };

    const result =
        HydrometerAudit.evaluateComparability(measurement);

    assert.strictEqual(result.comparable, false);
    assert.strictEqual(result.reason, HydrometerAudit.NOT_COMPARABLE_REASONS.NO_BRIX_MATE);

});

test("Sin Brix derivado (nunca se convirtió) -> no comparable (NO_DERIVED_BRIX)", () => {

    const measurement = {

        phase: "F1",

        brix: 7.20,

        hydrometerConversionMethod: null,

        brixLafmate: 7.10

    };

    const result =
        HydrometerAudit.evaluateComparability(measurement);

    assert.strictEqual(result.comparable, false);
    assert.strictEqual(result.reason, HydrometerAudit.NOT_COMPARABLE_REASONS.NO_DERIVED_BRIX);

});

test("Brix manual (MANUAL, no vino de tabla) -> no comparable (NO_DERIVED_BRIX)", () => {

    // Sección 3/12 -- un valor tecleado a mano no tiene tabla/versión
    // que trazabilizar, y comparar contra BrixMate no dice nada sobre
    // qué tan bien reproduce la TABLA el valor real.
    const measurement = {

        phase: "F1",

        brix: 7.20,

        hydrometerConversionMethod: "MANUAL",

        brixLafmate: 7.10

    };

    const result =
        HydrometerAudit.evaluateComparability(measurement);

    assert.strictEqual(result.comparable, false);
    assert.strictEqual(result.reason, HydrometerAudit.NOT_COMPARABLE_REASONS.NO_DERIVED_BRIX);

});

test("Fase F2 -> nunca comparable (INCOMPATIBLE_PHASE), sin importar los demás campos", () => {

    const measurement = {

        phase: "F2",

        brix: 7.20,

        hydrometerConversionMethod: "TABLE_EXACT",

        brixLafmate: 7.10

    };

    const result =
        HydrometerAudit.evaluateComparability(measurement);

    assert.strictEqual(result.comparable, false);
    assert.strictEqual(result.reason, HydrometerAudit.NOT_COMPARABLE_REASONS.INCOMPATIBLE_PHASE);

});

test("F1 y FINAL con Brix derivado + BrixMate -> comparable", () => {

    const base = {

        brix: 7.20,

        hydrometerConversionMethod: "TABLE_EXACT",

        brixLafmate: 7.10

    };

    assert.strictEqual(HydrometerAudit.evaluateComparability({ ...base, phase: "F1" }).comparable, true);
    assert.strictEqual(HydrometerAudit.evaluateComparability({ ...base, phase: "FINAL" }).comparable, true);

});

// --- Sección 15, Caso 5: BrixMate = 0 -- absoluteError calculado, relativeError = null ---

test("Caso 5: BrixMate=0 -- SÍ es comparable, conserva deltaBrix/absoluteError", () => {

    const measurement = {

        phase: "F1",

        brix: 2.0,

        hydrometerConversionMethod: "INTERPOLATED",

        brixLafmate: 0

    };

    const comparability =
        HydrometerAudit.evaluateComparability(measurement);

    assert.strictEqual(comparability.comparable, true, "BrixMate=0 debe seguir siendo comparable");

    const comparison =
        HydrometerAudit.computeComparison(measurement.brix, measurement.brixLafmate);

    assert.strictEqual(comparison.deltaBrix, 2.0);
    assert.strictEqual(comparison.absoluteError, 2.0);
    assert.strictEqual(comparison.relativeError, null, "relativeError debe ser null -- división entre cero evitada");

});

// --- Sección 9/10: clasificación visual 🟢/🟡/🔴 ---

test("Sección 9/10: error 0.15 -> OK (🟢), ejemplo del spec", () => {

    assert.strictEqual(HydrometerAudit.classifyStatus(0.15), HydrometerAudit.STATUS.OK);

});

test("Sección 9/10: error 0.20 -> WARNING (🟡), ejemplo del spec", () => {

    assert.strictEqual(HydrometerAudit.classifyStatus(0.20), HydrometerAudit.STATUS.WARNING);

});

test("Sección 9/10: error 0.05 -> OK (🟢), ejemplo del spec", () => {

    assert.strictEqual(HydrometerAudit.classifyStatus(0.05), HydrometerAudit.STATUS.OK);

});

test("Sección 9: error muy alto -> HIGH (🔴)", () => {

    assert.strictEqual(HydrometerAudit.classifyStatus(1.5), HydrometerAudit.STATUS.HIGH);

});

test("Sección 9: los límites son parámetros -- se pueden sobreescribir sin tocar el default", () => {

    const custom = { acceptableAbsoluteError: 1.0, warningAbsoluteError: 2.0 };

    assert.strictEqual(HydrometerAudit.classifyStatus(0.50, custom), HydrometerAudit.STATUS.OK);
    assert.strictEqual(HydrometerAudit.classifyStatus(1.50, custom), HydrometerAudit.STATUS.WARNING);
    assert.strictEqual(HydrometerAudit.classifyStatus(2.50, custom), HydrometerAudit.STATUS.HIGH);

    // El default global nunca se modifica por pasar thresholds custom.
    assert.strictEqual(HydrometerAudit.classifyStatus(0.50), HydrometerAudit.STATUS.HIGH);

});

// --- Sección 8: resumen estadístico ---

test("Sección 8: buildSummary calcula promedio/máximo/mínimo/sesgo sobre comparaciones comparables", () => {

    const entries = [

        { comparison: HydrometerAudit.computeComparison(7.85, 7.70) }, // +0.15
        { comparison: HydrometerAudit.computeComparison(7.40, 7.20) }, // +0.20
        { comparison: HydrometerAudit.computeComparison(6.90, 6.85) }  // +0.05

    ];

    const summary =
        HydrometerAudit.buildSummary(entries);

    assert.strictEqual(summary.comparisons, 3);
    assert.strictEqual(summary.averageAbsoluteError, HydrometerAudit.round((0.15 + 0.20 + 0.05) / 3, 2));
    assert.strictEqual(summary.maxAbsoluteError, 0.20);
    assert.strictEqual(summary.minAbsoluteError, 0.05);
    assert.strictEqual(summary.averageBias, HydrometerAudit.round((0.15 + 0.20 + 0.05) / 3, 2));

});

test("buildSummary: sin comparaciones -> todos los valores null, comparisons 0", () => {

    const summary =
        HydrometerAudit.buildSummary([]);

    assert.strictEqual(summary.comparisons, 0);
    assert.strictEqual(summary.averageAbsoluteError, null);
    assert.strictEqual(summary.averageRelativeError, null);
    assert.strictEqual(summary.maxAbsoluteError, null);
    assert.strictEqual(summary.minAbsoluteError, null);
    assert.strictEqual(summary.averageBias, null);

});

test("buildSummary: una entrada con BrixMate=0 (relativeError null) se excluye SOLO del promedio relativo", () => {

    const entries = [

        { comparison: HydrometerAudit.computeComparison(7.20, 7.00) }, // relativeError numérico
        { comparison: HydrometerAudit.computeComparison(2.00, 0) }     // relativeError null

    ];

    const summary =
        HydrometerAudit.buildSummary(entries);

    assert.strictEqual(summary.comparisons, 2, "ambas SÍ cuentan para el total de comparaciones");
    assert.strictEqual(summary.averageRelativeError, entries[0].comparison.relativeError, "el promedio relativo solo considera la entrada con valor numérico");
    assert.notStrictEqual(summary.averageAbsoluteError, null, "el promedio absoluto sí incluye ambas entradas");

});

test("Sección 8: sesgo promedio conserva signo (permite ver sobre/subestimación sistemática)", () => {

    const entries = [

        { comparison: HydrometerAudit.computeComparison(6.80, 7.00) }, // -0.20
        { comparison: HydrometerAudit.computeComparison(6.70, 7.00) }  // -0.30

    ];

    const summary =
        HydrometerAudit.buildSummary(entries);

    assert.ok(summary.averageBias < 0, "sesgo negativo -- el hidrómetro subestima sistemáticamente en este ejemplo");

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
