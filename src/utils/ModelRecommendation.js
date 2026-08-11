/*
 * Motor de recomendación de modelo (Entrega 2.6.1.10).
 *
 * Módulo puro (sin Sequelize/Express) que consolida tres niveles de
 * evaluación ya construidos en entregas anteriores —desempeño
 * histórico (2.6.1.7, vía ModelComparison.js), capacidad de
 * generalización (2.6.1.8, vía TemporalValidation.js) y estabilidad
 * temporal por ventanas (TemporalStability.js, diseñado en esta misma
 * entrega — ver su cabecera para el porqué)— en una única
 * recomendación LINEAR | EXPONENTIAL | NO_DECISION, con un nivel de
 * confianza HIGH | MEDIUM | LOW y las razones (texto ya generado en
 * Español, en el backend) que la sustentan.
 *
 * Deliberadamente NO es un score ponderado (sección 7 de la
 * especificación: "esos pesos serían arbitrarios"). Es un árbol de
 * reglas transparente y explicable, en este orden de prioridad:
 *
 *   Regla 1 (datos insuficientes) — si no hay suficiente información
 *   para ejecutar la validación temporal (2.6.1.8), NO_DECISION.
 *
 *   Regla 2 (resultados similares) — si el error de VALIDACIÓN de
 *   ambos modelos es demasiado parecido (mismo umbral relativo que
 *   determineBestModel() en 2.6.1.7, SIMILARITY_THRESHOLD_RELATIVE),
 *   NO_DECISION. No tiene sentido preferir un modelo por una diferencia
 *   que bien podría ser ruido.
 *
 *   Regla 3 (la validación pesa más que lo histórico) — el modelo
 *   candidato es SIEMPRE el de menor MAE de VALIDACIÓN, nunca el de
 *   menor MAE histórico — porque el objetivo real es predecir lotes
 *   futuros, no explicar mejor los lotes ya conocidos. El desempeño
 *   histórico solo puede sumar o restar confianza al candidato ya
 *   elegido por validación, nunca reemplazarlo.
 *
 *   Regla 4 (estabilidad) — un candidato que gana en MAE de validación
 *   pero pierde la mayoría de las ventanas temporales Y tiene una
 *   variabilidad mucho mayor que el otro modelo, NO se acepta
 *   automáticamente: si AMBAS señales de estabilidad contradicen al
 *   candidato, el resultado se degrada a NO_DECISION (evidencia
 *   internamente contradictoria); si solo UNA de las dos contradice, se
 *   acepta el candidato pero con confianza LOW.
 *
 * La confianza HIGH exige, además de un margen de validación real
 * (>= SIGNIFICANT_VALIDATION_IMPROVEMENT), que TODAS las señales
 * disponibles corroboren al candidato: mayoría de ventanas ganadas,
 * variabilidad no peor que la del otro modelo, y que lo histórico no
 * lo contradiga — un solo número grande de MAE nunca basta por sí solo
 * para HIGH (sección 2 de la especificación: "no elegir únicamente por
 * MAE").
 */

const {
    determineBestModel,
    SIMILARITY_THRESHOLD_RELATIVE
} = require("./ModelComparison");

// Margen relativo de MAE de validación por encima del cual la ventaja
// del candidato se considera "real" (no solo ruido) y, junto con el
// resto de la corroboración de la Regla 4, puede alcanzar confianza
// HIGH. Es el mismo umbral conceptual "mejora relativa moderada" que
// MIN_SIGNIFICANT_MAE_IMPROVEMENT usa en MaturationStatistics.js/
// ModelComparison.js (0.20) — reexpresado aquí porque esos módulos no
// lo exportan (son constantes internas de cada uno, mismo patrón que ya
// existe en este proyecto: cada módulo define su propio umbral en vez
// de compartir uno global).
const SIGNIFICANT_VALIDATION_IMPROVEMENT = 0.20;

// Cuánto más variable (desviación estándar del MAE entre ventanas)
// puede ser el candidato que el otro modelo antes de considerarse "una
// variabilidad mucho mayor" (Regla 4). Provisional, como todos los
// umbrales de "evitar falsa precisión" de este proyecto.
const HIGH_VARIABILITY_RELATIVE_MARGIN = 0.5;

function pickByModel(model, linearValue, exponentialValue) {

    return model === "LINEAR" ? linearValue : exponentialValue;
}

function otherModel(model) {

    return model === "LINEAR" ? "EXPONENTIAL" : "LINEAR";
}

function noDecision(reasons) {

    return {

        model: null,

        confidence: "LOW",

        status: "NO_DECISION",

        reasons

    };

}

/*
 * Punto de entrada principal. Espera:
 *
 *   historical: { linear, exponential } — resúmenes de
 *     summarizeModelErrors()/aggregateErrors() (necesitan .maeHours y
 *     .count) sobre TODO el conjunto evaluable (2.6.1.7).
 *
 *   validation: resultado de buildTemporalValidation() (2.6.1.8) — se
 *     usa validation.insufficientData, validation.linear.validation.maeHours
 *     y validation.exponential.validation.maeHours.
 *
 *   stability: resultado de summarizeWindowStability() (nuevo en esta
 *     entrega) — se usa stability.sufficientData, *Wins y *MaeStdDev.
 *
 * Regresa { model, confidence, status, reasons }.
 */
function buildRecommendation({ historical, validation, stability }) {

    // Regla 1: sin validación temporal confiable, no hay base para recomendar.
    if (!validation || validation.insufficientData) {

        return noDecision([
            "Datos insuficientes para realizar una validación temporal confiable."
        ]);

    }

    const linearValMae =
        validation.linear ? validation.linear.validation.maeHours : null;

    const exponentialValMae =
        validation.exponential ? validation.exponential.validation.maeHours : null;

    if (linearValMae === null || exponentialValMae === null) {

        return noDecision([
            "Datos insuficientes para comparar el error de validación de ambos modelos."
        ]);

    }

    const worseValMae =
        Math.max(linearValMae, exponentialValMae);

    const relativeDiff =
        worseValMae === 0 ? 0 : Math.abs(linearValMae - exponentialValMae) / worseValMae;

    // Regla 2: diferencia de validación demasiado pequeña para preferir un modelo.
    if (relativeDiff < SIMILARITY_THRESHOLD_RELATIVE) {

        return noDecision([
            "La diferencia de error entre LINEAR y EXPONENTIAL en validación es demasiado pequeña para preferir un modelo."
        ]);

    }

    // Regla 3: el candidato es SIEMPRE el de menor MAE de validación.
    const candidate =
        linearValMae < exponentialValMae ? "LINEAR" : "EXPONENTIAL";

    const other =
        otherModel(candidate);

    const reasons =
        [`${candidate} obtuvo menor MAE en validación.`];

    const stabilityOk =
        stability && stability.sufficientData;

    const candidateWins =
        stabilityOk ? pickByModel(candidate, stability.linearWins, stability.exponentialWins) : null;

    const otherWins =
        stabilityOk ? pickByModel(other, stability.linearWins, stability.exponentialWins) : null;

    const candidateStdDev =
        stabilityOk ? pickByModel(candidate, stability.linearMaeStdDev, stability.exponentialMaeStdDev) : null;

    const otherStdDev =
        stabilityOk ? pickByModel(other, stability.linearMaeStdDev, stability.exponentialMaeStdDev) : null;

    const windowsFavorCandidate =
        stabilityOk && candidateWins > otherWins;

    const windowsContradictCandidate =
        stabilityOk && otherWins > candidateWins;

    const varianceKnown =
        stabilityOk && candidateStdDev !== null && otherStdDev !== null;

    const varianceContradictsCandidate =
        varianceKnown && candidateStdDev > otherStdDev * (1 + HIGH_VARIABILITY_RELATIVE_MARGIN);

    const varianceFavorsCandidate =
        varianceKnown && candidateStdDev <= otherStdDev;

    // Regla 4 (contradicción dura): las dos señales de estabilidad
    // contradicen al candidato a la vez -> la evidencia es internamente
    // inconsistente, no forzamos una recomendación.
    if (windowsContradictCandidate && varianceContradictsCandidate) {

        return noDecision([

            `${candidate} obtuvo menor MAE en validación, pero las ventanas temporales y la variabilidad del error no son consistentes con ese resultado.`,

            `${other} ganó más ventanas temporales y ${candidate} presentó mayor variabilidad del error.`

        ]);

    }

    if (windowsFavorCandidate) {

        reasons.push(`${candidate} obtuvo más victorias en validación temporal.`);

    }

    if (varianceFavorsCandidate) {

        reasons.push(`${candidate} presentó menor variabilidad del error.`);

    }

    // Histórico (2.6.1.7): reutilizado como señal secundaria — puede
    // sumar o restar confianza, pero por la Regla 3 nunca reemplaza al
    // candidato elegido por validación.
    const historicalComparison =
        historical && historical.linear && historical.exponential
            ? determineBestModel(historical.linear, historical.exponential)
            : { bestModel: null };

    const historicalAgrees =
        historicalComparison.bestModel === candidate;

    const historicalDisagrees =
        historicalComparison.bestModel !== null &&
        historicalComparison.bestModel !== "SIMILAR" &&
        historicalComparison.bestModel !== candidate;

    if (historicalAgrees) {

        reasons.push(`${candidate} también tuvo menor MAE histórico.`);

    }

    let confidence;

    if (

        relativeDiff >= SIGNIFICANT_VALIDATION_IMPROVEMENT &&
        windowsFavorCandidate &&
        !varianceContradictsCandidate &&
        !historicalDisagrees

    ) {

        confidence = "HIGH";

    } else if (windowsContradictCandidate || varianceContradictsCandidate) {

        // Regla 4 (contradicción suave): solo una de las dos señales de
        // estabilidad contradice al candidato -> se acepta, pero con
        // confianza baja.
        confidence = "LOW";

        if (windowsContradictCandidate) {

            reasons.push(`${other} ganó más ventanas temporales, lo que reduce la confianza de esta recomendación.`);

        }

        if (varianceContradictsCandidate) {

            reasons.push(`${candidate} presentó mayor variabilidad del error, lo que reduce la confianza de esta recomendación.`);

        }

    } else {

        confidence = "MEDIUM";

        if (relativeDiff >= SIGNIFICANT_VALIDATION_IMPROVEMENT && !stabilityOk) {

            reasons.push("Todavía no hay suficientes lotes para evaluar la estabilidad temporal por ventanas.");

        }

        if (historicalDisagrees) {

            reasons.push(`El desempeño histórico general favorece a ${historicalComparison.bestModel}, pero el desempeño en validación (que tiene mayor peso) favorece a ${candidate}.`);

        }

    }

    return {

        model: candidate,

        confidence,

        status: "RECOMMENDED",

        reasons

    };

}

module.exports = {

    SIGNIFICANT_VALIDATION_IMPROVEMENT,

    HIGH_VARIABILITY_RELATIVE_MARGIN,

    buildRecommendation

};
