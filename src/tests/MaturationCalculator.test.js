const assert =
    require("assert");

const MaturationCalculator =
    require("../utils/MaturationCalculator");

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

// Helpers para construir puntos/mediciones de prueba.

function point(hours, value, baseTime) {

    return {

        hours,

        value,

        timestamp: new Date(baseTime.getTime() + hours * 60 * 60 * 1000)

    };

}

function measurement(hours, ph, baseTime, phase = "F1") {

    return {

        phase,

        measurementDate: new Date(baseTime.getTime() + hours * 60 * 60 * 1000).toISOString(),

        ph

    };

}

// Serie sintética generada EXACTAMENTE por el modelo exponencial, para
// poder verificar que fitExponential recupera los parámetros conocidos.

function buildSyntheticSeries(asymptote, k, v0, hoursList, baseTime) {

    return hoursList.map(h => point(

        h,

        asymptote + (v0 - asymptote) * Math.exp(-k * h),

        baseTime

    ));

}

console.log("MaturationCalculator tests\n");

const baseTime = new Date("2026-08-01T00:00:00.000Z");

// --- Caso 1: tasa de cambio ---

test("calculateRate(): 4.30 -> 4.20 en 10h da -0.01 pH/h", () => {

    const points = [

        point(0, 4.30, baseTime),

        point(10, 4.20, baseTime)

    ];

    const result =
        MaturationCalculator.calculateRate(points);

    assert.ok(result, "se esperaba un resultado, obtuvo null");

    assert.ok(

        Math.abs(result.rate - (-0.01)) < 1e-9,

        `esperado -0.01, obtuvo ${result.rate}`

    );

});

test("calculateRate(): usa siempre el último intervalo, no el primero", () => {

    const points = [

        point(0, 5.75, baseTime),

        point(4, 5.75, baseTime),

        point(20, 4.35, baseTime)

    ];

    const result =
        MaturationCalculator.calculateRate(points);

    const expected =
        (4.35 - 5.75) / (20 - 4);

    assert.ok(

        Math.abs(result.rate - expected) < 1e-9,

        `esperado ${expected}, obtuvo ${result.rate}`

    );

});

test("calculateRate(): con menos de 2 puntos regresa null", () => {

    assert.strictEqual(
        MaturationCalculator.calculateRate([point(0, 4.30, baseTime)]),
        null
    );

    assert.strictEqual(
        MaturationCalculator.calculateRate([]),
        null
    );

});

// --- Caso 2: proyección lineal ---

test("linearProjection(): corresponde exactamente a la fórmula del ejemplo", () => {

    const lastTimestamp =
        new Date("2026-08-01T10:00:00.000Z");

    const result =
        MaturationCalculator.linearProjection(4.30, 4.10, -0.0125, lastTimestamp);

    assert.ok(result, "se esperaba un resultado");

    // horasRestantes = (4.30 - 4.10) / 0.0125 = 16
    assert.ok(

        Math.abs(result.hoursRemaining - 16) < 1e-6,

        `esperado 16h, obtuvo ${result.hoursRemaining}`

    );

    const expectedEta =
        new Date(lastTimestamp.getTime() + 16 * 60 * 60 * 1000).toISOString();

    assert.strictEqual(result.eta, expectedEta);

});

test("linearProjection(): con tasa 0 no divide entre cero y no da ETA (Entrega 2.6.0.9)", () => {

    const result =
        MaturationCalculator.linearProjection(4.30, 4.10, 0, new Date());

    assert.ok(result, "se esperaba un objeto explicando por qué no hay ETA, no null");

    assert.strictEqual(result.hoursRemaining, null);

    assert.strictEqual(result.eta, null);

    assert.strictEqual(result.divergent, false);

});

// --- Entrega 2.6.0.9: una tendencia que se aleja del objetivo no debe
// producir una ETA engañosa ---

test("linearProjection(): tendencia que se aleja del objetivo no produce ETA (currentValue > target pero rate > 0)", () => {

    // pH actual 4.30, objetivo 4.10 (hace falta que baje), pero la tasa
    // es positiva (está subiendo) — ej. fase de latencia por buffers,
    // como se vio con Tepache Tamarindo en el proyecto de maduración.
    const result =
        MaturationCalculator.linearProjection(4.30, 4.10, 0.01, new Date());

    assert.ok(result, "se esperaba un objeto, no null");

    assert.strictEqual(result.divergent, true);

    assert.strictEqual(result.hoursRemaining, null);

    assert.strictEqual(result.eta, null);

});

test("linearProjection(): tendencia que se aleja del objetivo no produce ETA (currentValue < target pero rate < 0)", () => {

    // Caso simétrico: la variable necesita subir para llegar al
    // objetivo, pero la tasa es negativa (está bajando).
    const result =
        MaturationCalculator.linearProjection(3.90, 4.10, -0.01, new Date());

    assert.strictEqual(result.divergent, true);

    assert.strictEqual(result.hoursRemaining, null);

    assert.strictEqual(result.eta, null);

});

test("linearProjection(): currentValue ya en targetValue da hoursRemaining 0", () => {

    const lastTimestamp = new Date("2026-08-01T10:00:00.000Z");

    const result =
        MaturationCalculator.linearProjection(4.10, 4.10, -0.01, lastTimestamp);

    assert.strictEqual(result.hoursRemaining, 0);

    assert.strictEqual(result.eta, lastTimestamp.toISOString());

    assert.strictEqual(result.divergent, false);

});

test("linearProjection(): expone 'difference' como currentValue - targetValue", () => {

    const result =
        MaturationCalculator.linearProjection(4.30, 4.10, -0.0125, new Date());

    assert.ok(

        Math.abs(result.difference - 0.2) < 1e-9,

        `esperado 0.2, obtuvo ${result.difference}`

    );

});

test("analyze(): tendencia divergente (lag phase) no produce readyForF1Finish ni ETA lineal engañosa", () => {

    // Reproduce el patrón real de Tepache Tamarindo: el pH SUBE durante
    // la fase de latencia (liberación de buffers) antes de empezar a
    // bajar por fermentación real.
    const measurements = [

        measurement(0, 4.17, baseTime),

        measurement(9.4, 4.31, baseTime),

        measurement(19, 4.40, baseTime)

    ];

    const result =
        MaturationCalculator.analyze({

            measurements,

            metric: "ph",

            targetValue: 4.10,

            rateThreshold: 0.012,

            targetTolerance: 0.05

        });

    assert.ok(result.rate > 0, "la tasa debería ser positiva (pH subiendo)");

    assert.ok(result.linear, "se esperaba un objeto linear, no null");

    assert.strictEqual(result.linear.divergent, true);

    assert.strictEqual(result.linear.eta, null);

    assert.strictEqual(result.readyForF1Finish, false);

});

// --- Caso 3: objetivo alcanzable ---

test("exponentialProjection(): target=4.10 con asymptote=4.05 es alcanzable", () => {

    const series =
        buildSyntheticSeries(4.05, 0.07, 6.2, [0, 5, 12, 20, 30], baseTime);

    const fit =
        MaturationCalculator.fitExponential(series);

    assert.ok(fit, "se esperaba poder ajustar el modelo");

    assert.ok(

        Math.abs(fit.asymptote - 4.05) < 0.02,

        `asíntota ajustada (${fit.asymptote}) debería acercarse a 4.05`

    );

    const projection =
        MaturationCalculator.exponentialProjection(fit, series, 4.10);

    assert.strictEqual(projection.reachable, true);

    assert.ok(projection.eta, "se esperaba un ETA calculado");

});

// --- Caso 4: objetivo inalcanzable ---

test("exponentialProjection(): target=3.70 con asymptote=3.79 es inalcanzable", () => {

    const series =
        buildSyntheticSeries(3.79, 0.09, 5.8, [0, 6, 14, 24, 34], baseTime);

    const fit =
        MaturationCalculator.fitExponential(series);

    assert.ok(fit, "se esperaba poder ajustar el modelo");

    assert.ok(

        Math.abs(fit.asymptote - 3.79) < 0.02,

        `asíntota ajustada (${fit.asymptote}) debería acercarse a 3.79`

    );

    const projection =
        MaturationCalculator.exponentialProjection(fit, series, 3.70);

    assert.strictEqual(projection.reachable, false);

    assert.strictEqual(projection.eta, null);

});

// --- Caso 5: pocas lecturas (insuficiente) ---

test("determineConfidence(): con 1 o 2 lecturas es INSUFFICIENT", () => {

    assert.strictEqual(MaturationCalculator.determineConfidence(1, null), "INSUFFICIENT");

    assert.strictEqual(MaturationCalculator.determineConfidence(2, null), "INSUFFICIENT");

});

test("analyze(): con 2 mediciones no calcula ajuste exponencial (confidence INSUFFICIENT)", () => {

    const measurements = [

        measurement(0, 4.40, baseTime),

        measurement(10, 4.30, baseTime)

    ];

    const result =
        MaturationCalculator.analyze({

            measurements,

            metric: "ph",

            targetValue: 4.10,

            rateThreshold: 0.012,

            targetTolerance: 0.05

        });

    assert.strictEqual(result.exponential.confidence, "INSUFFICIENT");

    assert.strictEqual(result.exponential.asymptote, null);

    // pero la tasa y la proyección lineal sí deben calcularse con 2 puntos.
    assert.ok(result.rate !== null, "se esperaba una tasa calculada con 2 puntos");

    assert.ok(result.linear !== null, "se esperaba una proyección lineal con 2 puntos");

});

// --- Caso 6: mínimo de 4 lecturas para intentar el ajuste (Entrega
// 2.6.1.0 — antes el mínimo era 3), y con exactamente 4 la confianza es
// LOW ---

test("determineConfidence(): con menos de 4 lecturas es INSUFFICIENT", () => {

    assert.strictEqual(MaturationCalculator.determineConfidence(1, null), "INSUFFICIENT");

    assert.strictEqual(MaturationCalculator.determineConfidence(2, null), "INSUFFICIENT");

    assert.strictEqual(MaturationCalculator.determineConfidence(3, 0.01), "INSUFFICIENT");

});

test("determineConfidence(): con exactamente 4 lecturas es LOW", () => {

    assert.strictEqual(MaturationCalculator.determineConfidence(4, 0.01), "LOW");

});

test("fitExponential(): con 3 puntos no intenta el ajuste (mínimo ahora es 4)", () => {

    const series =
        buildSyntheticSeries(4.05, 0.07, 6.2, [0, 5, 12], baseTime);

    assert.strictEqual(MaturationCalculator.fitExponential(series), null);

});

test("fitExponential(): con exactamente 4 puntos limpios sí ajusta", () => {

    const series =
        buildSyntheticSeries(4.05, 0.07, 6.2, [0, 5, 12, 20], baseTime);

    const fit =
        MaturationCalculator.fitExponential(series);

    assert.ok(fit, "se esperaba poder ajustar con 4 puntos");

});

test("fitExponential(): rechaza un ajuste con datos esencialmente aleatorios (residual absurdo)", () => {

    // Ruido sin tendencia real: no debería aceptarse ningún ajuste
    // exponencial razonable — fitExponential debe regresar null en vez
    // de forzar una curva sobre ruido (Entrega 2.6.1.0, "parámetros
    // absurdos → no confiable").
    const noisySeries = [

        point(0, 4.30, baseTime),

        point(5, 4.10, baseTime),

        point(12, 4.45, baseTime),

        point(20, 4.05, baseTime),

        point(30, 4.50, baseTime)

    ];

    const fit =
        MaturationCalculator.fitExponential(noisySeries);

    assert.strictEqual(fit, null);

});

test("analyze(): con ajuste absurdo, la confianza es INSUFFICIENT (no MEDIUM solo por tener muchas lecturas)", () => {

    const measurements = [

        measurement(0, 4.30, baseTime),

        measurement(5, 4.10, baseTime),

        measurement(12, 4.45, baseTime),

        measurement(20, 4.05, baseTime),

        measurement(30, 4.50, baseTime)

    ];

    const result =
        MaturationCalculator.analyze({

            measurements,

            metric: "ph",

            targetValue: 4.10,

            rateThreshold: 0.012,

            targetTolerance: 0.05

        });

    assert.strictEqual(result.pointCount, 5);

    assert.strictEqual(result.exponential.confidence, "INSUFFICIENT");

    assert.strictEqual(result.exponential.asymptote, null);

});

test("analyze(): expone linear y exponential simultáneamente en el mismo resultado", () => {

    const series =
        buildSyntheticSeries(4.07, 0.09, 6.4, [0, 5, 12, 20, 30, 42], baseTime);

    const measurements =
        series.map(p => measurement(p.hours, p.value, baseTime));

    const result =
        MaturationCalculator.analyze({

            measurements,

            metric: "ph",

            targetValue: 4.10,

            rateThreshold: 0.02,

            targetTolerance: 0.05

        });

    assert.ok(result.linear, "se esperaba resultado lineal");

    assert.ok(result.exponential, "se esperaba resultado exponencial");

    assert.ok(

        typeof result.linear.hoursRemaining === "number",

        "se esperaba un ETA lineal numérico"

    );

    assert.ok(

        typeof result.exponential.eta === "string",

        "se esperaba un ETA exponencial"

    );

});

test("determineConfidence(): con 5+ lecturas y error residual bajo es HIGH, si no MEDIUM", () => {

    assert.strictEqual(MaturationCalculator.determineConfidence(5, 0.01), "HIGH");

    assert.strictEqual(MaturationCalculator.determineConfidence(6, 0.2), "MEDIUM");

});

// --- Caso 7: criterio de maduración cumplido ---

test("evaluateReadiness(): tasa dentro del umbral Y valor dentro de tolerancia -> readyForF1Finish", () => {

    const result =
        MaturationCalculator.evaluateReadiness(-0.009, 4.13, 4.10, 0.012, 0.05);

    assert.strictEqual(result.rateConditionMet, true);

    assert.strictEqual(result.targetConditionMet, true);

    assert.strictEqual(result.readyForF1Finish, true);

    assert.strictEqual(result.status, "READY");

});

// --- Caso 8: criterio no cumplido (cada condición por separado) ---

test("evaluateReadiness(): solo la condición de tasa se cumple -> APPROACHING, no ready", () => {

    const result =
        MaturationCalculator.evaluateReadiness(-0.005, 4.50, 4.10, 0.012, 0.05);

    assert.strictEqual(result.rateConditionMet, true);

    assert.strictEqual(result.targetConditionMet, false);

    assert.strictEqual(result.readyForF1Finish, false);

    assert.strictEqual(result.status, "APPROACHING");

});

test("evaluateReadiness(): solo la condición de objetivo se cumple -> APPROACHING, no ready", () => {

    const result =
        MaturationCalculator.evaluateReadiness(-0.05, 4.12, 4.10, 0.012, 0.05);

    assert.strictEqual(result.rateConditionMet, false);

    assert.strictEqual(result.targetConditionMet, true);

    assert.strictEqual(result.readyForF1Finish, false);

    assert.strictEqual(result.status, "APPROACHING");

});

test("evaluateReadiness(): ninguna condición se cumple -> ACTIVE, no ready", () => {

    const result =
        MaturationCalculator.evaluateReadiness(-0.08, 4.60, 4.10, 0.012, 0.05);

    assert.strictEqual(result.rateConditionMet, false);

    assert.strictEqual(result.targetConditionMet, false);

    assert.strictEqual(result.readyForF1Finish, false);

    assert.strictEqual(result.status, "ACTIVE");

});

// --- Pruebas adicionales de integración vía analyze() ---

test("analyze(): con 0 mediciones de la fase, regresa valores nulos sin lanzar error", () => {

    const result =
        MaturationCalculator.analyze({

            measurements: [measurement(0, 4.4, baseTime, "F2")],

            metric: "ph",

            targetValue: 4.10,

            rateThreshold: 0.012,

            targetTolerance: 0.05,

            phase: "F1"

        });

    assert.strictEqual(result.pointCount, 0);

    assert.strictEqual(result.currentValue, null);

    assert.strictEqual(result.rate, null);

    assert.strictEqual(result.linear, null);

    assert.strictEqual(result.readyForF1Finish, false);

});

test("analyze(): con métrica no soportada lanza error controlado", () => {

    assert.throws(() =>

        MaturationCalculator.analyze({

            measurements: [measurement(0, 4.4, baseTime)],

            metric: "temperatureInvalida",

            targetValue: 4.10,

            rateThreshold: 0.012,

            targetTolerance: 0.05

        })

    );

});

test("analyze(): caso completo con 6 lecturas produce readyForF1Finish=true cuando corresponde", () => {

    // Serie que decae hacia 4.07, con la última lectura ya dentro de
    // tolerancia (4.10 ± 0.05) y tasa reciente pequeña.
    const series =
        buildSyntheticSeries(4.07, 0.09, 6.4, [0, 5, 12, 20, 30, 42], baseTime);

    const measurements =
        series.map(p => measurement(p.hours, p.value, baseTime));

    const result =
        MaturationCalculator.analyze({

            measurements,

            metric: "ph",

            targetValue: 4.10,

            rateThreshold: 0.02,

            targetTolerance: 0.05

        });

    assert.strictEqual(result.pointCount, 6);

    assert.ok(["MEDIUM", "HIGH"].includes(result.exponential.confidence));

    assert.strictEqual(result.exponential.reachable, true);

    assert.strictEqual(result.readyForF1Finish, true);

    assert.ok(

        typeof result.exponential.decayConstant === "number",

        "se esperaba decayConstant numérico para poder graficar la curva"

    );

    assert.ok(

        typeof result.exponential.initialValueFit === "number",

        "se esperaba initialValueFit numérico para poder graficar la curva"

    );

});

// --- Entrega 2.6.1.1: comparación de modelos ---

test("compareModels(): diferencia pequeña de RMSE (0.018 vs 0.017) no recomienda ningún modelo (LOW)", () => {

    // Ejemplo textual de la especificación.
    const result =
        MaturationCalculator.compareModels(0.018, 0.017, "HIGH");

    assert.strictEqual(result.recommendedModel, null);

    assert.strictEqual(result.confidence, "LOW");

});

test("compareModels(): diferencia significativa (0.025 vs 0.011) recomienda EXPONENTIAL con HIGH", () => {

    // Ejemplo textual de la especificación.
    const result =
        MaturationCalculator.compareModels(0.025, 0.011, "HIGH");

    assert.strictEqual(result.recommendedModel, "EXPONENTIAL");

    assert.strictEqual(result.confidence, "HIGH");

});

test("compareModels(): recomienda LINEAR cuando su RMSE es significativamente menor", () => {

    const result =
        MaturationCalculator.compareModels(0.011, 0.025, "HIGH");

    assert.strictEqual(result.recommendedModel, "LINEAR");

});

test("compareModels(): sin RMSE de algún modelo, no recomienda nada (INSUFFICIENT)", () => {

    const result =
        MaturationCalculator.compareModels(null, 0.011, "HIGH");

    assert.strictEqual(result.recommendedModel, null);

    assert.strictEqual(result.confidence, "INSUFFICIENT");

});

test("compareModels(): la confianza de la recomendación nunca supera la del propio ajuste exponencial", () => {

    // Misma diferencia grande que el caso HIGH, pero el ajuste
    // exponencial en el que se basa solo tiene confianza LOW.
    const result =
        MaturationCalculator.compareModels(0.025, 0.011, "LOW");

    assert.strictEqual(result.recommendedModel, "EXPONENTIAL");

    assert.strictEqual(result.confidence, "LOW");

});

test("fitLinearRegression(): una línea recta exacta da RMSE~0 y R²~1", () => {

    const points = [

        point(0, 10.0, baseTime),

        point(10, 5.0, baseTime),

        point(20, 0.0, baseTime)

    ];

    const regression =
        MaturationCalculator.fitLinearRegression(points);

    assert.ok(regression, "se esperaba poder ajustar la regresión");

    assert.ok(Math.abs(regression.rmse) < 1e-6, `rmse esperado ~0, obtuvo ${regression.rmse}`);

    assert.ok(Math.abs(regression.r2 - 1) < 1e-6, `r2 esperado ~1, obtuvo ${regression.r2}`);

});

test("analyze(): cuando los datos son claramente exponenciales, la comparación recomienda EXPONENTIAL", () => {

    // Curva exponencial pronunciada (mucha curvatura) — una línea recta
    // no puede seguirla tan bien como el modelo exponencial.
    const series =
        buildSyntheticSeries(4.00, 0.15, 6.5, [0, 3, 6, 10, 15, 22, 30], baseTime);

    const measurements =
        series.map(p => measurement(p.hours, p.value, baseTime));

    const result =
        MaturationCalculator.analyze({

            measurements,

            metric: "ph",

            targetValue: 4.00,

            rateThreshold: 0.02,

            targetTolerance: 0.05

        });

    assert.ok(result.linear, "se esperaba resultado linear con rmse/r2");

    assert.ok(typeof result.linear.rmse === "number", "se esperaba linear.rmse numérico");

    assert.ok(typeof result.exponential.rmse === "number", "se esperaba exponential.rmse numérico");

    assert.ok(

        result.exponential.rmse < result.linear.rmse,

        `se esperaba que el exponencial ajustara mejor: linear=${result.linear.rmse}, exponential=${result.exponential.rmse}`

    );

    assert.strictEqual(result.comparison.recommendedModel, "EXPONENTIAL");

});

test("analyze(): con mediciones insuficientes, comparison.recommendedModel es null e INSUFFICIENT", () => {

    const measurements = [

        measurement(0, 4.40, baseTime),

        measurement(10, 4.30, baseTime)

    ];

    const result =
        MaturationCalculator.analyze({

            measurements,

            metric: "ph",

            targetValue: 4.10,

            rateThreshold: 0.012,

            targetTolerance: 0.05

        });

    assert.strictEqual(result.comparison.recommendedModel, null);

    assert.strictEqual(result.comparison.confidence, "INSUFFICIENT");

});

test("analyze(): la comparación no modifica currentValue, rate ni las mediciones originales", () => {

    const measurements = [

        measurement(0, 4.40, baseTime),

        measurement(10, 4.30, baseTime),

        measurement(20, 4.20, baseTime),

        measurement(30, 4.15, baseTime)

    ];

    const snapshot =
        JSON.parse(JSON.stringify(measurements));

    MaturationCalculator.analyze({

        measurements,

        metric: "ph",

        targetValue: 4.10,

        rateThreshold: 0.012,

        targetTolerance: 0.05

    });

    assert.deepStrictEqual(measurements, snapshot);

});

// --- Entrega 2.6.1.2: validación histórica ---

test("findTargetCrossing(): lectura exactamente igual al target la usa directamente", () => {

    const points = [

        point(0, 4.30, baseTime),

        point(10, 4.00, baseTime),

        point(20, 3.80, baseTime)

    ];

    const result =
        MaturationCalculator.findTargetCrossing(points, 4.00);

    assert.strictEqual(result.reached, true);

    assert.strictEqual(result.reachedAtHours, 10);

});

test("findTargetCrossing(): interpola el cruce entre dos lecturas (t1 pH4.05, t2 pH3.98, target 4.00)", () => {

    const points = [

        point(0, 4.20, baseTime),

        point(10, 4.05, baseTime),

        point(20, 3.98, baseTime)

    ];

    const result =
        MaturationCalculator.findTargetCrossing(points, 4.00);

    assert.strictEqual(result.reached, true);

    // fracción = (4.05-4.00)/((4.05-4.00)-(3.98-4.00)) = 0.05/0.07 ≈ 0.7143
    // horas = 10 + 0.7143 * 10 ≈ 17.14
    assert.ok(

        Math.abs(result.reachedAtHours - 17.14) < 0.05,

        `esperado ~17.14h, obtuvo ${result.reachedAtHours}`

    );

    assert.ok(result.reachedAtTimestamp, "se esperaba un timestamp de cruce");

});

test("findTargetCrossing(): el objetivo nunca se cruza -> reached=false, no null", () => {

    const points = [

        point(0, 4.50, baseTime),

        point(10, 4.40, baseTime),

        point(20, 4.35, baseTime)

    ];

    const result =
        MaturationCalculator.findTargetCrossing(points, 4.00);

    assert.strictEqual(result.reached, false);

    assert.strictEqual(result.reachedAtHours, null);

});

test("findTargetCrossing(): con menos de 2 puntos regresa reached=null (no se puede determinar)", () => {

    assert.strictEqual(
        MaturationCalculator.findTargetCrossing([point(0, 4.30, baseTime)], 4.00).reached,
        null
    );

    assert.strictEqual(
        MaturationCalculator.findTargetCrossing([], 4.00).reached,
        null
    );

});

test("findTargetCrossing(): sin targetValue configurado regresa reached=null", () => {

    const points = [

        point(0, 4.30, baseTime),

        point(10, 3.90, baseTime)

    ];

    assert.strictEqual(
        MaturationCalculator.findTargetCrossing(points, null).reached,
        null
    );

});

test("evaluateHistorical(): objetivo alcanzado con tendencia limpia -> ambos modelos EVALUATED con error numérico no artificial", () => {

    // Serie que decrece de forma limpia y cruza el target (4.00) entre
    // las horas 30 y 40, con lecturas adicionales después del cruce —
    // el backtest debe usar solo las lecturas ANTERIORES al cruce para
    // calcular la "predicción", no el set completo.
    const measurements = [

        measurement(0, 4.50, baseTime),

        measurement(10, 4.35, baseTime),

        measurement(20, 4.20, baseTime),

        measurement(30, 4.05, baseTime),

        measurement(40, 3.95, baseTime),

        measurement(50, 3.85, baseTime),

        measurement(60, 3.75, baseTime)

    ];

    const result =
        MaturationCalculator.evaluateHistorical({

            measurements,

            metric: "ph",

            targetValue: 4.00,

            phase: "F1"

        });

    assert.strictEqual(result.targetReached, true);

    assert.strictEqual(result.linear.status, "EVALUATED");

    assert.ok(

        typeof result.linear.absoluteErrorHours === "number",

        "se esperaba un error lineal numérico, no artificial"

    );

    assert.ok(

        result.linear.absoluteErrorHours >= 0,

        "el error absoluto no debe ser negativo"

    );

    // La tendencia es limpia (sin lag phase), así que el modelo lineal
    // NO debería quedar marcado como divergente solo por truncar los
    // datos antes del cruce — esto era precisamente el bug del primer
    // diseño (usar el dataset completo hacía que la tasa más reciente
    // quedara del lado equivocado del objetivo ya alcanzado).
    assert.notStrictEqual(result.linear.reason, "trend_diverging");

});

test("evaluateHistorical(): con suficientes puntos previos al cruce, el modelo exponencial también es EVALUATED", () => {

    // Decaimiento más lento (k=0.04) para que el cruce con el target
    // ocurra después de al menos 4 lecturas (mínimo para el ajuste
    // exponencial).
    const series =
        buildSyntheticSeries(3.90, 0.04, 4.50, [0, 10, 20, 30, 40, 50, 60, 70, 80], baseTime);

    const measurements =
        series.map(p => measurement(p.hours, p.value, baseTime));

    const result =
        MaturationCalculator.evaluateHistorical({

            measurements,

            metric: "ph",

            targetValue: 4.00,

            phase: "F1"

        });

    assert.strictEqual(result.targetReached, true);

    assert.strictEqual(result.exponential.status, "EVALUATED");

    assert.ok(typeof result.exponential.absoluteErrorHours === "number");

});

test("evaluateHistorical(): objetivo no alcanzado -> NOT_EVALUABLE con reason 'target_not_reached', sin error=0 artificial", () => {

    const measurements = [

        measurement(0, 4.50, baseTime),

        measurement(10, 4.40, baseTime),

        measurement(20, 4.35, baseTime)

    ];

    const result =
        MaturationCalculator.evaluateHistorical({

            measurements,

            metric: "ph",

            targetValue: 4.00,

            phase: "F1"

        });

    assert.strictEqual(result.targetReached, false);

    assert.strictEqual(result.linear.status, "NOT_EVALUABLE");

    assert.strictEqual(result.linear.reason, "target_not_reached");

    assert.strictEqual(result.linear.absoluteErrorHours, null);

    assert.strictEqual(result.exponential.status, "NOT_EVALUABLE");

    assert.strictEqual(result.exponential.absoluteErrorHours, null);

});

test("evaluateHistorical(): con menos de 2 mediciones, no se puede determinar (reached=null) y ambos modelos NOT_EVALUABLE", () => {

    const measurements = [

        measurement(0, 4.50, baseTime)

    ];

    const result =
        MaturationCalculator.evaluateHistorical({

            measurements,

            metric: "ph",

            targetValue: 4.00,

            phase: "F1"

        });

    assert.strictEqual(result.targetReached, null);

    assert.strictEqual(result.linear.status, "NOT_EVALUABLE");

    assert.strictEqual(result.linear.reason, "insufficient_data");

    assert.strictEqual(result.exponential.status, "NOT_EVALUABLE");

});

test("evaluateHistorical(): cruce ocurre con pocos puntos previos (<4) -> lineal EVALUATED pero exponencial NOT_EVALUABLE por datos insuficientes", () => {

    // Solo 3 lecturas antes del cruce: alcanza para el modelo lineal
    // (mínimo 2) pero no para el exponencial (mínimo 4).
    const measurements = [

        measurement(0, 4.50, baseTime),

        measurement(10, 4.30, baseTime),

        measurement(20, 4.10, baseTime),

        measurement(30, 3.95, baseTime),  // cruce entre horas 20 y 30

        measurement(40, 3.80, baseTime)

    ];

    const result =
        MaturationCalculator.evaluateHistorical({

            measurements,

            metric: "ph",

            targetValue: 4.00,

            phase: "F1"

        });

    assert.strictEqual(result.targetReached, true);

    assert.strictEqual(result.linear.status, "EVALUATED");

    assert.strictEqual(result.exponential.status, "NOT_EVALUABLE");

    assert.strictEqual(result.exponential.reason, "insufficient_data");

});

test("evaluateHistorical(): sin targetValue configurado, ambos modelos NOT_EVALUABLE con reason 'no_target_configured'", () => {

    const measurements = [

        measurement(0, 4.50, baseTime),

        measurement(10, 4.30, baseTime),

        measurement(20, 4.10, baseTime),

        measurement(30, 4.00, baseTime)

    ];

    const result =
        MaturationCalculator.evaluateHistorical({

            measurements,

            metric: "ph",

            targetValue: null,

            phase: "F1"

        });

    assert.strictEqual(result.targetReached, null);

    assert.strictEqual(result.linear.reason, "no_target_configured");

    assert.strictEqual(result.exponential.reason, "no_target_configured");

});

test("evaluateHistorical(): no muta el arreglo de mediciones original", () => {

    const measurements = [

        measurement(0, 4.50, baseTime),

        measurement(10, 4.30, baseTime),

        measurement(20, 4.10, baseTime),

        measurement(30, 3.95, baseTime),

        measurement(40, 3.80, baseTime)

    ];

    const snapshot =
        JSON.parse(JSON.stringify(measurements));

    MaturationCalculator.evaluateHistorical({

        measurements,

        metric: "ph",

        targetValue: 4.00,

        phase: "F1"

    });

    assert.deepStrictEqual(measurements, snapshot);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
