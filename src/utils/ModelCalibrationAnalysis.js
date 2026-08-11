/*
 * Análisis de sesgo y calibración del modelo (Entrega 2.6.1.15).
 *
 * Módulo puro (sin Sequelize ni Express) que da el siguiente paso
 * sobre las métricas agregadas de la Entrega 2.6.1.14: no solo
 * "¿cuánto se equivoca este modelo?" (MAE/RMSE/Bias), sino "¿se
 * equivoca siempre en una dirección similar, de forma corregible?"
 *
 * Consume el resumen YA calculado por ModelAccuracyMetrics
 * (summarizeModelAccuracy) -- nunca recalcula MAE/RMSE/Bias/conteos
 * desde cero (sección 8: "debe reutilizar las métricas reales
 * existentes, sin duplicar innecesariamente los cálculos").
 *
 * Esta entrega es puramente ANALÍTICA (sección 7, 11): produce una
 * recomendación de calibración, pero NUNCA la aplica -- no cambia el
 * modelo activo, no modifica predicciones, no crea ninguna
 * configuración. Eso queda explícitamente para una entrega futura
 * (sección 12, MaturationModelCalibration).
 */

// Sección 4: umbral de clasificación de sesgo, en horas -- 30 minutos.
// Constante única y centralizada (sección 4, explícito: "no debe
// quedar disperso en diferentes servicios: if (bias > 0.5)").
const BIAS_CLASSIFICATION_THRESHOLD_HOURS = 0.5;

// Secciones 4 y 6 usan el mismo número (5) para dos gates distintos
// mencionados por separado en el spec (INSUFFICIENT_DATA de la
// clasificación, y el mínimo de muestra para recomendar calibración)
// -- se centralizan aquí como una sola constante en vez de duplicar
// el literal "5" en dos lugares.
const MIN_SAMPLE_SIZE = 5;

// Sección 6: consistencia direccional mínima para recomendar
// calibración.
const MIN_DIRECTION_CONSISTENCY_PERCENTAGE = 70;

function round(value, decimals) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

class ModelCalibrationAnalysis {

    /*
     * Sección 5/10: consistencia direccional = el porcentaje de la
     * dirección DOMINANTE (EARLY o LATE, lo que sea mayor) -- no un
     * promedio de ambas. Un modelo con EARLY 80%/LATE 15%/EXACT 5%
     * tiene directionConsistency=80%, no 95% (no se suma EXACT: un
     * acierto exacto no es evidencia de una tendencia direccional,
     * es ausencia de error).
     */
    static computeDirectionConsistency(earlyPercentage, latePercentage) {

        if (earlyPercentage === null || earlyPercentage === undefined) {

            earlyPercentage = 0;

        }

        if (latePercentage === null || latePercentage === undefined) {

            latePercentage = 0;

        }

        return round(Math.max(earlyPercentage, latePercentage), 2);

    }

    /*
     * Sección 3/4: clasificación de sesgo, reglas explícitas y
     * simples -- basada ÚNICAMENTE en tamaño de muestra y Bias (con
     * signo). MAE y directionConsistency se muestran junto a esta
     * clasificación (sección 5) para dar contexto adicional, pero
     * deliberadamente NO alteran esta clasificación -- el spec nunca
     * define una regla numérica que los combine con el Bias aquí; la
     * consistencia direccional entra en juego más adelante, solo
     * para decidir si SE RECOMIENDA calibrar (buildCalibrationRecommendation).
     */
    static classifyBias(sampleSize, biasHours) {

        if (!sampleSize || sampleSize < MIN_SAMPLE_SIZE) {

            return "INSUFFICIENT_DATA";

        }

        if (biasHours === null || biasHours === undefined) {

            return "INSUFFICIENT_DATA";

        }

        if (Math.abs(biasHours) <= BIAS_CLASSIFICATION_THRESHOLD_HOURS) {

            return "WELL_CALIBRATED";

        }

        return biasHours > 0 ? "EARLY_BIASED" : "LATE_BIASED";

    }

    /*
     * Sección 6: solo se recomienda calibrar cuando las TRES
     * condiciones se cumplen simultáneamente -- muestra suficiente,
     * consistencia direccional alta, Y una magnitud de Bias que ya
     * superó el umbral de clasificación. El offset recomendado es,
     * inicialmente, exactamente el Bias observado (sección 6,
     * criterio de aceptación #14) -- no se aplica ningún factor de
     * ajuste ni suavizado todavía.
     */
    static buildCalibrationRecommendation({ sampleSize, biasHours, directionConsistency }) {

        const hasEnoughSample =
            sampleSize >= MIN_SAMPLE_SIZE;

        const hasEnoughConsistency =
            directionConsistency !== null && directionConsistency !== undefined &&
            directionConsistency >= MIN_DIRECTION_CONSISTENCY_PERCENTAGE;

        const hasSignificantBias =
            biasHours !== null && biasHours !== undefined &&
            Math.abs(biasHours) > BIAS_CLASSIFICATION_THRESHOLD_HOURS;

        const recommended =
            hasEnoughSample && hasEnoughConsistency && hasSignificantBias;

        return {

            recommended,

            offsetHours: recommended ? round(biasHours, 2) : null

        };

    }

    /*
     * Sección 9: interpretación en lenguaje sencillo, generada aquí
     * (no en el frontend) para mantener el lenguaje centralizado y
     * controlado -- mismo criterio que ModelAccuracyMetrics.buildInterpretation
     * (2.6.1.14) y ModelRecommendation.js (2.6.1.10). Dos partes: un
     * titular sobre la dirección de la tendencia, y una línea de
     * recomendación (o su ausencia).
     */
    static buildInterpretation(biasClassification, calibrationRecommendation) {

        const headline =
            ({

                EARLY_BIASED: "El modelo tiende a predecir la maduración antes de lo que ocurre realmente.",

                LATE_BIASED: "El modelo tiende a predecir la maduración después de lo que ocurre realmente.",

                WELL_CALIBRATED: "No se detecta un sesgo sistemático suficientemente consistente como para recomendar una calibración.",

                INSUFFICIENT_DATA: "Todavía no hay suficientes predicciones evaluadas contra maduración real para determinar si existe un sesgo sistemático."

            })[biasClassification] || "";

        const recommendationMessage =
            calibrationRecommendation && calibrationRecommendation.recommended
                ? `Considerar una calibración de ${calibrationRecommendation.offsetHours > 0 ? "+" : ""}${calibrationRecommendation.offsetHours} horas.`
                : "No requiere calibración.";

        return { headline, recommendationMessage };

    }

    /*
     * Punto de entrada principal: extiende UN resumen ya calculado
     * por ModelAccuracyMetrics.summarizeModelAccuracy() (2.6.1.14)
     * con directionConsistency/biasClassification/
     * calibrationRecommendation/interpretación -- nunca recalcula
     * maeHours/rmseHours/biasHours/earlyPercentage/etc., que ya
     * vienen resueltos en `modelMetrics`.
     */
    static summarizeCalibration(modelMetrics) {

        const directionConsistency =
            this.computeDirectionConsistency(

                modelMetrics.earlyPercentage,

                modelMetrics.latePercentage

            );

        const biasClassification =
            this.classifyBias(modelMetrics.sampleSize, modelMetrics.biasHours);

        const calibrationRecommendation =
            this.buildCalibrationRecommendation({

                sampleSize: modelMetrics.sampleSize,

                biasHours: modelMetrics.biasHours,

                directionConsistency

            });

        const interpretation =
            this.buildInterpretation(biasClassification, calibrationRecommendation);

        return {

            ...modelMetrics,

            directionConsistency,

            biasClassification,

            calibrationRecommendation,

            interpretation

        };

    }

}

ModelCalibrationAnalysis.BIAS_CLASSIFICATION_THRESHOLD_HOURS =
    BIAS_CLASSIFICATION_THRESHOLD_HOURS;

ModelCalibrationAnalysis.MIN_SAMPLE_SIZE =
    MIN_SAMPLE_SIZE;

ModelCalibrationAnalysis.MIN_DIRECTION_CONSISTENCY_PERCENTAGE =
    MIN_DIRECTION_CONSISTENCY_PERCENTAGE;

module.exports =
    ModelCalibrationAnalysis;
