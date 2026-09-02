const assert =
    require("assert");

const { validateTable, toFiniteNumber, MIN_ROWS_FOR_INTERPOLATION } =
    require("../utils/HydrometerTableValidation");

const HydrometerConverter =
    require("../utils/HydrometerConverter");

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

console.log("HydrometerTableValidation tests\n");

// --- toFiniteNumber ---

test("toFiniteNumber acepta number finito", () => {

    assert.strictEqual(toFiniteNumber(1.03), 1.03);

});

test("toFiniteNumber acepta string numérico", () => {

    assert.strictEqual(toFiniteNumber("1.030"), 1.03);

});

test("toFiniteNumber rechaza string no numérico", () => {

    assert.strictEqual(toFiniteNumber("abc"), null);

});

test("toFiniteNumber rechaza null/undefined/vacío", () => {

    assert.strictEqual(toFiniteNumber(null), null);
    assert.strictEqual(toFiniteNumber(undefined), null);
    assert.strictEqual(toFiniteNumber(""), null);
    assert.strictEqual(toFiniteNumber("   "), null);

});

test("toFiniteNumber rechaza NaN/Infinity", () => {

    assert.strictEqual(toFiniteNumber(NaN), null);
    assert.strictEqual(toFiniteNumber(Infinity), null);

});

// --- validateTable: tabla vacía ---

test("validateTable([]) es inválida", () => {

    const result = validateTable([]);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);

});

test("validateTable(null) es inválida, no lanza", () => {

    const result = validateTable(null);

    assert.strictEqual(result.valid, false);

});

// --- validateTable: la tabla real del catálogo (Brewer's Elite) es válida ---

test("La tabla legada completa (Brewer's Elite) es válida", () => {

    const rows =
        HydrometerConverter.LEGACY_POINTS.map((p, i) => ({

            rowNumber: i + 1,

            sg: p.sg,

            brix: p.brix,

            alcohol: p.alcohol

        }));

    const result = validateTable(rows);

    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.valid, true);

});

// --- Sección 17: valores no numéricos, mensaje específico por fila/columna ---

test("Valor SG no numérico reporta la fila exacta", () => {

    const rows = [

        { rowNumber: 1, sg: 1.000, brix: 0.0, alcohol: 0.0 },

        { rowNumber: 2, sg: "abc", brix: 1.3, alcohol: 0.7 },

        { rowNumber: 3, sg: 1.010, brix: 2.5, alcohol: 1.3 }

    ];

    const result = validateTable(rows);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.includes("SG no es numérico en la fila 2."));

});

test("Valor Alcohol no numérico reporta la fila exacta (ejemplo literal de la sección 17)", () => {

    const rows = [

        { rowNumber: 1, sg: 1.000, brix: 0.0, alcohol: 0.0 },

        { rowNumber: 2, sg: 1.005, brix: 1.3, alcohol: 0.7 },

        { rowNumber: 3, sg: 1.010, brix: 2.5, alcohol: 1.3 },

        { rowNumber: 4, sg: 1.015, brix: 3.8, alcohol: 2.0 },

        { rowNumber: 5, sg: 1.020, brix: 5.1, alcohol: 2.6 },

        { rowNumber: 6, sg: 1.025, brix: 6.3, alcohol: 3.3 },

        { rowNumber: 7, sg: 1.030, brix: 7.5, alcohol: 3.9 },

        { rowNumber: 8, sg: 1.035, brix: 8.7, alcohol: "abc" }

    ];

    const result = validateTable(rows);

    assert.ok(result.errors.includes("Alcohol no es numérico en la fila 8."));

});

// --- Sección 7: SG duplicado ---

test("SG duplicado se reporta con el valor exacto (ejemplo literal de la sección 17)", () => {

    const rows = [

        { rowNumber: 1, sg: 1.000, brix: 0.0, alcohol: 0.0 },

        { rowNumber: 2, sg: 1.005, brix: 1.3, alcohol: 0.7 },

        { rowNumber: 3, sg: 1.030, brix: 7.5, alcohol: 3.9 },

        { rowNumber: 4, sg: 1.030, brix: 7.5, alcohol: 3.9 }

    ];

    const result = validateTable(rows);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.includes("SG 1.03 aparece dos veces."));

});

// --- Sección 7: fuera de orden ---

test("Filas fuera de orden ascendente se reportan", () => {

    const rows = [

        { rowNumber: 1, sg: 1.010, brix: 2.5, alcohol: 1.3 },

        { rowNumber: 2, sg: 1.005, brix: 1.3, alcohol: 0.7 },

        { rowNumber: 3, sg: 1.015, brix: 3.8, alcohol: 2.0 }

    ];

    const result = validateTable(rows);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => /fuera de orden/.test(e)));

});

// --- Sección 7: huecos con incremento fijo ---

test("Un hueco en un incremento fijo (0.005) se reporta con la fila exacta faltante", () => {

    const rows = [

        { rowNumber: 1, sg: 1.000, brix: 0.0, alcohol: 0.0 },

        { rowNumber: 2, sg: 1.005, brix: 1.3, alcohol: 0.7 },

        { rowNumber: 3, sg: 1.010, brix: 2.5, alcohol: 1.3 },

        // falta 1.015
        { rowNumber: 4, sg: 1.020, brix: 5.1, alcohol: 2.6 },

        { rowNumber: 5, sg: 1.025, brix: 6.3, alcohol: 3.3 }

    ];

    const result = validateTable(rows);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.includes("Falta la fila SG 1.015."));

});

test("Sin incremento fijo dominante (menos de 3 filas), no reporta huecos falsos", () => {

    const rows = [

        { rowNumber: 1, sg: 1.000, brix: 0.0, alcohol: 0.0 },

        { rowNumber: 2, sg: 1.100, brix: 23.7, alcohol: 13.0 }

    ];

    const result = validateTable(rows);

    // Solo 2 filas -- válida en cuanto a orden/duplicados/huecos, aunque
    // MIN_ROWS_FOR_INTERPOLATION siga cumpliéndose (2).
    assert.strictEqual(result.valid, true);

});

// --- Sección 8: consistencia de interpolación en las 3 direcciones ---

test("Brix no monótono respecto a SG se reporta (no interpolable por Brix)", () => {

    const rows = [

        { rowNumber: 1, sg: 1.000, brix: 5.0, alcohol: 0.0 },

        { rowNumber: 2, sg: 1.005, brix: 4.0, alcohol: 0.7 }, // Brix baja mientras SG sube

        { rowNumber: 3, sg: 1.010, brix: 6.0, alcohol: 1.3 }

    ];

    const result = validateTable(rows);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => /no es válida para interpolar por Brix/.test(e)));

});

test("Menos de MIN_ROWS_FOR_INTERPOLATION filas numéricas es inválida", () => {

    const rows = [

        { rowNumber: 1, sg: 1.000, brix: 0.0, alcohol: 0.0 }

    ];

    const result = validateTable(rows);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes(String(MIN_ROWS_FOR_INTERPOLATION))));

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
