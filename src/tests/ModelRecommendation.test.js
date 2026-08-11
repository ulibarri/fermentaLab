const assert =
    require("assert");

const {
    SIGNIFICANT_VALIDATION_IMPROVEMENT,
    HIGH_VARIABILITY_RELATIVE_MARGIN,
    buildRecommendation
} = require("../utils/ModelRecommendation");

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

console.log("ModelRecommendation tests\n");

function historicalSummary(count, maeHours) {

    return { count, maeHours };

}

function validationOf(linearMae, exponentialMae, insufficientData = false) {

    return {

        insufficientData,

        linear: { validation: { maeHours: linearMae } },

        exponential: { validation: { maeHours: exponentialMae } }

    };

}

function stabilityOf({ sufficientData = true, linearWins = null, exponentialWins = null, linearMaeStdDev = null, exponentialMaeStdDev = null } = {}) {

    return { sufficientData, linearWins, exponentialWins, linearMaeStdDev, exponentialMaeStdDev };

}

// --- Ejemplo HIGH de la especificación (sección 4 + evidencia de sección 8) ---

test("buildRecommendation(): reproduce el ejemplo HIGH de la especificación", () => {

    const result =
        buildRecommendation({

            historical: {

                linear: historicalSummary(10, 4.1),

                exponential: historicalSummary(10, 4.8)

            },

            validation: validationOf(3.8, 5.4),

            stability: stabilityOf({ linearWins: 4, exponentialWins: 1, linearMaeStdDev: 1.1, exponentialMaeStdDev: 3.4 })

        });

    assert.strictEqual(result.model, "LINEAR");

    assert.strictEqual(result.confidence, "HIGH");

    assert.strictEqual(result.status, "RECOMMENDED");

    assert.ok(result.reasons.includes("LINEAR obtuvo menor MAE en validación."));

    assert.ok(result.reasons.includes("LINEAR obtuvo más victorias en validación temporal."));

    assert.ok(result.reasons.includes("LINEAR presentó menor variabilidad del error."));

});

// --- Ejemplo MEDIUM de la especificación (sección 4) ---

test("buildRecommendation(): reproduce el ejemplo MEDIUM de la especificación (4.1h vs 4.4h, sin datos de estabilidad)", () => {

    const result =
        buildRecommendation({

            historical: null,

            validation: validationOf(4.1, 4.4),

            stability: stabilityOf({ sufficientData: false })

        });

    assert.strictEqual(result.model, "LINEAR");

    assert.strictEqual(result.confidence, "MEDIUM");

    assert.strictEqual(result.status, "RECOMMENDED");

    assert.ok(result.reasons.includes("LINEAR obtuvo menor MAE en validación."));

});

// --- Regla 1: datos insuficientes ---

test("buildRecommendation(): Regla 1 -- sin validación temporal, NO_DECISION con confianza LOW", () => {

    const result =
        buildRecommendation({

            historical: null,

            validation: { insufficientData: true },

            stability: stabilityOf({ sufficientData: false })

        });

    assert.strictEqual(result.model, null);

    assert.strictEqual(result.status, "NO_DECISION");

    assert.strictEqual(result.confidence, "LOW");

    assert.ok(result.reasons[0].toLowerCase().includes("datos insuficientes"));

});

test("buildRecommendation(): validation null también dispara la Regla 1", () => {

    const result =
        buildRecommendation({ historical: null, validation: null, stability: stabilityOf({ sufficientData: false }) });

    assert.strictEqual(result.status, "NO_DECISION");

});

test("buildRecommendation(): MAE de validación null (defensivo) también dispara NO_DECISION", () => {

    const result =
        buildRecommendation({

            historical: null,

            validation: { insufficientData: false, linear: { validation: { maeHours: null } }, exponential: { validation: { maeHours: 4 } } },

            stability: stabilityOf({ sufficientData: false })

        });

    assert.strictEqual(result.status, "NO_DECISION");

});

// --- Regla 2: resultados similares ---

test("buildRecommendation(): Regla 2 -- diferencia de validación por debajo del umbral, NO_DECISION", () => {

    const result =
        buildRecommendation({

            historical: null,

            validation: validationOf(4.00, 4.05), // diferencia relativa ~1.2%, bajo el 5%

            stability: stabilityOf({ sufficientData: false })

        });

    assert.strictEqual(result.model, null);

    assert.strictEqual(result.status, "NO_DECISION");

    assert.ok(result.reasons[0].toLowerCase().includes("demasiado pequeña"));

});

// --- Regla 4: contradicción dura -> NO_DECISION ---

test("buildRecommendation(): Regla 4 (contradicción dura) -- ventanas Y variabilidad contradicen al candidato -> NO_DECISION", () => {

    const result =
        buildRecommendation({

            historical: null,

            validation: validationOf(3.0, 6.0), // candidato LINEAR, diferencia grande

            stability: stabilityOf({ linearWins: 1, exponentialWins: 4, linearMaeStdDev: 5.0, exponentialMaeStdDev: 1.0 })

        });

    assert.strictEqual(result.model, null);

    assert.strictEqual(result.status, "NO_DECISION");

    assert.strictEqual(result.confidence, "LOW");

});

// --- Regla 4: contradicción suave -> LOW pero SÍ se recomienda ---

test("buildRecommendation(): Regla 4 (contradicción suave) -- solo las ventanas contradicen -> LOW, sigue recomendando", () => {

    const result =
        buildRecommendation({

            historical: null,

            validation: validationOf(3.0, 6.0),

            stability: stabilityOf({ linearWins: 1, exponentialWins: 3, linearMaeStdDev: 1.0, exponentialMaeStdDev: 1.1 })

        });

    assert.strictEqual(result.model, "LINEAR");

    assert.strictEqual(result.status, "RECOMMENDED");

    assert.strictEqual(result.confidence, "LOW");

    assert.ok(result.reasons.some(r => r.includes("reduce la confianza")));

});

test("buildRecommendation(): Regla 4 (contradicción suave) -- solo la variabilidad contradice -> LOW", () => {

    const result =
        buildRecommendation({

            historical: null,

            validation: validationOf(3.0, 6.0),

            stability: stabilityOf({ linearWins: 3, exponentialWins: 1, linearMaeStdDev: 5.0, exponentialMaeStdDev: 1.0 })

        });

    assert.strictEqual(result.model, "LINEAR");

    assert.strictEqual(result.confidence, "LOW");

});

// --- Desacuerdo histórico: no veta, pero limita a MEDIUM (Regla 3) ---

test("buildRecommendation(): el desempeño histórico contrario limita la confianza a MEDIUM, nunca la reemplaza (Regla 3)", () => {

    const result =
        buildRecommendation({

            historical: {

                linear: historicalSummary(10, 6.0),

                exponential: historicalSummary(10, 4.0) // históricamente EXPONENTIAL es mejor

            },

            validation: validationOf(3.0, 6.0), // pero en validación LINEAR gana claramente

            stability: stabilityOf({ linearWins: 4, exponentialWins: 1, linearMaeStdDev: 1.0, exponentialMaeStdDev: 3.0 })

        });

    // La Regla 3 dice que la validación pesa más: el candidato sigue
    // siendo LINEAR (el ganador de validación), nunca cambia al modelo
    // que ganó históricamente.
    assert.strictEqual(result.model, "LINEAR");

    assert.strictEqual(result.status, "RECOMMENDED");

    // Pero el desacuerdo histórico impide alcanzar HIGH.
    assert.strictEqual(result.confidence, "MEDIUM");

    assert.ok(result.reasons.some(r => r.includes("EXPONENTIAL") && r.includes("mayor peso")));

});

test("buildRecommendation(): el acuerdo histórico es una razón adicional, pero no es requisito para MEDIUM", () => {

    const result =
        buildRecommendation({

            historical: {

                linear: historicalSummary(10, 4.0),

                exponential: historicalSummary(10, 6.0)

            },

            validation: validationOf(4.1, 4.4),

            stability: stabilityOf({ sufficientData: false })

        });

    assert.strictEqual(result.model, "LINEAR");

    assert.ok(result.reasons.includes("LINEAR también tuvo menor MAE histórico."));

});

// --- constantes ---

test("constantes exportadas: SIGNIFICANT_VALIDATION_IMPROVEMENT=0.20, HIGH_VARIABILITY_RELATIVE_MARGIN=0.5", () => {

    assert.strictEqual(SIGNIFICANT_VALIDATION_IMPROVEMENT, 0.20);

    assert.strictEqual(HIGH_VARIABILITY_RELATIVE_MARGIN, 0.5);

});

console.log(`\n${passed} pasaron, ${failed} fallaron.\n`);

if (failed > 0) {

    process.exit(1);

}
