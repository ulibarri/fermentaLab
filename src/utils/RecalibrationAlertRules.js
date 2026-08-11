/*
 * Alertas y recomendaciones de recalibración (Entrega 2.6.1.21).
 *
 * Módulo puro (sin Sequelize ni Express). Nunca introduce umbrales
 * rígidos de horas (sección 2, "no se introducirán reglas como MAE > 2
 * horas") -- en su lugar combina señales que YA existen y ya están
 * probadas: `CalibrationHealth.js` (2.6.1.18, salud/tendencia/
 * recomendación de recalibración vía ventana reciente de al menos 10
 * evaluaciones) y las comparaciones reciente-vs-histórico que ese mismo
 * módulo ya calcula. Este archivo nunca reimplementa esos cálculos --
 * solo decide, a partir de sus salidas, qué nivel de alerta corresponde
 * y cómo explicarlo en español.
 *
 * Persistencia del deterioro (sección 5, "no se deberá generar una
 * alerta crítica por un único lote"): queda garantizada estructuralmente
 * porque CRITICAL solo se alcanza vía `recommendRecalibration` (2.6.1.18),
 * que exige la ventana reciente COMPLETA de 10 evaluaciones -- nunca una
 * sola. Nunca se evalúa aquí un lote individual.
 */

const CalibrationHealth =
    require("./CalibrationHealth");

// Sección 3: "la primera regla compara MAE reciente vs. histórico".
// Reutiliza el mismo mínimo de muestra que CalibrationHealth exige antes
// de declarar salud/tendencia (2.6.1.18) -- nunca un segundo número
// mágico para "suficientes datos".
const MIN_SAMPLE_SIZE =
    CalibrationHealth.MIN_RECENT_SAMPLE_SIZE;

const SEVERITY = {

    INFO: "INFO",

    WARNING: "WARNING",

    CRITICAL: "CRITICAL",

    INSUFFICIENT_DATA: "INSUFFICIENT_DATA"

};

const ALERT_TYPE = {

    PERFORMANCE_DETERIORATION: "PERFORMANCE_DETERIORATION",

    INSUFFICIENT_DATA: "INSUFFICIENT_DATA"

};

function round(value, decimals) {

    if (value === null || value === undefined || !Number.isFinite(Number(value))) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(Number(value) * factor) / factor;

}

function hasValue(value) {

    return value !== null && value !== undefined && Number.isFinite(Number(value));

}

class RecalibrationAlertRules {

    /*
     * Sección 4: combina varias señales en vez de decidir por una sola.
     * Evaluado en orden de prioridad (el primero que aplique gana, mismo
     * estilo que `CalibrationHealth.classifyHealth`):
     *
     *   1. Sin calibración activa, o salud INSUFFICIENT_DATA, o menos de
     *      MIN_SAMPLE_SIZE evaluaciones recientes -> INSUFFICIENT_DATA
     *      (sección 1: "no hay suficientes datos para evaluar").
     *   2. `recommendRecalibration` === true (2.6.1.18, exige salud
     *      DEGRADED + ventana reciente completa de 10) -> CRITICAL --
     *      única vía de escalar a crítico, así "persistencia del
     *      deterioro" (sección 5) queda garantizada por construcción.
     *   3. MAE reciente > histórico, o |Bias| reciente > |Bias|
     *      histórico, o salud WARNING, o tendencia DETERIORATING ->
     *      WARNING (sección 3: un aumento de MAE por sí solo nunca basta
     *      para CRITICAL, pero tampoco se ignora -- siempre al menos
     *      WARNING).
     *   4. Cualquier otro caso -> INFO (sección 1: "situación normal").
     */
    static classify({

        hasCalibration,

        calibrationHealth,

        trend,

        recommendRecalibration,

        sampleSize,

        maeHistorical,

        maeRecent,

        biasHistorical,

        biasRecent,

        rmseHistorical,

        rmseRecent

    }) {

        const maeIncreased =
            hasValue(maeHistorical) && hasValue(maeRecent) && Number(maeRecent) > Number(maeHistorical);

        const biasIncreased =
            hasValue(biasHistorical) && hasValue(biasRecent) && Math.abs(Number(biasRecent)) > Math.abs(Number(biasHistorical));

        // Sección 6: "considere RMSE cuando corresponda" -- señal de
        // apoyo (aparece en el mensaje/detalles cuando está disponible),
        // nunca obligatoria ni con su propio umbral -- no todo llamador
        // tiene un RMSE histórico con el que comparar.
        const rmseIncreased =
            hasValue(rmseHistorical) && hasValue(rmseRecent) && Number(rmseRecent) > Number(rmseHistorical);

        const signals =
            { maeIncreased, biasIncreased, rmseIncreased };

        if (!hasCalibration || calibrationHealth === "INSUFFICIENT_DATA" || !sampleSize || sampleSize < MIN_SAMPLE_SIZE) {

            return {

                severity: SEVERITY.INSUFFICIENT_DATA,

                type: ALERT_TYPE.INSUFFICIENT_DATA,

                signals: { maeIncreased: null, biasIncreased: null, rmseIncreased: null }

            };

        }

        if (recommendRecalibration === true) {

            return {

                severity: SEVERITY.CRITICAL,

                type: ALERT_TYPE.PERFORMANCE_DETERIORATION,

                signals

            };

        }

        if (maeIncreased || biasIncreased || calibrationHealth === "WARNING" || trend === "DETERIORATING") {

            return {

                severity: SEVERITY.WARNING,

                type: ALERT_TYPE.PERFORMANCE_DETERIORATION,

                signals

            };

        }

        return {

            severity: SEVERITY.INFO,

            type: null,

            signals

        };

    }

    /*
     * Sección 7: cada alerta debe explicar por qué fue generada, en
     * español y sin jerga estadística. Reproduce el formato exacto de
     * los ejemplos de las secciones 1 y 7.
     */
    static buildMessage({

        severity,

        maeHistorical,

        maeRecent,

        biasIncreased,

        rmseIncreased,

        calibrationHealth

    }) {

        if (severity === SEVERITY.INSUFFICIENT_DATA) {

            return "No existen suficientes evaluaciones recientes para determinar si el modelo requiere recalibración.";

        }

        if (severity === SEVERITY.INFO) {

            return "La calibración activa mantiene un desempeño estable.";

        }

        const parts = [];

        if (hasValue(maeHistorical) && hasValue(maeRecent)) {

            parts.push(`El MAE reciente aumentó de ${round(maeHistorical, 2)} h a ${round(maeRecent, 2)} h.`);

        } else {

            parts.push("El error absoluto medio reciente es superior al histórico.");

        }

        if (severity === SEVERITY.CRITICAL) {

            parts.push(

                biasIncreased
                    ? "El Bias también aumentó y la calibración activa actualmente presenta estado DEGRADED."
                    : "La calibración activa actualmente presenta estado DEGRADED."

            );

        } else if (biasIncreased) {

            parts.push("El Bias también aumentó.");

        }

        if (rmseIncreased) {

            parts.push("El RMSE también aumentó respecto al histórico.");

        }

        parts.push(

            severity === SEVERITY.CRITICAL
                ? "Se recomienda crear una nueva propuesta de calibración."
                : "Se recomienda continuar monitoreando."

        );

        return parts.join(" ");

    }

    /*
     * Sección 14: "Offset sugerido" para la propuesta de recalibración
     * -- se suma el Bias reciente (residual) al offset actual, así el
     * ejemplo de la propia especificación (+1.6h actual, Bias reciente
     * -0.5h -> +1.1h sugerido) se reproduce exactamente. No es más que
     * "corregir el offset por el error que todavía queda sin explicar".
     */
    static suggestOffsetHours(currentOffsetHours, recentBiasHours) {

        if (!hasValue(currentOffsetHours) || !hasValue(recentBiasHours)) {

            return null;

        }

        return round(Number(currentOffsetHours) + Number(recentBiasHours), 2);

    }

}

RecalibrationAlertRules.SEVERITY =
    SEVERITY;

RecalibrationAlertRules.ALERT_TYPE =
    ALERT_TYPE;

RecalibrationAlertRules.MIN_SAMPLE_SIZE =
    MIN_SAMPLE_SIZE;

module.exports =
    RecalibrationAlertRules;
