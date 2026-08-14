/*
 * Detección de degradación de calibraciones activas (Entrega 2.6.1.28).
 *
 * Módulo puro (sin Sequelize ni Express), mismo estilo que
 * PostActivationEvaluation.js (2.6.1.27)/CalibrationHealth.js
 * (2.6.1.18): no decide QUÉ predicciones ni QUÉ calibración usar como
 * baseline -- eso es responsabilidad exclusiva de
 * CalibrationDegradationService (nuevo, ver ese archivo para el porqué
 * de usar `getHealth(activa).recent` como "actual" y
 * `getHealth(padre).historical` como "baseline"). Este módulo solo
 * clasifica dos números ya calculados.
 *
 * Sección 2, criterio explícito: "no debemos considerar degradación
 * simplemente porque una predicción individual tenga un error grande".
 * Esto se satisface estructuralmente en DOS capas, ninguna de las
 * cuales vive aquí: (a) el servicio nunca pasa una predicción
 * individual a este módulo, siempre un resumen agregado
 * (ModelAccuracyMetrics.summarizeModelAccuracy()) de varias
 * predicciones, y (b) `MIN_SAMPLE_FOR_DETECTION` de abajo exige una
 * muestra mínima antes de que `isDegraded` pueda ser `true`.
 */

// Sección 4: "no debemos codificar un porcentaje fijo" -- valor inicial
// recomendado 20%, exportado como constante configurable (nunca
// hardcodeado en el servicio ni en la vista). El servicio puede pasar
// un `thresholdPercentage` distinto por llamada sin tocar este módulo.
const DEFAULT_DEGRADATION_THRESHOLD_PERCENTAGE = 20;

// Sección 5: "para generar una alerta automática de degradación
// recomiendo exigir >= 10 predicciones evaluables" -- coincide,
// deliberadamente, con CalibrationHealth.RECENT_WINDOW_SIZE (2.6.1.18)
// y con PostActivationEvaluation.MIN_SIGNIFICANT_SAMPLE (2.6.1.27): las
// tres representan el mismo corte de "evaluación significativa" ya
// establecido en esta app, no un cuarto número nuevo por coincidencia.
const MIN_SAMPLE_FOR_DETECTION = 10;

function round(value, decimals = 2) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

class DegradationDetection {

    /*
     * Sección 3/4: % de degradación del MAE respecto al baseline.
     * POSITIVO = empeoró (a diferencia de
     * CalibrationEffectiveness.computeImprovement()/
     * PostActivationEvaluation.percentageChange(), donde positivo =
     * mejoró) -- se elige este signo porque coincide EXACTAMENTE con
     * el vocabulario y los ejemplos numéricos de la propia
     * especificación ("incremento = 13.3%" / "incremento = 33.3%",
     * sección 4: nunca "mejora de -13.3%"). null cuando falta
     * cualquiera de los dos valores o el baseline es 0/negativo (nunca
     * se fabrica un porcentaje desde una base inexistente).
     */
    static computeDegradationPercentage(baselineMaeHours, currentMaeHours) {

        if (

            baselineMaeHours === null || baselineMaeHours === undefined || !(baselineMaeHours > 0) ||
            currentMaeHours === null || currentMaeHours === undefined

        ) {

            return null;

        }

        return round(((currentMaeHours - baselineMaeHours) / baselineMaeHours) * 100, 2);

    }

    /*
     * Punto de entrada principal. `sampleSize` es el tamaño de la
     * muestra ACTUAL (sección 5 -- la del baseline no se exige mínimo
     * explícito, ya que el baseline es la calibración anterior COMPLETA,
     * congelada desde que dejó de estar activa). Nunca declara
     * `isDegraded: true` sin muestra suficiente Y baseline disponible --
     * ambas condiciones son necesarias, ninguna es suficiente por sí
     * sola (sección 2/5, criterios explícitos).
     */
    static classifyDegradation({ sampleSize, baselineMaeHours, currentMaeHours, thresholdPercentage = DEFAULT_DEGRADATION_THRESHOLD_PERCENTAGE }) {

        const sufficientSample =
            Number(sampleSize) >= MIN_SAMPLE_FOR_DETECTION;

        const degradationPercentage =
            this.computeDegradationPercentage(baselineMaeHours, currentMaeHours);

        let reason =
            null;

        if (!sufficientSample) {

            reason = "INSUFFICIENT_SAMPLE";

        } else if (baselineMaeHours === null || baselineMaeHours === undefined || !(baselineMaeHours > 0)) {

            reason = "NO_BASELINE";

        } else if (currentMaeHours === null || currentMaeHours === undefined) {

            reason = "NO_CURRENT_DATA";

        }

        const isDegraded =
            sufficientSample &&
            degradationPercentage !== null &&
            degradationPercentage > thresholdPercentage;

        return {

            sufficientSample,

            degradationPercentage,

            thresholdPercentage,

            isDegraded,

            reason

        };

    }

}

DegradationDetection.DEFAULT_DEGRADATION_THRESHOLD_PERCENTAGE =
    DEFAULT_DEGRADATION_THRESHOLD_PERCENTAGE;

DegradationDetection.MIN_SAMPLE_FOR_DETECTION =
    MIN_SAMPLE_FOR_DETECTION;

module.exports =
    DegradationDetection;
