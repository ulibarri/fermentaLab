const assert =
    require("assert");

const { convertUsingPoints } =
    require("../utils/HydrometerConverter");

/*
 * Entrega 2.8.0.2, sección 18 -- `HydrometerConversionService` dejó de
 * ser un módulo puro: desde esta entrega consulta la tabla ACTIVE en
 * base de datos (`HydrometerConversionTableRepository`), así que ya no
 * puede probarse aquí sin una base de datos real o sin el arnés de
 * repositorios FAKE que este proyecto reserva para las pruebas e2e en
 * la carpeta de scratch (nunca en `src/tests/`, ver convención
 * establecida en el resto de este directorio). Su cobertura de
 * comportamiento (forma exacta de la respuesta, uso de la tabla
 * ACTIVE, error controlado sin tabla activa) vive ahora en el e2e de
 * 2.8.0.2 (`HydrometerConversionTableService` + `HydrometerConversionService`).
 *
 * Lo que SIGUE siendo puro -- y es justo lo que este archivo cubre
 * ahora -- es `HydrometerConverter.convertUsingPoints()`: el núcleo de
 * interpolación del que `HydrometerConversionService.convert()` es un
 * envoltorio delgado (nunca reimplementa la lógica, sección 6). Se
 * prueba aquí con una tabla PEQUEÑA y explícita (no
 * `HydrometerConverter.LEGACY_POINTS`) para no acoplar este archivo a
 * los valores concretos del catálogo Brewer's Elite -- esos ya están
 * cubiertos en `HydrometerConverter.test.js`.
 */

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

console.log("HydrometerConverter.convertUsingPoints() tests\n");

const POINTS = [

    { sg: 1.000, brix: 0.0, alcohol: 0.0 },

    { sg: 1.010, brix: 2.5, alcohol: 1.3 },

    { sg: 1.020, brix: 5.1, alcohol: 2.6 }

];

test("convertUsingPoints({scale:'SG', value:1.010}) valor exacto -> method TABLE_EXACT", () => {

    const result =
        convertUsingPoints({ points: POINTS, scale: "SG", value: 1.010 });

    assert.strictEqual(result.method, "TABLE_EXACT");
    assert.deepStrictEqual({ sg: result.sg, brix: result.brix, alcohol: result.alcohol }, { sg: 1.010, brix: 2.5, alcohol: 1.3 });

});

test("convertUsingPoints({scale:'SG', value:1.015}) interpola entre dos puntos -> method INTERPOLATED", () => {

    const result =
        convertUsingPoints({ points: POINTS, scale: "SG", value: 1.015 });

    assert.strictEqual(result.method, "INTERPOLATED");
    assert.strictEqual(result.brix, 3.8); // (2.5+5.1)/2
    assert.strictEqual(result.alcohol, 1.9); // (1.3+2.6)/2 = 1.95 -> 1.9 (redondeo de punto flotante, mismo comportamiento que buildResult() desde 2.6.1.x)

});

test("scale se normaliza a mayúsculas/trim", () => {

    const result =
        convertUsingPoints({ points: POINTS, scale: " sg ", value: 1.010 });

    assert.strictEqual(result.sg, 1.010);

});

test("value acepta string numérico (payload HTTP típico)", () => {

    const result =
        convertUsingPoints({ points: POINTS, scale: "SG", value: "1.010" });

    assert.strictEqual(result.sg, 1.010);

});

test("scale inválida lanza error controlado", () => {

    assert.throws(

        () => convertUsingPoints({ points: POINTS, scale: "KELVIN", value: 1 }),

        /scale debe ser una de/

    );

});

test("valor fuera de rango lanza error controlado, nunca extrapola (sección 9)", () => {

    assert.throws(

        () => convertUsingPoints({ points: POINTS, scale: "SG", value: 99 }),

        /fuera del rango/

    );

});

test("tabla con menos de 2 puntos lanza error controlado (sección 8)", () => {

    assert.throws(

        () => convertUsingPoints({ points: [POINTS[0]], scale: "SG", value: 1.0 }),

        /suficientes filas/

    );

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
