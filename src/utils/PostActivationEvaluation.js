/*
 * Evaluación post-activación de calibraciones (Entrega 2.6.1.27).
 *
 * Módulo puro (sin Sequelize ni Express), mismo estilo que
 * CalibrationEffectiveness.js (2.6.1.17)/CalibrationHealth.js (2.6.1.18):
 * no decide QUÉ predicciones entran a la evaluación ni cómo excluir
 * contaminación -- eso sigue siendo responsabilidad exclusiva de
 * CalibrationEffectivenessService (`_collectComparisons()`,
 * `simulateProposedOffset()`, ambos ya existentes desde 2.6.1.17/24 y
 * reutilizados sin cambios aquí). Este módulo solo clasifica resúmenes
 * YA calculados (ModelAccuracyMetrics.summarizeModelAccuracy()).
 *
 * Dos conceptos nuevos y DELIBERADAMENTE independientes entre sí
 * (sección 7 -- "esto no sustituye el estado de la calibración"):
 *
 *   1. classifyEvaluationStatus(sampleSize) -- ¿tenemos evidencia
 *      suficiente para hablar de "evaluación post-activación" en
 *      absoluto? NOT_ENOUGH_DATA / EVALUATING / EVALUATED. Nunca toca
 *      `MaturationModelCalibration.status` (ACTIVE/INACTIVE/...) --
 *      una calibración puede seguir ACTIVE mientras su evaluación
 *      todavía está en EVALUATING (sección 7, ejemplo explícito).
 *
 *   2. classifyPostActivationResult(current, previous) -- dado que SÍ
 *      hay evidencia suficiente, ¿la nueva calibración realmente
 *      mejoró frente a la que reemplazó? IMPROVEMENT / NO_IMPROVEMENT /
 *      INCONCLUSIVE (mapeando MEJORA/SIN MEJORA/RESULTADO INCONCLUSO
 *      del mockup de la sección 9). Sección 6, criterio explícito: "no
 *      debemos permitir que el sistema interprete una mejora
 *      basándose exclusivamente en una métrica sin mostrar el resto
 *      del contexto" -- por eso exige corroboración de al menos 2 de
 *      las 3 métricas (MAE/RMSE/|Bias|) en la MISMA dirección, sin que
 *      ninguna se mueva significativamente en la dirección contraria.
 *      Mismo patrón de "corroboración multi-señal, nunca una sola
 *      métrica" que ModelRecommendation.js (2.6.1.10) ya estableció
 *      para elegir LINEAR/EXPONENTIAL.
 */

const CalibrationEffectiveness =
    require("./CalibrationEffectiveness");

// Sección 5: "< 5 -> MUESTRA INSUFICIENTE / 5-9 -> EVALUACIÓN INICIAL /
// >= 10 -> EVALUACIÓN SIGNIFICATIVA". La propia especificación pide
// que "estos valores deben quedar configurables posteriormente" -- se
// centralizan aquí como constantes exportadas, nunca hardcodeadas en
// el servicio ni en la vista, mismo criterio que
// ModelAccuracyMetrics.MIN_SUFFICIENT_SAMPLE (2.6.1.14) y
// CalibrationHealth.MIN_RECENT_SAMPLE_SIZE (2.6.1.18).
const MIN_EVALUATING_SAMPLE = 5;

const MIN_SIGNIFICANT_SAMPLE = 10;

// Sección 6/9: reutiliza EXACTAMENTE el mismo umbral de "cambio no
// ruidoso" que CalibrationEffectiveness.js ya usa para IMPROVED/
// DEGRADED (RAW vs. CALIBRADO) -- ambos módulos responden la misma
// pregunta de fondo ("¿esta diferencia porcentual de MAE es real o es
// ruido?"), así que comparten un único número en vez de dos umbrales
// del 5% coincidentes por casualidad y divergentes si alguien ajusta
// uno sin el otro.
const IMPROVEMENT_THRESHOLD_PERCENTAGE =
    CalibrationEffectiveness.MAE_IMPROVEMENT_THRESHOLD_PERCENTAGE;

function round(value, decimals = 2) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

/*
 * % de mejora de `previousValue` -> `currentValue`, SIEMPRE sobre la
 * MAGNITUD (nunca el signo) -- lower-is-better para MAE/RMSE, y para
 * Bias se compara |Bias| (sección 9, ejemplo: "Bias se redujo 70.3%"
 * es una reducción de MAGNITUD, no un cambio de signo). Positivo =
 * mejora (el valor bajó); negativo = empeoró. null cuando falta
 * cualquiera de los dos valores o `previousValue` es 0 (no se
 * fabrica un porcentaje desde una base inexistente/perfecta -- mismo
 * criterio defensivo que CalibrationEffectiveness.computeImprovement()).
 */
function percentageChange(previousValue, currentValue) {

    if (previousValue === null || previousValue === undefined ||
        currentValue === null || currentValue === undefined) {

        return null;

    }

    const previousMagnitude =
        Math.abs(previousValue);

    const currentMagnitude =
        Math.abs(currentValue);

    if (previousMagnitude === 0) {

        return null;

    }

    return round(((previousMagnitude - currentMagnitude) / previousMagnitude) * 100, 2);

}

class PostActivationEvaluation {

    /*
     * Sección 5/7 -- mapeo directo y literal de los tres tramos de
     * muestra a los tres estados de evaluación (la propia
     * especificación los describe con los mismos tres cortes, no son
     * dos escalas independientes que coincidan por casualidad).
     */
    static classifyEvaluationStatus(sampleSize) {

        const n =
            Number(sampleSize) || 0;

        if (n < MIN_EVALUATING_SAMPLE) {

            return "NOT_ENOUGH_DATA";

        }

        if (n < MIN_SIGNIFICANT_SAMPLE) {

            return "EVALUATING";

        }

        return "EVALUATED";

    }

    /*
     * Sección 6/9/12 -- compara dos resúmenes YA calculados
     * (ModelAccuracyMetrics.summarizeModelAccuracy()) de la MISMA
     * forma de métrica (post-activación real, nunca simulación) entre
     * `current` (esta calibración) y `previous` (la que reemplazó,
     * típicamente su `parentCalibration`). Regresa `result: null`
     * (nunca "SIN_MEJORA" ni "MEJORA" fabricados) cuando falta
     * evidencia de cualquiera de los dos lados -- ver `reason`.
     */
    static classifyPostActivationResult(current, previous) {

        const currentSampleSize =
            current ? Number(current.sampleSize) || 0 : 0;

        if (currentSampleSize < MIN_EVALUATING_SAMPLE) {

            return {

                result: null,

                reason: "NOT_ENOUGH_CURRENT_DATA",

                metrics: null

            };

        }

        const previousSampleSize =
            previous ? Number(previous.sampleSize) || 0 : 0;

        if (previousSampleSize === 0) {

            return {

                result: null,

                reason: "NO_PREVIOUS_DATA",

                metrics: null

            };

        }

        const metricComparisons = {

            mae: percentageChange(previous.maeHours, current.maeHours),

            rmse: percentageChange(previous.rmseHours, current.rmseHours),

            bias: percentageChange(previous.biasHours, current.biasHours)

        };

        let improvedCount = 0;

        let worsenedCount = 0;

        for (const key of Object.keys(metricComparisons)) {

            const change =
                metricComparisons[key];

            if (change === null) continue;

            if (change > IMPROVEMENT_THRESHOLD_PERCENTAGE) improvedCount++;

            else if (change < -IMPROVEMENT_THRESHOLD_PERCENTAGE) worsenedCount++;

        }

        // Sección 6, criterio explícito: nunca una sola métrica basta.
        // Se exige mayoría (>=2 de 3) moviéndose en una dirección Y
        // NINGUNA contradiciéndola de forma significativa -- si hay
        // señales en ambas direcciones, o ninguna métrica se movió lo
        // suficiente, el resultado es INCONCLUSIVE (sección 9: "no
        // todo cambio tiene que clasificarse forzosamente como mejora
        // o degradación").
        let result;

        if (worsenedCount === 0 && improvedCount >= 2) {

            result = "IMPROVEMENT";

        } else if (improvedCount === 0 && worsenedCount >= 2) {

            result = "NO_IMPROVEMENT";

        } else {

            result = "INCONCLUSIVE";

        }

        return {

            result,

            reason: null,

            metrics: metricComparisons

        };

    }

}

PostActivationEvaluation.MIN_EVALUATING_SAMPLE =
    MIN_EVALUATING_SAMPLE;

PostActivationEvaluation.MIN_SIGNIFICANT_SAMPLE =
    MIN_SIGNIFICANT_SAMPLE;

PostActivationEvaluation.IMPROVEMENT_THRESHOLD_PERCENTAGE =
    IMPROVEMENT_THRESHOLD_PERCENTAGE;

module.exports =
    PostActivationEvaluation;
