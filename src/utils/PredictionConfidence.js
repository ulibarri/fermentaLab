/*
 * Ventana de confianza de una predicción operativa (Entrega 2.7.0.1,
 * secciones 1/8). Módulo puro (sin Sequelize ni Express).
 *
 * Responde: "dado que este modelo/calibración históricamente se
 * equivoca en promedio X horas (RMSE, la misma unidad que
 * ModelAccuracyMetrics/CalibrationEffectivenessService usan en TODO
 * este proyecto desde 2.6.1.14), ¿qué rango alrededor de la predicción
 * puntual es razonable mostrarle al productor?"
 *
 * Deliberadamente NO es un intervalo de confianza estadístico formal
 * (no asume una distribución normal de errores, no calcula percentiles)
 * -- es una ventana heurística, documentada como tal, consistente con
 * la disciplina de "evitar falsa precisión" de todo este proyecto: se
 * prefiere un número simple y explicable (±RMSE histórico) a una
 * fórmula estadística que sugeriría más rigor del que los datos
 * realmente sostienen con muestras de 5-20 lotes.
 */

const ModelAccuracyMetrics =
    require("./ModelAccuracyMetrics");

function round(value, decimals) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

// Sección 1, ejemplo literal: "Confianza: 87%". Se usa como el valor de
// referencia para SUFFICIENT_SAMPLE (reutilizando el mismo corte de
// ModelAccuracyMetrics.classifySampleSize(), MIN_SUFFICIENT_SAMPLE=5,
// en vez de definir un tercer umbral de tamaño de muestra propio de
// esta entrega). Por debajo de ese mínimo, la confianza se reporta más
// baja -- nunca oculta, pero tampoco se presenta como si la evidencia
// fuera igual de sólida.
const HIGH_CONFIDENCE_PERCENTAGE = 87;

const LOW_CONFIDENCE_PERCENTAGE = 55;

class PredictionConfidence {

    /*
     * Rango [predictedMaturationAt - rmseHours, predictedMaturationAt +
     * rmseHours]. `rmseHours` es SIEMPRE una magnitud (>=0, ver
     * ModelAccuracyMetrics.computeRMSE()) -- se usa tal cual como
     * semiancho, sin transformación adicional. Regresa null si falta
     * cualquiera de los dos insumos -- nunca se fabrica una ventana sin
     * un RMSE real detrás.
     */
    static computeWindow(predictedMaturationAt, rmseHours) {

        if (!predictedMaturationAt || rmseHours === null || rmseHours === undefined || Number.isNaN(Number(rmseHours))) {

            return null;

        }

        const centerMillis =
            new Date(predictedMaturationAt).getTime();

        if (!Number.isFinite(centerMillis)) {

            return null;

        }

        const halfWidthMillis =
            Math.abs(Number(rmseHours)) * 60 * 60 * 1000;

        return {

            lowerBound: new Date(centerMillis - halfWidthMillis).toISOString(),

            upperBound: new Date(centerMillis + halfWidthMillis).toISOString(),

            windowHours: round(Number(rmseHours) * 2, 2)

        };

    }

    /*
     * Sección 1 -- porcentaje de confianza, derivado del mismo
     * `sampleClassification` que ya produce
     * `ModelAccuracyMetrics.summarizeModelAccuracy()` (reuse, no un
     * tercer sistema de clasificación de muestra). Sin ninguna muestra
     * (sampleSize=0), no hay confianza que reportar -- null, nunca 0%
     * (0% sugeriría "sabemos que esto es incorrecto", que no es lo que
     * significa "sin evidencia").
     */
    static computeConfidencePercentage(sampleSize) {

        const n =
            Number(sampleSize) || 0;

        if (n <= 0) {

            return null;

        }

        return ModelAccuracyMetrics.classifySampleSize(n) === "SUFFICIENT_SAMPLE"
            ? HIGH_CONFIDENCE_PERCENTAGE
            : LOW_CONFIDENCE_PERCENTAGE;

    }

    /*
     * Orquestador -- combina ventana + porcentaje + metadatos de origen
     * (sección 8: "límites de confianza" debe ser trazable a qué
     * evidencia lo produjo). `basis` es puramente informativo, decidido
     * por el llamador (MaturationPredictionService._computeConfidence()):
     * "CALIBRATION" cuando el histórico viene de la calibración
     * efectivamente aplicada a esta predicción, "MODEL" cuando viene del
     * histórico general del modelConfiguration (sin calibración
     * aplicable), "UNAVAILABLE" cuando no hay evidencia de ningún tipo.
     */
    static evaluate({ predictedMaturationAt, rmseHours, sampleSize, basis }) {

        const window =
            PredictionConfidence.computeWindow(predictedMaturationAt, rmseHours);

        const confidencePercentage =
            PredictionConfidence.computeConfidencePercentage(sampleSize);

        if (!window || confidencePercentage === null) {

            return {

                applicable: false,

                basis: "UNAVAILABLE",

                lowerBound: null,

                upperBound: null,

                windowHours: null,

                confidencePercentage: null,

                sampleSize: Number(sampleSize) || 0

            };

        }

        return {

            applicable: true,

            basis: basis || "MODEL",

            lowerBound: window.lowerBound,

            upperBound: window.upperBound,

            windowHours: window.windowHours,

            confidencePercentage,

            sampleSize: Number(sampleSize) || 0

        };

    }

}

PredictionConfidence.HIGH_CONFIDENCE_PERCENTAGE =
    HIGH_CONFIDENCE_PERCENTAGE;

PredictionConfidence.LOW_CONFIDENCE_PERCENTAGE =
    LOW_CONFIDENCE_PERCENTAGE;

module.exports =
    PredictionConfidence;
