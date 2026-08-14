/*
 * Evaluación y priorización de propuestas de recalibración (Entrega
 * 2.6.1.30).
 *
 * Módulo puro (sin Sequelize ni Express), mismo estilo que
 * `DegradationDetection.js` (2.6.1.28)/`PostActivationEvaluation.js`
 * (2.6.1.27): no decide QUÉ predicciones usar ni cómo simular el
 * offset propuesto -- eso sigue siendo responsabilidad exclusiva de
 * `CalibrationEffectivenessService.simulateProposedOffsetWithPairs()`
 * (2.6.1.30, nuevo). Este módulo solo puntúa y explica un resultado ya
 * calculado.
 *
 * A diferencia de `ModelRecommendation.js` (2.6.1.10, un árbol de
 * reglas explícito que la propia especificación de esa entrega prohibía
 * convertir en un score ponderado), ESTA especificación sí pide un
 * "Proposal Score" numérico 0-100 mostrado al usuario (sección 10:
 * "Score: 87/100"), aclarando en la misma sección que NO espera ver la
 * fórmula exacta ("no recomiendo mostrar... una fórmula matemática
 * compleja") -- es decir, los pesos y puntos de saturación de abajo son
 * un diseño propio de esta implementación, no una fórmula literal del
 * spec, documentado aquí con el mismo nivel de detalle que cualquier
 * otro judgment call de esta arquitectura. Los DOS factores con fórmula
 * SÍ literal (secciones 5/6 -- mejora de MAE/RMSE) se implementan
 * exactamente como se especifican; todo lo demás (saturaciones, pesos,
 * umbrales de recomendación) es deliberado y configurable, ajustado
 * para reproducir CUALITATIVAMENTE (nunca se buscó una coincidencia
 * exacta de dígito) los dos ejemplos de la especificación: el caso
 * ALTA de las secciones 1/11 (n=24, MAE 31.4%, RMSE 24.8%, Bias 67.2%,
 * consistencia 21/24, ajuste +18%) cae en ~88/100 (HIGH); el caso BAJA
 * de la sección 12 (MAE 8.2%, RMSE empeora, Bias aumenta, n=11,
 * consistencia 3/11) cae en ~17/100 (LOW).
 */

// Sección 4: "estos rangos deben ser configurables, no valores rígidos
// dentro del código" -- constantes exportadas, nunca hardcodeadas en
// el servicio ni en la vista.
const MIN_LIMITED_SAMPLE = 10;

const MIN_MODERATE_SAMPLE = 15;

const MIN_HIGH_SAMPLE = 25;

const SAMPLE_TIER_SCORES = {

    INSUFFICIENT: 0,

    LIMITED: 40,

    MODERATE: 70,

    HIGH: 100

};

// Puntos de "mejora que ya cuenta como máxima" para cada métrica --
// ver el comentario del encabezado sobre cómo se eligieron (ajuste
// deliberado para que el ejemplo ALTA de la sección 1/11 caiga
// naturalmente en la banda HIGH sin forzar el resultado).
const SATURATION_MAE_IMPROVEMENT_PERCENTAGE = 35;

const SATURATION_RMSE_IMPROVEMENT_PERCENTAGE = 30;

const SATURATION_BIAS_IMPROVEMENT_PERCENTAGE = 40;

// Pesos del score compuesto -- suman 100 antes de aplicar la
// penalización por magnitud del ajuste (que resta, nunca suma, sección
// 9: "deberá disminuir la confianza").
const WEIGHT_MAE = 30;

const WEIGHT_RMSE = 20;

const WEIGHT_BIAS = 20;

const WEIGHT_CONSISTENCY = 20;

const WEIGHT_SAMPLE = 10;

// Sección 9 -- cualquier cambio relativo del offset por encima de este
// umbral genera SIEMPRE una advertencia explicativa (aunque no
// necesariamente una penalización fuerte al score -- ver el ejemplo de
// la sección 11, "+18%", que sigue siendo ALTA/87 con esa misma
// advertencia presente).
const MAGNITUDE_WARNING_THRESHOLD_PERCENTAGE = 15;

// Penalización por magnitud del ajuste, en tramos (sección 9: "0.8h ->
// 1.0h" es un cambio pequeño que no debería penalizar; "0.8h -> 4.5h"
// "requiere mayor precaución"). Nunca un valor fijo -- escalona con la
// magnitud del cambio relativo.
const MAGNITUDE_PENALTY_TIERS = [

    { minChangePercentage: 100, penalty: 15 },

    { minChangePercentage: 50, penalty: 10 },

    { minChangePercentage: 20, penalty: 5 },

    { minChangePercentage: 0, penalty: 0 }

];

// Cuando el offset actual es (casi) cero, un cambio relativo no tiene
// sentido (división por ~0) -- se usa esta referencia absoluta en horas
// en su lugar (sección 9 nunca contempla explícitamente este caso, es
// un judgment call defensivo).
const SMALL_OFFSET_REFERENCE_HOURS = 1;

const NEAR_ZERO_OFFSET_HOURS = 0.1;

// Sección 3 -- umbrales del score compuesto a la recomendación final.
const HIGH_MIN_SCORE = 75;

const MEDIUM_MIN_SCORE = 50;

function round(value, decimals = 2) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

function hasValue(value) {

    return value !== null && value !== undefined && Number.isFinite(Number(value));

}

function clamp(value, min, max) {

    return Math.min(max, Math.max(min, value));

}

class ProposalScoring {

    /*
     * Sección 5 -- fórmula LITERAL del spec: mejoraMAE = (MAE_actual -
     * MAE_propuesto) / MAE_actual. Reproduce el ejemplo exacto (2.50h
     * -> 1.75h = 30%). MAE/RMSE son siempre >= 0, así que esta fórmula
     * ya es equivalente a una comparación por magnitud -- a diferencia
     * de Bias (ver `computeBiasImprovementPercentage()` abajo), no
     * necesita ningún tratamiento especial de signo.
     */
    static computeMaeImprovementPercentage(maeActualHours, maeProposedHours) {

        if (!hasValue(maeActualHours) || !hasValue(maeProposedHours) || Number(maeActualHours) <= 0) {

            return null;

        }

        return round(((Number(maeActualHours) - Number(maeProposedHours)) / Number(maeActualHours)) * 100, 2);

    }

    /*
     * Sección 6 -- misma fórmula, aplicada a RMSE ("de manera
     * equivalente").
     */
    static computeRmseImprovementPercentage(rmseActualHours, rmseProposedHours) {

        if (!hasValue(rmseActualHours) || !hasValue(rmseProposedHours) || Number(rmseActualHours) <= 0) {

            return null;

        }

        return round(((Number(rmseActualHours) - Number(rmseProposedHours)) / Number(rmseActualHours)) * 100, 2);

    }

    /*
     * Sección 7 -- a diferencia de MAE/RMSE, el Bias tiene signo, y lo
     * que importa es su MAGNITUD (mismo criterio que
     * `PostActivationEvaluation.percentageChange()`, 2.6.1.27, aplicado
     * de forma independiente aquí -- ver el comentario de esa función
     * para el porqué: "Bias se redujo 70.3%" es una reducción de
     * MAGNITUD, no un cambio de signo). El ejemplo de la sección 7
     * (ACTUAL +0.3h -> PROPUESTA -1.1h) debe salir NEGATIVO (empeoró),
     * aunque el signo haya cambiado -- |−1.1| > |0.3|. Caso especial:
     * si el Bias actual ya es exactamente 0 (perfecto) y la propuesta
     * introduce cualquier bias distinto de 0, se reporta -100 (empeoró
     * al máximo) en vez de fabricar una división por cero.
     */
    static computeBiasImprovementPercentage(biasActualHours, biasProposedHours) {

        if (!hasValue(biasActualHours) || !hasValue(biasProposedHours)) {

            return null;

        }

        const actualMagnitude =
            Math.abs(Number(biasActualHours));

        const proposedMagnitude =
            Math.abs(Number(biasProposedHours));

        if (actualMagnitude === 0) {

            return proposedMagnitude === 0 ? 0 : -100;

        }

        return round(((actualMagnitude - proposedMagnitude) / actualMagnitude) * 100, 2);

    }

    /*
     * Sección 4 -- tamaño de muestra como señal de confianza,
     * independiente de qué tan grande sea la mejora reportada (el
     * propio ejemplo de la sección: "MAE -40%, n=10" no debe recibir
     * automáticamente la misma recomendación que "MAE -40%, n=40").
     */
    static classifySampleConfidence(sampleSize) {

        const n =
            Number(sampleSize) || 0;

        if (n >= MIN_HIGH_SAMPLE) {

            return { tier: "HIGH", confidenceScore: SAMPLE_TIER_SCORES.HIGH };

        }

        if (n >= MIN_MODERATE_SAMPLE) {

            return { tier: "MODERATE", confidenceScore: SAMPLE_TIER_SCORES.MODERATE };

        }

        if (n >= MIN_LIMITED_SAMPLE) {

            return { tier: "LIMITED", confidenceScore: SAMPLE_TIER_SCORES.LIMITED };

        }

        return { tier: "INSUFFICIENT", confidenceScore: SAMPLE_TIER_SCORES.INSUFFICIENT };

    }

    /*
     * Sección 8 -- "debe evaluar si la mejora aparece de manera
     * relativamente consistente en la muestra", comparando POR
     * PREDICCIÓN (no en agregado) el error simulado contra el error
     * real. `pairs` viene de
     * `CalibrationEffectivenessService.simulateProposedOffsetWithPairs()`
     * (2.6.1.30) -- ambos lados ya comparten la misma muestra por
     * construcción. "Mejoró" = |error simulado| < |error actual|;
     * "empeoró" = lo contrario; un empate exacto no cuenta para
     * ninguno de los dos (ninguno de los ejemplos del spec lo
     * contempla, pero descartarlo del numerador evita fabricar una
     * dirección donde no la hay).
     */
    static computeConsistency(pairs) {

        const list =
            Array.isArray(pairs) ? pairs : [];

        let improvedCount = 0;

        let worsenedCount = 0;

        let unchangedCount = 0;

        for (const pair of list) {

            const actualAbs =
                Math.abs(Number(pair.actualErrorHours));

            const simulatedAbs =
                Math.abs(Number(pair.simulatedErrorHours));

            if (simulatedAbs < actualAbs) {

                improvedCount++;

            } else if (simulatedAbs > actualAbs) {

                worsenedCount++;

            } else {

                unchangedCount++;

            }

        }

        const totalCount =
            list.length;

        return {

            improvedCount,

            worsenedCount,

            unchangedCount,

            totalCount,

            consistencyPercentage: totalCount > 0 ? round((improvedCount / totalCount) * 100, 2) : null

        };

    }

    /*
     * Sección 9 -- magnitud relativa del cambio de offset. Cuando el
     * offset actual es (casi) cero, se usa una referencia absoluta en
     * horas en vez de dividir por un número cercano a cero (judgment
     * call defensivo, no contemplado explícitamente por el spec).
     */
    static computeAdjustmentMagnitude(currentOffsetHours, proposedOffsetHours) {

        if (!hasValue(currentOffsetHours) || !hasValue(proposedOffsetHours)) {

            return { changePercentage: null, isSignificant: false, penaltyPoints: 0 };

        }

        const current =
            Number(currentOffsetHours);

        const proposed =
            Number(proposedOffsetHours);

        let changePercentage;

        if (Math.abs(current) >= NEAR_ZERO_OFFSET_HOURS) {

            changePercentage = round((Math.abs(proposed - current) / Math.abs(current)) * 100, 2);

        } else {

            changePercentage = round((Math.abs(proposed - current) / SMALL_OFFSET_REFERENCE_HOURS) * 100, 2);

        }

        let penaltyPoints =
            0;

        for (const tier of MAGNITUDE_PENALTY_TIERS) {

            if (changePercentage >= tier.minChangePercentage) {

                penaltyPoints = tier.penalty;

                break;

            }

        }

        return {

            changePercentage,

            isSignificant: changePercentage > MAGNITUDE_WARNING_THRESHOLD_PERCENTAGE,

            penaltyPoints,

            direction: proposed > current ? "mayor" : "menor"

        };

    }

    /*
     * Sección 10 -- score compuesto 0-100. Cada factor contribuye una
     * sub-puntuación 0-100 (saturando en el punto correspondiente,
     * nunca penalizando por debajo de 0 -- una mejora negativa
     * simplemente no aporta nada, no resta aquí; el Bias/RMSE que
     * empeoran sí generan advertencias explícitas, ver
     * `buildExplanation()`), ponderada por los pesos de arriba (suman
     * 100), y luego se resta la penalización por magnitud del ajuste.
     */
    static computeScore({ sampleTierScore, maeImprovementPercentage, rmseImprovementPercentage, biasImprovementPercentage, consistencyPercentage, magnitudePenaltyPoints }) {

        const maeSubScore =
            hasValue(maeImprovementPercentage) ? clamp((maeImprovementPercentage / SATURATION_MAE_IMPROVEMENT_PERCENTAGE) * 100, 0, 100) : 0;

        const rmseSubScore =
            hasValue(rmseImprovementPercentage) ? clamp((rmseImprovementPercentage / SATURATION_RMSE_IMPROVEMENT_PERCENTAGE) * 100, 0, 100) : 0;

        const biasSubScore =
            hasValue(biasImprovementPercentage) ? clamp((biasImprovementPercentage / SATURATION_BIAS_IMPROVEMENT_PERCENTAGE) * 100, 0, 100) : 0;

        const consistencySubScore =
            hasValue(consistencyPercentage) ? clamp(consistencyPercentage, 0, 100) : 0;

        const sampleSubScore =
            hasValue(sampleTierScore) ? sampleTierScore : 0;

        const weightedSum =

            (maeSubScore * WEIGHT_MAE +
                rmseSubScore * WEIGHT_RMSE +
                biasSubScore * WEIGHT_BIAS +
                consistencySubScore * WEIGHT_CONSISTENCY +
                sampleSubScore * WEIGHT_SAMPLE) / 100;

        const penalized =
            weightedSum - (magnitudePenaltyPoints || 0);

        return Math.round(clamp(penalized, 0, 100));

    }

    /*
     * Sección 3 -- LOW/MEDIUM/HIGH a partir del score compuesto. Un
     * tamaño de muestra INSUFICIENTE (< 10) siempre topa la
     * recomendación en LOW, sin importar el score -- ninguna cantidad
     * de mejora aparente compensa no tener evidencia suficiente
     * (sección 4, mismo espíritu que el resto de "avoid false
     * precision" de este proyecto).
     */
    static classifyRecommendation(score, sampleTier) {

        if (sampleTier === "INSUFFICIENT") {

            return "LOW";

        }

        if (score >= HIGH_MIN_SCORE) {

            return "HIGH";

        }

        if (score >= MEDIUM_MIN_SCORE) {

            return "MEDIUM";

        }

        return "LOW";

    }

    /*
     * Secciones 11/12 -- "la recomendación no debe ser una caja negra".
     * Devuelve datos estructurados (nunca HTML), en el mismo espíritu
     * que `ModelRecommendation.js` (2.6.1.10) -- el backend redacta el
     * texto en español, el frontend solo lo pinta.
     */
    static buildExplanation({ sampleSize, sampleTier, maeImprovementPercentage, rmseImprovementPercentage, biasImprovementPercentage, consistency, adjustmentMagnitude }) {

        const positives =
            [];

        const warnings =
            [];

        if (hasValue(maeImprovementPercentage) && maeImprovementPercentage > 0) {

            positives.push(`MAE mejora ${maeImprovementPercentage}%.`);

        } else if (hasValue(maeImprovementPercentage)) {

            warnings.push(`El MAE no mejora (${maeImprovementPercentage}%).`);

        }

        if (hasValue(rmseImprovementPercentage) && rmseImprovementPercentage > 0) {

            positives.push(`RMSE mejora ${rmseImprovementPercentage}%.`);

        } else if (hasValue(rmseImprovementPercentage) && rmseImprovementPercentage < 0) {

            warnings.push(`RMSE empeora ${Math.abs(rmseImprovementPercentage)}%.`);

        }

        if (hasValue(biasImprovementPercentage) && biasImprovementPercentage > 0) {

            positives.push(`Bias se reduce ${biasImprovementPercentage}%.`);

        } else if (hasValue(biasImprovementPercentage) && biasImprovementPercentage < 0) {

            warnings.push("Bias aumenta.");

        }

        if (consistency && consistency.totalCount > 0) {

            positives.push(`${consistency.improvedCount} de ${consistency.totalCount} predicciones mejoran.`);

            if (consistency.consistencyPercentage < 50) {

                warnings.push(`La mejora se concentra en solo ${consistency.improvedCount} de ${consistency.totalCount} predicciones.`);

            }

        }

        positives.push(`Tamaño de muestra: ${sampleSize}.`);

        if (sampleTier === "LIMITED") {

            warnings.push(`Tamaño de muestra limitado (${sampleSize} predicciones) -- confianza moderada/limitada.`);

        } else if (sampleTier === "INSUFFICIENT") {

            warnings.push(`Muestra insuficiente para una evaluación confiable (${sampleSize} predicciones).`);

        }

        if (adjustmentMagnitude && adjustmentMagnitude.isSignificant) {

            warnings.push(`El ajuste propuesto es ${adjustmentMagnitude.changePercentage}% ${adjustmentMagnitude.direction} que el offset actual.`);

        }

        return { positives, warnings };

    }

    /*
     * Punto de entrada único -- junta todo lo de arriba en un solo
     * resultado, mismo estilo "orquestador" que
     * `CalibrationEffectiveness.buildEvaluation()` (2.6.1.17)/
     * `CalibrationHealth.buildHealthReport()` (2.6.1.18).
     */
    static evaluateProposal({

        sampleSize,

        maeActualHours,

        maeProposedHours,

        rmseActualHours,

        rmseProposedHours,

        biasActualHours,

        biasProposedHours,

        pairs,

        currentOffsetHours,

        proposedOffsetHours

    }) {

        const { tier: sampleTier, confidenceScore: sampleTierScore } =
            this.classifySampleConfidence(sampleSize);

        const maeImprovementPercentage =
            this.computeMaeImprovementPercentage(maeActualHours, maeProposedHours);

        const rmseImprovementPercentage =
            this.computeRmseImprovementPercentage(rmseActualHours, rmseProposedHours);

        const biasImprovementPercentage =
            this.computeBiasImprovementPercentage(biasActualHours, biasProposedHours);

        const consistency =
            this.computeConsistency(pairs);

        const adjustmentMagnitude =
            this.computeAdjustmentMagnitude(currentOffsetHours, proposedOffsetHours);

        const score =
            this.computeScore({

                sampleTierScore,

                maeImprovementPercentage,

                rmseImprovementPercentage,

                biasImprovementPercentage,

                consistencyPercentage: consistency.consistencyPercentage,

                magnitudePenaltyPoints: adjustmentMagnitude.penaltyPoints

            });

        const recommendation =
            this.classifyRecommendation(score, sampleTier);

        const explanation =
            this.buildExplanation({

                sampleSize,

                sampleTier,

                maeImprovementPercentage,

                rmseImprovementPercentage,

                biasImprovementPercentage,

                consistency,

                adjustmentMagnitude

            });

        return {

            sampleSize,

            sampleTier,

            maeImprovementPercentage,

            rmseImprovementPercentage,

            biasImprovementPercentage,

            consistency,

            adjustmentMagnitude,

            score,

            recommendation,

            explanation

        };

    }

}

ProposalScoring.MIN_LIMITED_SAMPLE = MIN_LIMITED_SAMPLE;
ProposalScoring.MIN_MODERATE_SAMPLE = MIN_MODERATE_SAMPLE;
ProposalScoring.MIN_HIGH_SAMPLE = MIN_HIGH_SAMPLE;
ProposalScoring.SAMPLE_TIER_SCORES = SAMPLE_TIER_SCORES;
ProposalScoring.SATURATION_MAE_IMPROVEMENT_PERCENTAGE = SATURATION_MAE_IMPROVEMENT_PERCENTAGE;
ProposalScoring.SATURATION_RMSE_IMPROVEMENT_PERCENTAGE = SATURATION_RMSE_IMPROVEMENT_PERCENTAGE;
ProposalScoring.SATURATION_BIAS_IMPROVEMENT_PERCENTAGE = SATURATION_BIAS_IMPROVEMENT_PERCENTAGE;
ProposalScoring.MAGNITUDE_WARNING_THRESHOLD_PERCENTAGE = MAGNITUDE_WARNING_THRESHOLD_PERCENTAGE;
ProposalScoring.HIGH_MIN_SCORE = HIGH_MIN_SCORE;
ProposalScoring.MEDIUM_MIN_SCORE = MEDIUM_MIN_SCORE;

module.exports =
    ProposalScoring;
