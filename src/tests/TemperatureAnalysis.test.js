const assert =
    require("assert");

const {
    aggregateReadings,
    computeTemperatureStats,
    computeFermentationRate,
    pearsonCorrelation,
    correlateWithLabel,
    groupByTemperatureRange,
    MIN_CORRELATION_SAMPLE_SIZE
} = require("../utils/TemperatureAnalysis");

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

console.log("TemperatureAnalysis tests\n");

const baseTime = new Date("2026-08-01T00:00:00.000Z");

function measurement(hours, fields, phase = "F1") {

    return {

        phase,

        measurementDate: new Date(baseTime.getTime() + hours * 3600 * 1000).toISOString(),

        ...fields

    };

}

// --- aggregateReadings() ---

test("aggregateReadings(): con arreglo vacío regresa count 0 y todo null", () => {

    const result =
        aggregateReadings([]);

    assert.strictEqual(result.count, 0);

    assert.strictEqual(result.average, null);

    assert.strictEqual(result.min, null);

    assert.strictEqual(result.max, null);

});

test("aggregateReadings(): promedio/min/max correctos", () => {

    const result =
        aggregateReadings([25.8, 27.4, 29.1]);

    assert.strictEqual(result.count, 3);

    assert.ok(Math.abs(result.average - 27.43) < 0.01);

    assert.strictEqual(result.min, 25.8);

    assert.strictEqual(result.max, 29.1);

});

// --- computeTemperatureStats() ---

test("computeTemperatureStats(): separa producto y ambiente de forma independiente", () => {

    const measurements = [

        measurement(0, { liquidTemperature: 25.8, ambientTemperature: 29.0 }),

        measurement(10, { liquidTemperature: 27.4, ambientTemperature: 30.2 }),

        measurement(20, { liquidTemperature: 29.1, ambientTemperature: 31.5 })

    ];

    const result =
        computeTemperatureStats(measurements, "F1");

    assert.strictEqual(result.product.count, 3);

    assert.strictEqual(result.ambient.count, 3);

    assert.ok(Math.abs(result.product.average - 27.43) < 0.01);

    assert.ok(Math.abs(result.ambient.average - 30.23) < 0.01);

    // Deben ser objetos independientes, no el mismo valor accidentalmente.
    assert.notStrictEqual(result.product.average, result.ambient.average);

});

test("computeTemperatureStats(): lecturas sin temperatura de ambiente no producen un promedio falso (se excluyen, no se asume 0)", () => {

    const measurements = [

        measurement(0, { liquidTemperature: 25.0, ambientTemperature: null }),

        measurement(10, { liquidTemperature: 26.0 }), // sin campo ambientTemperature

        measurement(20, { liquidTemperature: 27.0, ambientTemperature: 30.0 })

    ];

    const result =
        computeTemperatureStats(measurements, "F1");

    assert.strictEqual(result.product.count, 3);

    assert.strictEqual(result.ambient.count, 1);

    assert.strictEqual(result.ambient.average, 30.0);

});

test("computeTemperatureStats(): solo considera la fase indicada", () => {

    const measurements = [

        measurement(0, { liquidTemperature: 25.0 }, "F1"),

        measurement(5, { liquidTemperature: 99.0 }, "F2")

    ];

    const result =
        computeTemperatureStats(measurements, "F1");

    assert.strictEqual(result.product.count, 1);

    assert.strictEqual(result.product.average, 25.0);

});

test("computeTemperatureStats(): sin ninguna lectura de temperatura, regresa count 0 sin lanzar error", () => {

    const measurements = [

        measurement(0, { ph: 4.3 })

    ];

    const result =
        computeTemperatureStats(measurements, "F1");

    assert.strictEqual(result.product.count, 0);

    assert.strictEqual(result.ambient.count, 0);

});

// --- computeFermentationRate() ---

test("computeFermentationRate(): usa la métrica configurada, no asume pH", () => {

    const measurements = [

        measurement(0, { specificGravity: 1.040 }),

        measurement(10, { specificGravity: 1.012 }),

        measurement(20, { specificGravity: 0.996 })

    ];

    const result =
        computeFermentationRate(measurements, "specificGravity", "F1");

    assert.ok(result, "se esperaba un resultado");

    assert.ok(result.rateAbsolutePerHour > 0);

    assert.strictEqual(result.durationHours, 20);

    assert.strictEqual(result.pointCount, 3);

});

test("computeFermentationRate(): la velocidad es la MAGNITUD del cambio (siempre positiva), sin importar si sube o baja", () => {

    const decreasing = [

        measurement(0, { ph: 4.50 }),

        measurement(10, { ph: 4.00 })

    ];

    const increasing = [

        measurement(0, { ph: 4.00 }),

        measurement(10, { ph: 4.50 })

    ];

    const resultDecreasing =
        computeFermentationRate(decreasing, "ph", "F1");

    const resultIncreasing =
        computeFermentationRate(increasing, "ph", "F1");

    assert.ok(resultDecreasing.rateAbsolutePerHour > 0);

    assert.ok(resultIncreasing.rateAbsolutePerHour > 0);

    assert.ok(

        Math.abs(resultDecreasing.rateAbsolutePerHour - resultIncreasing.rateAbsolutePerHour) < 1e-9,

        "la magnitud debería ser la misma en ambos sentidos"

    );

});

test("computeFermentationRate(): con menos de 2 lecturas de la métrica, regresa null", () => {

    const measurements = [

        measurement(0, { ph: 4.30 })

    ];

    assert.strictEqual(computeFermentationRate(measurements, "ph", "F1"), null);

    assert.strictEqual(computeFermentationRate([], "ph", "F1"), null);

});

// --- pearsonCorrelation() ---

test("pearsonCorrelation(): relación lineal perfecta positiva da r=1", () => {

    const pairs = [

        { x: 1, y: 2 },

        { x: 2, y: 4 },

        { x: 3, y: 6 },

        { x: 4, y: 8 }

    ];

    assert.strictEqual(pearsonCorrelation(pairs), 1);

});

test("pearsonCorrelation(): relación lineal perfecta negativa da r=-1", () => {

    const pairs = [

        { x: 1, y: 8 },

        { x: 2, y: 6 },

        { x: 3, y: 4 },

        { x: 4, y: 2 }

    ];

    assert.strictEqual(pearsonCorrelation(pairs), -1);

});

test("pearsonCorrelation(): sin variación en una variable, regresa null (no está definido, no es 0)", () => {

    const pairs = [

        { x: 27, y: 1 },

        { x: 27, y: 2 },

        { x: 27, y: 3 }

    ];

    assert.strictEqual(pearsonCorrelation(pairs), null);

});

test("pearsonCorrelation(): con menos de 2 pares, regresa null", () => {

    assert.strictEqual(pearsonCorrelation([{ x: 1, y: 1 }]), null);

    assert.strictEqual(pearsonCorrelation([]), null);

});

test("pearsonCorrelation(): ignora pares con valores no numéricos", () => {

    const pairs = [

        { x: 1, y: 2 },

        { x: 2, y: 4 },

        { x: null, y: 6 },

        { x: 3, y: 6 },

        { x: 4, y: 8 }

    ];

    assert.strictEqual(pearsonCorrelation(pairs), 1);

});

// --- correlateWithLabel() ---

test("correlateWithLabel(): con menos del mínimo de muestra, no reporta ningún número (lenguaje de datos insuficientes)", () => {

    const pairs = [

        { x: 25, y: 0.001 },

        { x: 27, y: 0.002 },

        { x: 29, y: 0.003 }

    ]; // 3 pares, mínimo es 4

    const result =
        correlateWithLabel(pairs, "temperatura", "velocidad de fermentación");

    assert.strictEqual(result.value, null);

    assert.strictEqual(result.sampleSize, 3);

    assert.ok(result.label.includes("insuficientes"));

});

test("correlateWithLabel(): con suficiente muestra y correlación fuerte, usa lenguaje de correlación (no de causalidad)", () => {

    const pairs = [

        { x: 25, y: 0.0010 },

        { x: 27, y: 0.0020 },

        { x: 29, y: 0.0030 },

        { x: 31, y: 0.0040 }

    ]; // perfectamente correlacionado, r=1

    const result =
        correlateWithLabel(pairs, "temperatura", "velocidad de fermentación");

    assert.strictEqual(result.value, 1);

    assert.strictEqual(result.sampleSize, 4);

    assert.ok(result.label.includes("Se observa una correlación"));

    assert.ok(!result.label.toLowerCase().includes("provoca"));

    assert.ok(!result.label.toLowerCase().includes("causa"));

});

test("correlateWithLabel(): el mínimo de muestra es configurable", () => {

    const pairs = [

        { x: 25, y: 1 },

        { x: 27, y: 2 },

        { x: 29, y: 3 }

    ];

    const withDefault =
        correlateWithLabel(pairs, "A", "B");

    assert.strictEqual(withDefault.value, null);

    const withLowerMinimum =
        correlateWithLabel(pairs, "A", "B", 3);

    assert.strictEqual(withLowerMinimum.value, 1);

});

test(`MIN_CORRELATION_SAMPLE_SIZE por defecto es ${4}`, () => {

    assert.strictEqual(MIN_CORRELATION_SAMPLE_SIZE, 4);

});

// --- groupByTemperatureRange() ---

test("groupByTemperatureRange(): clasifica correctamente en los 4 rangos por defecto, incluyendo los bordes exactos", () => {

    const rows = [

        { productTemperature: 24.0, fermentationRate: 0.001 }, // <25

        { productTemperature: 25.0, fermentationRate: 0.002 }, // borde exacto -> 25-27 (inclusive abajo)

        { productTemperature: 26.5, fermentationRate: 0.003 }, // 25-27

        { productTemperature: 27.0, fermentationRate: 0.004 }, // borde exacto -> 27-29

        { productTemperature: 28.5, fermentationRate: 0.005 }, // 27-29

        { productTemperature: 29.0, fermentationRate: 0.006 }, // borde exacto -> >29

        { productTemperature: 31.0, fermentationRate: 0.007 }  // >29

    ];

    const result =
        groupByTemperatureRange(rows);

    assert.strictEqual(result.length, 4);

    assert.strictEqual(result[0].label, "< 25 °C");

    assert.strictEqual(result[0].batchCount, 1);

    assert.strictEqual(result[1].label, "25–27 °C");

    assert.strictEqual(result[1].batchCount, 2);

    assert.strictEqual(result[2].label, "27–29 °C");

    assert.strictEqual(result[2].batchCount, 2);

    assert.strictEqual(result[3].label, "> 29 °C");

    assert.strictEqual(result[3].batchCount, 2);

});

test("groupByTemperatureRange(): siempre regresa los 4 rangos, incluso vacíos (para que la tabla sea comparable)", () => {

    const result =
        groupByTemperatureRange([]);

    assert.strictEqual(result.length, 4);

    result.forEach(range => {

        assert.strictEqual(range.batchCount, 0);

        assert.strictEqual(range.averageFermentationRate, null);

    });

});

test("groupByTemperatureRange(): un lote sin productTemperature no se clasifica en ningún rango (no se le asigna uno arbitrario)", () => {

    const rows = [

        { productTemperature: null, fermentationRate: 0.005 },

        { productTemperature: 26.0, fermentationRate: 0.003 }

    ];

    const result =
        groupByTemperatureRange(rows);

    const totalClassified =
        result.reduce((acc, r) => acc + r.batchCount, 0);

    assert.strictEqual(totalClassified, 1);

});

test("groupByTemperatureRange(): calcula el promedio de error lineal y exponencial por separado dentro de cada rango", () => {

    const rows = [

        { productTemperature: 26.0, fermentationRate: 0.001, linearErrorHours: 2.0, exponentialErrorHours: 1.0 },

        { productTemperature: 26.5, fermentationRate: 0.002, linearErrorHours: 4.0, exponentialErrorHours: null }

    ];

    const result =
        groupByTemperatureRange(rows);

    const bucket25to27 =
        result.find(r => r.label === "25–27 °C");

    assert.strictEqual(bucket25to27.batchCount, 2);

    assert.strictEqual(bucket25to27.averageLinearErrorHours, 3.0);

    // Solo un lote tenía error exponencial no nulo -> el promedio es ese
    // valor, no se cuenta el null como 0.
    assert.strictEqual(bucket25to27.averageExponentialErrorHours, 1.0);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
