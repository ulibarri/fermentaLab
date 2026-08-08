const assert =
    require("assert");

const CarbonationCalculator =
    require("../utils/CarbonationCalculator");

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

// Helper que reproduce la fórmula DIRECTA (T,V -> P) usada como fuente,
// para generar casos de prueba con un P consistente conocido y así
// verificar que CarbonationCalculator invierte correctamente (P,T -> V).

function pressureFromTempAndVolumes(tempC, volumes) {

    const tempF =
        (tempC * 9) / 5 + 32;

    return (
        -16.6999
        - 0.0101059 * tempF
        + 0.00116512 * tempF * tempF
        + 0.173354 * tempF * volumes
        + 4.24267 * volumes
        - 0.0684226 * volumes * volumes
    );

}

console.log("CarbonationCalculator tests\n");

// --- Consistencia: invertir la fórmula debe regresar el volumen original ---

test("calculate() invierte correctamente 24°C / 2.0 volumes", () => {

    const tempC = 24;

    const volumes = 2.0;

    const psi = pressureFromTempAndVolumes(tempC, volumes);

    const result = CarbonationCalculator.calculate({ psi, temperature: tempC });

    assert.ok(

        Math.abs(result.co2Volumes - volumes) < 0.01,

        `esperado ~${volumes}, obtuvo ${result.co2Volumes}`

    );

});

test("calculate() invierte correctamente 4°C / 3.0 volumes", () => {

    const tempC = 4;

    const volumes = 3.0;

    const psi = pressureFromTempAndVolumes(tempC, volumes);

    const result = CarbonationCalculator.calculate({ psi, temperature: tempC });

    assert.ok(

        Math.abs(result.co2Volumes - volumes) < 0.01,

        `esperado ~${volumes}, obtuvo ${result.co2Volumes}`

    );

});

test("calculate() invierte correctamente 30°C / 1.2 volumes", () => {

    const tempC = 30;

    const volumes = 1.2;

    const psi = pressureFromTempAndVolumes(tempC, volumes);

    const result = CarbonationCalculator.calculate({ psi, temperature: tempC });

    assert.ok(

        Math.abs(result.co2Volumes - volumes) < 0.01,

        `esperado ~${volumes}, obtuvo ${result.co2Volumes}`

    );

});

// --- Misma presión, distinta temperatura => distinto CO2 (a menor temp, más CO2 disuelto) ---

test("misma presión, menor temperatura produce más CO2 disuelto", () => {

    const highTemp = CarbonationCalculator.calculate({ psi: 25, temperature: 24 });

    const lowTemp = CarbonationCalculator.calculate({ psi: 25, temperature: 20 });

    assert.ok(

        lowTemp.co2Volumes > highTemp.co2Volumes,

        `esperaba que 20°C (${lowTemp.co2Volumes}) > 24°C (${highTemp.co2Volumes})`

    );

});

// --- Ejemplo de referencia conocido (chart de carbonatación forzada): ---
// ~38°F (3.33°C) y 10 PSI produce aproximadamente 2.4 volúmenes.

test("referencia conocida: 3.33°C y 10 PSI da un valor cercano a 2.4 volumes", () => {

    const result = CarbonationCalculator.calculate({ psi: 10, temperature: 3.33 });

    assert.ok(

        result.co2Volumes > 2.2 && result.co2Volumes < 2.6,

        `esperaba un valor cercano a 2.4, obtuvo ${result.co2Volumes}`

    );

});

// --- El resultado siempre incluye psi y temperature de entrada ---

test("calculate() regresa psi y temperature de entrada sin alterarlos", () => {

    const result = CarbonationCalculator.calculate({ psi: 27.5, temperature: 25.0 });

    assert.strictEqual(result.psi, 27.5);

    assert.strictEqual(result.temperature, 25.0);

    assert.ok(typeof result.co2Volumes === "number");

});

// --- Entradas inválidas ---

test("calculate() con psi no numérico lanza error controlado", () => {

    assert.throws(

        () => CarbonationCalculator.calculate({ psi: "abc", temperature: 20 })

    );

});

test("calculate() con temperature no numérica lanza error controlado", () => {

    assert.throws(

        () => CarbonationCalculator.calculate({ psi: 20, temperature: null })

    );

});

test("calculate() con valores extremos fuera de dominio lanza error controlado", () => {

    assert.throws(

        () => CarbonationCalculator.calculate({ psi: -50, temperature: 20 })

    );

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
