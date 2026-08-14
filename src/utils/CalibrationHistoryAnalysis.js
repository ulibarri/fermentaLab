/*
 * Historial de evolución del modelo (Entrega 2.6.1.31).
 *
 * Módulo puro (sin Sequelize ni Express), mismo estilo que
 * PostActivationEvaluation.js (2.6.1.27)/DegradationDetection.js
 * (2.6.1.28): no decide QUÉ predicciones ni QUÉ evaluaciones entran al
 * cálculo -- eso es responsabilidad de CalibrationHistoryService. Este
 * módulo solo clasifica/compara resúmenes YA calculados.
 *
 * Deliberadamente NO reimplementa ningún cálculo que ya exista en otro
 * módulo (sección 3 de 2.6.1.29, "no se implementará un nuevo
 * algoritmo", el mismo principio se sigue aquí aunque esta entrega no
 * lo repita explícitamente):
 *
 *   - "Nivel de evidencia" (sección 10, < 5 / 5-9 / >= 10) es
 *     EXACTAMENTE el mismo corte que `PostActivationEvaluation.
 *     classifyEvaluationStatus()` (2.6.1.27) ya usa -- se reutiliza esa
 *     función tal cual, solo se traduce su resultado al vocabulario
 *     propio de esta entrega (INSUFICIENTE/INICIAL/SIGNIFICATIVA en vez
 *     de NOT_ENOUGH_DATA/EVALUATING/EVALUATED).
 *   - "Comparación entre versiones consecutivas" (secciones 5/7, "v4 ->
 *     v5" / "v3 -> v4 empeoró") reutiliza `PostActivationEvaluation.
 *     classifyPostActivationResult()` (2.6.1.27) sin cambios -- exige
 *     corroboración de al menos 2 de 3 métricas (MAE/RMSE/|Bias|) antes
 *     de declarar mejora o degradación, el mismo criterio que ya se usa
 *     para "¿la calibración activa superó a la que reemplazó?". Aquí
 *     simplemente se aplica una vez por cada par de versiones
 *     consecutivas de la cadena, no solo entre la activa y su padre.
 *   - "Mejora acumulada desde la primera calibración" (sección 6)
 *     reutiliza `ProposalScoring.computeMaeImprovementPercentage()`/
 *     `computeRmseImprovementPercentage()`/`computeBiasImprovementPercentage()`
 *     (2.6.1.30) -- la misma fórmula de "% de mejora" (magnitud para
 *     Bias), aplicada entre v1 y la versión actual en vez de entre
 *     ACTUAL y PROPUESTA.
 *
 * Lo único genuinamente nuevo en este módulo es `computeActiveDuration()`
 * (sección 8, "tiempo activo") -- no existía ningún cálculo de duración
 * en el codebase hasta esta entrega.
 */

const PostActivationEvaluation =
    require("./PostActivationEvaluation");

const ProposalScoring =
    require("./ProposalScoring");

const DAY_MS =
    24 * 60 * 60 * 1000;

function round(value, decimals = 2) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

// Sección 10 -- traducción del vocabulario interno de
// PostActivationEvaluation (2.6.1.27) al vocabulario literal de esta
// entrega. Los CORTES numéricos (5/10) NUNCA se redefinen aquí -- viven
// en un solo lugar (PostActivationEvaluation.MIN_EVALUATING_SAMPLE/
// MIN_SIGNIFICANT_SAMPLE), reexportados abajo solo para que un caller
// de este módulo no necesite conocer el módulo de 2.6.1.27 también.
const EVIDENCE_LABELS = {

    NOT_ENOUGH_DATA: { code: "INSUFFICIENT", label: "INSUFICIENTE" },

    EVALUATING: { code: "INITIAL", label: "INICIAL" },

    EVALUATED: { code: "SIGNIFICANT", label: "SIGNIFICATIVA" }

};

// Sección 7 -- traducción de los tres resultados de
// classifyPostActivationResult() al vocabulario de esta entrega
// ("DEGRADACIÓN" es el término literal del spec; el codebase ya usaba
// "NO_IMPROVEMENT" con el mismo significado operativo: al menos 2 de 3
// métricas empeoraron de forma no ruidosa, sin ninguna mejora
// significativa que lo contradiga).
const COMPARISON_LABELS = {

    IMPROVEMENT: { code: "IMPROVED", label: "MEJORA" },

    NO_IMPROVEMENT: { code: "DEGRADED", label: "DEGRADACIÓN" },

    INCONCLUSIVE: { code: "INCONCLUSIVE", label: "INCONCLUSO" }

};

class CalibrationHistoryAnalysis {

    /*
     * Sección 10 -- nivel de evidencia a partir del número de
     * predicciones REALMENTE evaluadas (con resultado real ya
     * disponible), nunca del tamaño de muestra congelado en una
     * evaluación almacenada que pudo haberse calculado hace tiempo (ver
     * el comentario de CalibrationHistoryService sobre por qué el
     * conteo de evaluadas siempre se vuelve a contar en vivo mientras
     * que MAE/RMSE/Bias nunca se recalculan).
     */
    static classifyEvidenceLevel(evaluatedCount) {

        const statusCode =
            PostActivationEvaluation.classifyEvaluationStatus(evaluatedCount);

        return EVIDENCE_LABELS[statusCode] || { code: "INSUFFICIENT", label: "INSUFICIENTE" };

    }

    /*
     * Secciones 5/7 -- compara dos versiones CONSECUTIVAS de la cadena
     * (por número de `version`, nunca recorriendo `parentCalibrationId`
     * como grafo -- mismo criterio que `findVersionChain()`,
     * 2.6.1.19). `previousMetrics`/`currentMetrics` son
     * {sampleSize, maeHours, rmseHours, biasHours} o null si esa
     * versión no tiene ninguna evaluación almacenada todavía (sección
     * 13 -- nunca se fabrica una comparación con datos que no existen).
     */
    static compareConsecutiveVersions(previousMetrics, currentMetrics) {

        if (!previousMetrics || !currentMetrics) {

            return {

                result: null,

                resultLabel: null,

                reason: !currentMetrics ? "NO_CURRENT_EVALUATION" : "NO_PREVIOUS_EVALUATION",

                metrics: null

            };

        }

        const classification =
            PostActivationEvaluation.classifyPostActivationResult(currentMetrics, previousMetrics);

        if (!classification.result) {

            return {

                result: null,

                resultLabel: null,

                reason: classification.reason,

                metrics: null

            };

        }

        const labels =
            COMPARISON_LABELS[classification.result] || { code: classification.result, label: classification.result };

        return {

            result: labels.code,

            resultLabel: labels.label,

            reason: null,

            metrics: classification.metrics

        };

    }

    /*
     * Sección 6 -- mejora acumulada desde la PRIMERA calibración de la
     * cadena (v1) hasta la versión "actual" (la ACTIVE, o la más
     * reciente si ninguna lo está -- ver CalibrationHistoryService).
     * Reutiliza las mismas fórmulas de ProposalScoring (2.6.1.30), solo
     * que aquí "actual"/"propuesto" del nombre de esas funciones
     * corresponden a "primera calibración"/"calibración actual" -- la
     * fórmula es idéntica, matemáticamente "% de mejora entre un valor
     * de referencia y un valor posterior", sin importar el dominio.
     */
    static computeCumulativeImprovement(firstMetrics, currentMetrics) {

        if (!firstMetrics || !currentMetrics) {

            return null;

        }

        return {

            mae: ProposalScoring.computeMaeImprovementPercentage(firstMetrics.maeHours, currentMetrics.maeHours),

            rmse: ProposalScoring.computeRmseImprovementPercentage(firstMetrics.rmseHours, currentMetrics.rmseHours),

            bias: ProposalScoring.computeBiasImprovementPercentage(firstMetrics.biasHours, currentMetrics.biasHours)

        };

    }

    /*
     * Sección 8 -- tiempo activo. Tres casos:
     *
     *   1. Nunca fue activada (`activatedAt` null) -> no aplica.
     *   2. Fue activada y ya fue reemplazada (`deactivatedAt` presente)
     *      -> duración fija, en días completos, entre ambas fechas.
     *   3. Está ACTIVE ahora mismo (`activatedAt` presente,
     *      `deactivatedAt` null) -> "activa desde hace N días",
     *      calculado contra `now` (inyectado, nunca `new Date()`
     *      directamente aquí, para que el cálculo sea reproducible en
     *      pruebas).
     *
     * `deactivatedAt` (no "la fecha de activación de la siguiente
     * versión") es la fuente de la fecha de reemplazo -- ya existe en
     * el modelo desde 2.6.1.16 y queda estampada por
     * `MaturationModelCalibrationRepository.deactivateRow()` en la
     * MISMA transacción en que la siguiente versión se activa
     * (`MaturationModelCalibrationService.activate()`), así que es
     * equivalente a "cuándo fue reemplazada" sin depender de que exista
     * una vN+1 en la cadena (una calibración desactivada manualmente,
     * sin reemplazo todavía, también debe poder mostrar su duración).
     */
    static computeActiveDuration({ activatedAt, deactivatedAt, now }) {

        if (!activatedAt) {

            return {

                applicable: false,

                durationDays: null,

                isOngoing: false

            };

        }

        const activatedMs =
            new Date(activatedAt).getTime();

        if (deactivatedAt) {

            const deactivatedMs =
                new Date(deactivatedAt).getTime();

            return {

                applicable: true,

                durationDays: Math.max(0, Math.round((deactivatedMs - activatedMs) / DAY_MS)),

                isOngoing: false

            };

        }

        const referenceMs =
            (now ? new Date(now) : new Date()).getTime();

        return {

            applicable: true,

            durationDays: Math.max(0, Math.round((referenceMs - activatedMs) / DAY_MS)),

            isOngoing: true

        };

    }

}

CalibrationHistoryAnalysis.round =
    round;

module.exports =
    CalibrationHistoryAnalysis;
