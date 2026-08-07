const assert =
    require("assert");

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

console.log("HydrometerConverter tests\n");

// --- fromSG: exact values from the manufacturer table ---

test("fromSG(1.025) usa el punto exacto de la tabla", () => {

    const result = HydrometerConverter.fromSG(1.025);

    assert.strictEqual(result.sg, 1.025);

    assert.strictEqual(result.brix, 6.3);

    assert.strictEqual(result.alcohol, 3.3);

});

test("fromSG(1.000) usa el punto exacto de la tabla (agua)", () => {

    const result = HydrometerConverter.fromSG(1.000);

    assert.strictEqual(result.brix, 0.0);

    assert.strictEqual(result.alcohol, 0.0);

});

test("fromSG(1.150) usa el último punto de la tabla", () => {

    const result = HydrometerConverter.fromSG(1.150);

    assert.strictEqual(result.brix, 34.2);

    assert.strictEqual(result.alcohol, 19.6);

});

// --- fromSG: interpolación lineal ---

test("fromSG(1.022) interpola entre 1.020 y 1.025", () => {

    const result = HydrometerConverter.fromSG(1.022);

    // t = (1.022 - 1.020) / (1.025 - 1.020) = 0.4
    // brix = 5.1 + 0.4 * (6.3 - 5.1) = 5.58 -> 5.6
    // alcohol = 2.6 + 0.4 * (3.3 - 2.6) = 2.88 -> 2.9

    assert.strictEqual(result.brix, 5.6);

    assert.strictEqual(result.alcohol, 2.9);

});

// --- fromBrix: exacto e interpolado ---

test("fromBrix(6.3) usa el punto exacto de la tabla", () => {

    const result = HydrometerConverter.fromBrix(6.3);

    assert.strictEqual(result.sg, 1.025);

    assert.strictEqual(result.alcohol, 3.3);

});

test("fromBrix(5.7) interpola entre 5.1 y 6.3", () => {

    const result = HydrometerConverter.fromBrix(5.7);

    // t = (5.7 - 5.1) / (6.3 - 5.1) = 0.5
    // sg = 1.020 + 0.5 * 0.005 = 1.0225 -> 1.023 (redondeado a 3 decimales)
    // alcohol = 2.6 + 0.5 * 0.7 = 2.95 -> 3.0

    assert.strictEqual(result.sg, 1.023);

    assert.strictEqual(result.alcohol, 3.0);

});

// --- fromAlcohol: exacto e interpolado ---

test("fromAlcohol(3.3) usa el punto exacto de la tabla", () => {

    const result = HydrometerConverter.fromAlcohol(3.3);

    assert.strictEqual(result.sg, 1.025);

    assert.strictEqual(result.brix, 6.3);

});

test("fromAlcohol(3.0) interpola entre 2.6 y 3.3", () => {

    const result = HydrometerConverter.fromAlcohol(3.0);

    // t = (3.0 - 2.6) / (3.3 - 2.6) = 0.571428...
    // sg = 1.020 + t * 0.005 = 1.022857 -> 1.023
    // brix = 5.1 + t * 1.2 = 5.785714 -> 5.8

    assert.strictEqual(result.sg, 1.023);

    assert.strictEqual(result.brix, 5.8);

});

// --- Consistencia cruzada en las tres direcciones (sobre un punto exacto) ---

test("fromSG -> fromBrix -> fromAlcohol son consistentes para 1.060", () => {

    const bySg = HydrometerConverter.fromSG(1.060);

    const byBrix = HydrometerConverter.fromBrix(bySg.brix);

    const byAlcohol = HydrometerConverter.fromAlcohol(bySg.alcohol);

    assert.strictEqual(bySg.sg, 1.060);

    assert.strictEqual(bySg.brix, 14.7);

    assert.strictEqual(bySg.alcohol, 7.8);

    assert.strictEqual(byBrix.sg, 1.060);

    assert.strictEqual(byBrix.alcohol, 7.8);

    assert.strictEqual(byAlcohol.sg, 1.060);

    assert.strictEqual(byAlcohol.brix, 14.7);

});

// --- Valores fuera de rango: error controlado, sin extrapolar ---

test("fromSG(1.5) fuera de rango lanza error controlado", () => {

    assert.throws(

        () => HydrometerConverter.fromSG(1.5),

        /fuera del rango/

    );

});

test("fromSG(0.5) fuera de rango lanza error controlado", () => {

    assert.throws(

        () => HydrometerConverter.fromSG(0.5),

        /fuera del rango/

    );

});

test("fromBrix(-100) fuera de rango lanza error controlado", () => {

    assert.throws(

        () => HydrometerConverter.fromBrix(-100),

        /fuera del rango/

    );

});

test("fromBrix(100) fuera de rango lanza error controlado", () => {

    assert.throws(

        () => HydrometerConverter.fromBrix(100),

        /fuera del rango/

    );

});

test("fromAlcohol(-50) fuera de rango lanza error controlado", () => {

    assert.throws(

        () => HydrometerConverter.fromAlcohol(-50),

        /fuera del rango/

    );

});

test("fromAlcohol(50) fuera de rango lanza error controlado", () => {

    assert.throws(

        () => HydrometerConverter.fromAlcohol(50),

        /fuera del rango/

    );

});

// --- Entradas no numéricas ---

test("fromSG(null) lanza error controlado", () => {

    assert.throws(

        () => HydrometerConverter.fromSG(null)

    );

});

test("fromSG('abc') lanza error controlado", () => {

    assert.throws(

        () => HydrometerConverter.fromSG("abc")

    );

});

// --- Límites exactos del rango (no deben lanzar error) ---

test("fromSG(0.980) en el límite inferior no lanza error", () => {

    const result = HydrometerConverter.fromSG(0.980);

    assert.strictEqual(result.brix, -5.3);

});

test("fromSG(1.150) en el límite superior no lanza error", () => {

    const result = HydrometerConverter.fromSG(1.150);

    assert.strictEqual(result.brix, 34.2);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
