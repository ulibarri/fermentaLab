/*
 * Efectividad real de las recalibraciones (Entrega 2.6.1.32).
 *
 * Módulo puro (sin Sequelize ni Express), mismo estilo que
 * ProposalScoring.js (2.6.1.30)/CalibrationHistoryAnalysis.js
 * (2.6.1.31). Cierra el ciclo PROPUESTA -> SIMULACIÓN -> MEJORA
 * ESPERADA -> ACTIVACIÓN -> DATOS REALES -> MEJORA REAL -> EFECTIVIDAD
 * respondiendo: "¿la mejora que prometía la simulación realmente
 * ocurrió después de activar la calibración?"
 *
 * Deliberadamente NO reimplementa ningún cálculo de "% de mejora" --
 * reutiliza `ProposalScoring.computeMaeImprovementPercentage()`/
 * `computeRmseImprovementPercentage()`/`computeBiasImprovementPercentage()`
 * (2.6.1.30) para AMBOS lados de la comparación (esperado y real): la
 * fórmula matemática de "% de mejora entre un valor de referencia y un
 * valor posterior" es exactamente la misma, sin importar si la
 * referencia es la muestra simulada (sección 6, "misma muestra") o la
 * muestra real post-activación -- lo único que cambia es QUÉ par de
 * números se le pasa, decidido por `RecalibrationEffectivenessService`.
 *
 * Lo genuinamente nuevo de esta entrega es un solo concepto: la
 * EFECTIVIDAD (sección 2, `mejora_real / mejora_esperada`), su
 * clasificación en niveles (sección 3), y el estado de evidencia
 * mínima (sección 7/9/15) -- ver `evaluate()` abajo.
 */

const ProposalScoring =
    require("./ProposalScoring");

const PostActivationEvaluation =
    require("./PostActivationEvaluation");

// Sección 7 -- "mínimo = 10 predicciones evaluadas", explícitamente
// pedido como configurable (mismo criterio que
// ProposalScoring.MIN_LIMITED_SAMPLE/MIN_MODERATE_SAMPLE/MIN_HIGH_SAMPLE,
// 2.6.1.30, y PostActivationEvaluation.MIN_SIGNIFICANT_SAMPLE, 2.6.1.27
// -- nunca hardcodeado en el servicio ni en la vista).
const DEFAULT_MINIMUM_SAMPLE_SIZE = 10;

// Sección 3 -- los cuatro tramos de efectividad, sobre el score YA
// calculado (nunca sobre el sampleSize -- eso es un eje totalmente
// distinto, sección 9).
const HIGH_MIN_SCORE = 90;

const MODERATE_MIN_SCORE = 70;

const LOW_MIN_SCORE = 30;

// Reutiliza el mismo umbral de "cambio no ruidoso" (5%) que gobierna
// IMPROVED/DEGRADED en todo el resto de este proyecto desde 2.6.1.17 --
// usado aquí únicamente para los checkmarks ✓/✗ por métrica de la
// sección 10 (¿esta métrica individual mejoró de verdad, o el cambio
// fue ruido?), nunca para la clasificación de efectividad en sí (esa
// usa los cortes 90/70/30 de arriba, propios de esta entrega).
const METRIC_IMPROVEMENT_NOISE_THRESHOLD_PERCENTAGE =
    PostActivationEvaluation.IMPROVEMENT_THRESHOLD_PERCENTAGE;

function round(value, decimals = 1) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

class RecalibrationEffectiveness {

    /*
     * Sección 7/9/15 -- ¿tenemos evidencia REAL post-activación
     * suficiente para hablar de efectividad en absoluto? PENDING (cero
     * predicciones evaluadas todavía) / PRELIMINARY (algunas, pero por
     * debajo del mínimo) / VALID (alcanzó el mínimo). Deliberadamente
     * la MISMA forma de corte de tres tramos que
     * `PostActivationEvaluation.classifyEvaluationStatus()` (2.6.1.27)
     * y `ProposalScoring.classifySampleConfidence()` (2.6.1.30), pero
     * con su propio mínimo configurable en vez de reutilizar esos
     * (sección 7 lo pide explícitamente como un número propio de esta
     * entrega, no necesariamente igual a los de las otras dos).
     */
    static classifySampleStatus(sampleSize, minimumSampleSize = DEFAULT_MINIMUM_SAMPLE_SIZE) {

        const n =
            Number(sampleSize) || 0;

        if (n <= 0) {

            return "PENDING";

        }

        if (n < minimumSampleSize) {

            return "PRELIMINARY";

        }

        return "VALID";

    }

    /*
     * Sección 2/3 -- núcleo de la entrega. `expectedImprovement`/
     * `actualImprovement` son porcentajes YA calculados (magnitud,
     * mayor = mejor, mismo signo que `ProposalScoring.compute*
     * ImprovementPercentage()` produce). Regresa SIEMPRE un objeto con
     * `score`/`isRegression`/`reason` -- nunca un número fabricado
     * cuando el cálculo no tiene sentido (mismo criterio "evitar falsa
     * precisión" de todo el proyecto).
     *
     * Casos defensivos deliberados, ninguno mencionado literalmente en
     * el spec pero necesarios para no dividir por cero/negativos sin
     * sentido:
     *   - `actualImprovement < 0` -> REGRESIÓN (sección 3, regla
     *     explícita: "no debemos convertir el resultado negativo a un
     *     porcentaje de efectividad").
     *   - `expectedImprovement` null o <= 0 -> no hay ninguna mejora
     *     esperada contra la cual medir qué tanto de ella se consiguió
     *     -- `score: null`, `reason: "NO_EXPECTED_IMPROVEMENT"` (esto
     *     no debería ocurrir en la práctica, ya que una propuesta solo
     *     se crea cuando su simulación mostró IMPROVEMENT desde
     *     2.6.1.24/29, pero se maneja igual de forma explícita en vez
     *     de asumirlo).
     */
    static computeEffectivenessScore(expectedImprovement, actualImprovement) {

        if (actualImprovement === null || actualImprovement === undefined) {

            return { score: null, isRegression: false, reason: "NO_ACTUAL_IMPROVEMENT" };

        }

        if (actualImprovement < 0) {

            return { score: null, isRegression: true, reason: null };

        }

        if (expectedImprovement === null || expectedImprovement === undefined || expectedImprovement <= 0) {

            return { score: null, isRegression: false, reason: "NO_EXPECTED_IMPROVEMENT" };

        }

        // Sección 8, criterio explícito: "un valor superior al 100% no
        // es un error" -- nunca se recorta (clamp) a 100.
        return { score: round((actualImprovement / expectedImprovement) * 100, 1), isRegression: false, reason: null };

    }

    /*
     * Sección 3 -- traduce un score YA calculado (nunca null, nunca
     * regresión -- esos dos casos se manejan aparte) a uno de los
     * cuatro niveles con su semáforo.
     */
    static classifyEffectivenessTier(score) {

        if (score === null || score === undefined) {

            return null;

        }

        if (score >= HIGH_MIN_SCORE) {

            return { code: "HIGH", label: "ALTA EFECTIVIDAD", emoji: "🟢" };

        }

        if (score >= MODERATE_MIN_SCORE) {

            return { code: "MODERATE", label: "EFECTIVIDAD MODERADA", emoji: "🟡" };

        }

        if (score >= LOW_MIN_SCORE) {

            return { code: "LOW", label: "BAJA EFECTIVIDAD", emoji: "🟠" };

        }

        return { code: "INEFFECTIVE", label: "INEFECTIVA", emoji: "🔴" };

    }

    /*
     * Sección 10 -- checkmark ✓/✗ por métrica: ¿esta métrica
     * individual mejoró de verdad en el mundo real (más allá del
     * ruido), sin importar si la efectividad GLOBAL (basada solo en
     * MAE, sección 2) resultó alta o baja? Puede haber métricas
     * individuales que no acompañen la tendencia general -- eso es
     * justamente lo que la sección 5 quiere poder detectar ("MAE
     * mejora, RMSE mejora, pero aparece nuevamente un sesgo").
     */
    static isMetricImproved(actualImprovementPercentage) {

        return actualImprovementPercentage !== null && actualImprovementPercentage !== undefined && actualImprovementPercentage > METRIC_IMPROVEMENT_NOISE_THRESHOLD_PERCENTAGE;

    }

    /*
     * Orquestador -- combina todo lo anterior a partir de los
     * resúmenes YA calculados por el servicio (nunca decide aquí qué
     * predicciones entran a cada muestra, sección 6, eso es
     * responsabilidad exclusiva de RecalibrationEffectivenessService).
     *
     * `simulationBaseline`/`simulated` -- MISMA muestra (ventana
     * reciente de la calibración PADRE, simulada con el offset
     * propuesto), sección 6, "Simulación: ACTUAL vs PROPUESTA".
     * `realBaseline`/`real` -- desempeño REAL post-activación de la
     * calibración padre vs. la calibración activada, sección 6,
     * "Resultado real: CALIBRACIÓN ANTERIOR vs CALIBRACIÓN ACTIVADA".
     * Cada uno es {maeHours, rmseHours, biasHours, sampleSize} o null.
     */
    static evaluate({

        simulationBaseline,

        simulated,

        realBaseline,

        real,

        minimumSampleSize = DEFAULT_MINIMUM_SAMPLE_SIZE

    }) {

        const expected = {

            mae: ProposalScoring.computeMaeImprovementPercentage(simulationBaseline ? simulationBaseline.maeHours : null, simulated ? simulated.maeHours : null),

            rmse: ProposalScoring.computeRmseImprovementPercentage(simulationBaseline ? simulationBaseline.rmseHours : null, simulated ? simulated.rmseHours : null),

            bias: ProposalScoring.computeBiasImprovementPercentage(simulationBaseline ? simulationBaseline.biasHours : null, simulated ? simulated.biasHours : null)

        };

        const actual = {

            mae: ProposalScoring.computeMaeImprovementPercentage(realBaseline ? realBaseline.maeHours : null, real ? real.maeHours : null),

            rmse: ProposalScoring.computeRmseImprovementPercentage(realBaseline ? realBaseline.rmseHours : null, real ? real.rmseHours : null),

            bias: ProposalScoring.computeBiasImprovementPercentage(realBaseline ? realBaseline.biasHours : null, real ? real.biasHours : null)

        };

        const sampleSize =
            real ? (Number(real.sampleSize) || 0) : 0;

        const sampleStatus =
            RecalibrationEffectiveness.classifySampleStatus(sampleSize, minimumSampleSize);

        const effectiveness =
            RecalibrationEffectiveness.computeEffectivenessScore(expected.mae, actual.mae);

        // Sección 15 -- el estado final combina AMBOS ejes
        // (¿alcanzamos el mínimo de evidencia? / ¿el resultado es una
        // regresión?), nunca uno solo. Una regresión detectada con
        // muestra insuficiente (PRELIMINARY) NO se reporta todavía como
        // REGRESSION -- sección 9, "no debería producir una conclusión
        // definitiva" aplica también a las malas noticias, no solo a
        // las buenas: se necesita el mínimo de evidencia antes de
        // afirmar cualquier cosa con certeza.
        let status;

        if (sampleStatus === "VALID" && effectiveness.isRegression) {

            status = "REGRESSION";

        } else {

            status = sampleStatus;

        }

        const tier =
            (status === "VALID" && !effectiveness.isRegression) ? RecalibrationEffectiveness.classifyEffectivenessTier(effectiveness.score) : null;

        const checks =
            status === "VALID" || status === "REGRESSION" ? {

                mae: RecalibrationEffectiveness.isMetricImproved(actual.mae),

                rmse: RecalibrationEffectiveness.isMetricImproved(actual.rmse),

                bias: RecalibrationEffectiveness.isMetricImproved(actual.bias)

            } : null;

        return {

            status,

            isRegression: status === "REGRESSION",

            sampleSize,

            minimumSampleSize,

            expected,

            actual,

            effectivenessScore: effectiveness.score,

            effectivenessReason: effectiveness.reason,

            tier,

            checks

        };

    }

}

RecalibrationEffectiveness.DEFAULT_MINIMUM_SAMPLE_SIZE =
    DEFAULT_MINIMUM_SAMPLE_SIZE;

RecalibrationEffectiveness.HIGH_MIN_SCORE =
    HIGH_MIN_SCORE;

RecalibrationEffectiveness.MODERATE_MIN_SCORE =
    MODERATE_MIN_SCORE;

RecalibrationEffectiveness.LOW_MIN_SCORE =
    LOW_MIN_SCORE;

module.exports =
    RecalibrationEffectiveness;
