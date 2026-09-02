const assert =
    require("assert");

const { parseHydrometerCsv } =
    require("../utils/HydrometerCsvParser");

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

console.log("HydrometerCsvParser tests\n");

test("Parsea un CSV válido con encabezado correcto", () => {

    const csv = "SG,Brix,Alcohol\n1.000,0.0,0.0\n1.005,1.3,0.7";

    const result = parseHydrometerCsv(csv);

    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.rows.length, 2);
    assert.deepStrictEqual(result.rows[0], { rowNumber: 1, sg: "1.000", brix: "0.0", alcohol: "0.0" });

});

test("Acepta saltos de línea Windows (\\r\\n)", () => {

    const csv = "SG,Brix,Alcohol\r\n1.000,0.0,0.0\r\n1.005,1.3,0.7";

    const result = parseHydrometerCsv(csv);

    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.rows.length, 2);

});

test("Ignora líneas en blanco", () => {

    const csv = "SG,Brix,Alcohol\n1.000,0.0,0.0\n\n1.005,1.3,0.7\n\n";

    const result = parseHydrometerCsv(csv);

    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.rows.length, 2);

});

test("Encabezado incorrecto se reporta como error", () => {

    const csv = "Gravity,Brix,ABV\n1.000,0.0,0.0";

    const result = parseHydrometerCsv(csv);

    assert.ok(result.errors.length > 0);
    assert.strictEqual(result.rows.length, 0);
    assert.ok(/encabezado/.test(result.errors[0]));

});

test("Encabezado es insensible a mayúsculas/espacios", () => {

    const csv = " sg , BRIX , alcohol \n1.000,0.0,0.0";

    const result = parseHydrometerCsv(csv);

    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.rows.length, 1);

});

test("Archivo vacío es un error", () => {

    const result = parseHydrometerCsv("");

    assert.ok(result.errors.length > 0);

});

test("Archivo con solo encabezado (sin filas de datos) es un error", () => {

    const result = parseHydrometerCsv("SG,Brix,Alcohol");

    assert.ok(result.errors.length > 0);

});

test("Fila con número de columnas incorrecto se reporta por número de fila", () => {

    const csv = "SG,Brix,Alcohol\n1.000,0.0,0.0\n1.005,1.3\n1.010,2.5,1.3";

    const result = parseHydrometerCsv(csv);

    assert.strictEqual(result.errors.length, 1);
    assert.ok(/fila 2/.test(result.errors[0]));
    // Las filas válidas se siguen recolectando aunque otra tenga error.
    assert.strictEqual(result.rows.length, 2);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
