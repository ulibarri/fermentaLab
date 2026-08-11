const assert =
    require("assert");

const {
    groupByVolume,
    computeVolumeCorrelations,
    SMALL_SAMPLE_THRESHOLD
} = require("../utils/VolumeAnalysis");

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

console.log("VolumeAnalysis tests\n");

function row(overrides = {}) {

    return {

        plannedVolume: 20,

        producedVolume: null,

        fermentationRate: null,

        linearErrorHours: null,

        exponentialErrorHours: null,

        averageProductTemperature: null,

        averageAmbientTemperature: null,

        ...overrides

    };

}

// --- groupByVolume() ---

test("groupByVolume(): agrupa lotes por su plannedVolume exacto", () => {

    const rows = [

        row({ plannedVolume: 12 }),

        row({ plannedVolume: 12 }),

        row({ plannedVolume: 20 })

    ];

    const result =
        groupByVolume(rows);

    assert.strictEqual(result.length, 2);

    const group12 =
        result.find(g => g.volume === 12);

    const group20 =
        result.find(g => g.volume === 20);

    assert.strictEqual(group12.sampleSize, 2);

    assert.strictEqual(group20.sampleSize, 1);

});

test("groupByVolume(): resultado ordenado ascendentemente por volumen", () => {

    const rows = [

        row({ plannedVolume: 60 }),

        row({ plannedVolume: 12 }),

        row({ plannedVolume: 30 }),

        row({ plannedVolume: 20 })

    ];

    const result =
        groupByVolume(rows);

    assert.deepStrictEqual(result.map(g => g.volume), [12, 20, 30, 60]);

});

test("groupByVolume(): un lote sin plannedVolume no se agrupa (no se le asigna un volumen arbitrario)", () => {

    const rows = [

        row({ plannedVolume: 20 }),

        row({ plannedVolume: null })

    ];

    const result =
        groupByVolume(rows);

    const totalGrouped =
        result.reduce((acc, g) => acc + g.sampleSize, 0);

    assert.strictEqual(totalGrouped, 1);

});

test("groupByVolume(): producedVolume se conserva como promedio independiente, no se usa para agrupar", () => {

    const rows = [

        // Ambos lotes fueron PLANEADOS a 30L (deben agruparse juntos)
        // aunque su producedVolume real haya sido distinto.
        row({ plannedVolume: 30, producedVolume: 27.4 }),

        row({ plannedVolume: 30, producedVolume: 29.8 })

    ];

    const result =
        groupByVolume(rows);

    assert.strictEqual(result.length, 1);

    assert.strictEqual(result[0].sampleSize, 2);

    assert.ok(Math.abs(result[0].averageProducedVolume - 28.6) < 0.01);

});

test("groupByVolume(): calcula la velocidad promedio de fermentación del grupo", () => {

    const rows = [

        row({ plannedVolume: 12, fermentationRate: 0.0030 }),

        row({ plannedVolume: 12, fermentationRate: 0.0032 })

    ];

    const result =
        groupByVolume(rows);

    assert.ok(Math.abs(result[0].averageFermentationRate - 0.0031) < 1e-9);

});

test("groupByVolume(): reutiliza aggregateErrors para el error por modelo, sin mezclar lineal y exponencial", () => {

    const rows = [

        row({ plannedVolume: 20, linearErrorHours: 2.0, exponentialErrorHours: 1.0 }),

        row({ plannedVolume: 20, linearErrorHours: 4.0, exponentialErrorHours: null })

    ];

    const result =
        groupByVolume(rows);

    assert.strictEqual(result[0].linear.count, 2);

    assert.strictEqual(result[0].linear.maeHours, 3.0);

    // Solo un lote tenía error exponencial -> count 1, no se rellena con 0.
    assert.strictEqual(result[0].exponential.count, 1);

    assert.strictEqual(result[0].exponential.maeHours, 1.0);

});

test("groupByVolume(): marca smallSample cuando el grupo tiene menos lotes que el umbral", () => {

    const rows = [

        row({ plannedVolume: 60 }),

        row({ plannedVolume: 60 })

    ]; // 2 lotes, umbral por defecto es 5

    const result =
        groupByVolume(rows);

    assert.strictEqual(result[0].smallSample, true);

    assert.ok(result[0].warning.includes("2 lotes"));

});

test("groupByVolume(): no marca smallSample cuando el grupo alcanza el umbral", () => {

    const rows =
        Array.from({ length: SMALL_SAMPLE_THRESHOLD }, () => row({ plannedVolume: 20 }));

    const result =
        groupByVolume(rows);

    assert.strictEqual(result[0].smallSample, false);

    assert.strictEqual(result[0].warning, null);

});

test("groupByVolume(): el umbral de muestra pequeña es configurable", () => {

    const rows = [

        row({ plannedVolume: 20 }),

        row({ plannedVolume: 20 }),

        row({ plannedVolume: 20 })

    ];

    const withDefault =
        groupByVolume(rows);

    assert.strictEqual(withDefault[0].smallSample, true);

    const withLowerThreshold =
        groupByVolume(rows, 3);

    assert.strictEqual(withLowerThreshold[0].smallSample, false);

});

test("groupByVolume(): con arreglo vacío regresa arreglo vacío, sin lanzar error", () => {

    assert.deepStrictEqual(groupByVolume([]), []);

    assert.deepStrictEqual(groupByVolume(undefined), []);

});

// --- computeVolumeCorrelations() ---

test("computeVolumeCorrelations(): con suficientes lotes, calcula las tres correlaciones de forma independiente", () => {

    const rows = [

        row({ plannedVolume: 12, fermentationRate: 0.0040, linearErrorHours: 1.0, exponentialErrorHours: 4.0 }),

        row({ plannedVolume: 20, fermentationRate: 0.0035, linearErrorHours: 2.0, exponentialErrorHours: 3.0 }),

        row({ plannedVolume: 30, fermentationRate: 0.0030, linearErrorHours: 3.0, exponentialErrorHours: 2.0 }),

        row({ plannedVolume: 60, fermentationRate: 0.0025, linearErrorHours: 4.0, exponentialErrorHours: 1.0 })

    ];

    const result =
        computeVolumeCorrelations(rows);

    // Volumen sube, velocidad baja -> correlación negativa.
    assert.ok(result.volumeVsFermentationRate.value < 0);

    // Volumen sube, error lineal sube -> correlación positiva.
    assert.ok(result.volumeVsLinearError.value > 0);

    // Volumen sube, error exponencial baja -> correlación negativa.
    assert.ok(result.volumeVsExponentialError.value < 0);

});

test("computeVolumeCorrelations(): con pocos lotes, no reporta ningún coeficiente numérico", () => {

    const rows = [

        row({ plannedVolume: 12, fermentationRate: 0.0040 }),

        row({ plannedVolume: 20, fermentationRate: 0.0035 })

    ]; // 2 pares, mínimo es 4

    const result =
        computeVolumeCorrelations(rows);

    assert.strictEqual(result.volumeVsFermentationRate.value, null);

    assert.ok(result.volumeVsFermentationRate.label.includes("insuficientes"));

});

test("computeVolumeCorrelations(): usa lenguaje de correlación, nunca de causalidad", () => {

    const rows = [

        row({ plannedVolume: 12, fermentationRate: 0.0040 }),

        row({ plannedVolume: 20, fermentationRate: 0.0035 }),

        row({ plannedVolume: 30, fermentationRate: 0.0030 }),

        row({ plannedVolume: 60, fermentationRate: 0.0025 })

    ];

    const result =
        computeVolumeCorrelations(rows);

    assert.ok(result.volumeVsFermentationRate.label.includes("Se observa una correlación"));

    assert.ok(!result.volumeVsFermentationRate.label.toLowerCase().includes("provoca"));

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
