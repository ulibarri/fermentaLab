/*
 * Entrega 2.7.0.3 -- "Alertas de desviación de la fermentación".
 *
 * Módulo puro (sin Sequelize ni Express): decide si el comportamiento
 * observado de un lote se está alejando lo suficiente de lo esperado
 * como para justificar una alerta operativa, y con qué severidad.
 *
 * Diseño (sección 4/5, "no depender solo de la diferencia de horas"):
 *   1. Se compara la ETA de la predicción NUEVA (`predictedFinishAt`)
 *      contra el intervalo de confianza [expectedLowerBound,
 *      expectedUpperBound] de la predicción ANTERIOR (`expectedFinishAt`
 *      es su centro, ver PredictionDeviation.evaluate()) -- esa
 *      predicción anterior representa "lo que esperábamos" en el
 *      momento en que se generó, exactamente el ejemplo de la sección 5
 *      (Predicción 18:00, intervalo 16:00-20:00).
 *   2. Si la nueva ETA sigue DENTRO de ese intervalo, el estado es
 *      SIEMPRE "NORMAL" -- sin importar cuántos minutos de diferencia
 *      haya en términos absolutos (esto es lo que evita generar ruido
 *      por el ejemplo de la sección 4: 18:00 -> 18:20 nunca debería
 *      alertar, y en la práctica tampoco lo haría aunque se comparara
 *      contra el intervalo, porque 20 minutos rara vez saca a la
 *      predicción de su propia ventana de confianza).
 *   3. Si la nueva ETA cae FUERA del intervalo (o si el intervalo no
 *      está disponible -- predicción sin ventana de confianza todavía,
 *      ver PredictionConfidence.js de 2.7.0.1), la severidad se
 *      determina por la magnitud de la desviación en minutos, contra
 *      umbrales configurables (sección 3) -- nunca hardcodeados dentro
 *      de esta función, solo como default exportado.
 */

// Sección 3 -- valores propuestos por el spec como punto de partida,
// nunca usados directamente dentro de evaluate()/classifySeverityByMinutes()
// (siempre como default explícito, para que un llamador pueda pasar los
// suyos sin tocar este archivo).
const DEFAULT_WARNING_THRESHOLD_MINUTES = 120;

const DEFAULT_SIGNIFICANT_THRESHOLD_MINUTES = 300;

const DEFAULT_CRITICAL_THRESHOLD_MINUTES = 480;

const DEFAULT_THRESHOLDS = {

    warningMinutes: DEFAULT_WARNING_THRESHOLD_MINUTES,

    significantMinutes: DEFAULT_SIGNIFICANT_THRESHOLD_MINUTES,

    criticalMinutes: DEFAULT_CRITICAL_THRESHOLD_MINUTES

};

class PredictionDeviation {

    /*
     * Clasifica una magnitud de desviación (ya en valor absoluto, en
     * minutos) contra los tres umbrales -- el más alto que se alcance
     * gana. Nunca regresa un nivel intermedio inventado.
     */
    static classifySeverityByMinutes(absDeviationMinutes, thresholds = DEFAULT_THRESHOLDS) {

        if (absDeviationMinutes === null || absDeviationMinutes === undefined || !Number.isFinite(absDeviationMinutes)) {

            return "NORMAL";

        }

        const t = {

            ...DEFAULT_THRESHOLDS,

            ...thresholds

        };

        if (absDeviationMinutes >= t.criticalMinutes) {

            return "CRITICAL";

        }

        if (absDeviationMinutes >= t.significantMinutes) {

            return "SIGNIFICANT";

        }

        if (absDeviationMinutes >= t.warningMinutes) {

            return "WARNING";

        }

        return "NORMAL";

    }

    /*
     * expectedFinishAt/predictedFinishAt -- ISO strings o Date.
     * expectedLowerBound/expectedUpperBound -- intervalo de confianza
     *   de la predicción usada como línea base (`expectedFinishAt` es
     *   su propio predictedMaturationAt), nullable (sección 9 de
     *   2.7.0.1: "sin evidencia histórica suficiente todavía").
     *
     * Regresa { applicable, status, severity, direction, deviationMinutes,
     * intervalStatus }. `applicable:false` cuando no hay una predicción
     * anterior con la que comparar (primera predicción del lote) --
     * nunca se fabrica una desviación contra la nada.
     */
    static evaluate({ expectedFinishAt, expectedLowerBound = null, expectedUpperBound = null, predictedFinishAt, thresholds = DEFAULT_THRESHOLDS }) {

        if (!expectedFinishAt || !predictedFinishAt) {

            return {

                applicable: false,

                status: null,

                severity: null,

                direction: null,

                deviationMinutes: null,

                intervalStatus: "UNAVAILABLE"

            };

        }

        const expectedMillis =
            new Date(expectedFinishAt).getTime();

        const predictedMillis =
            new Date(predictedFinishAt).getTime();

        if (!Number.isFinite(expectedMillis) || !Number.isFinite(predictedMillis)) {

            return {

                applicable: false,

                status: null,

                severity: null,

                direction: null,

                deviationMinutes: null,

                intervalStatus: "UNAVAILABLE"

            };

        }

        const deviationMinutes =
            Math.round((predictedMillis - expectedMillis) / (60 * 1000));

        const direction =
            deviationMinutes > 0 ? "SLOWER" : deviationMinutes < 0 ? "FASTER" : "UNCHANGED";

        let intervalStatus =
            "UNAVAILABLE";

        if (expectedLowerBound && expectedUpperBound) {

            const lowerMillis =
                new Date(expectedLowerBound).getTime();

            const upperMillis =
                new Date(expectedUpperBound).getTime();

            if (Number.isFinite(lowerMillis) && Number.isFinite(upperMillis)) {

                intervalStatus =
                    (predictedMillis >= lowerMillis && predictedMillis <= upperMillis)
                        ? "IN_RANGE"
                        : "OUT_OF_RANGE";

            }

        }

        // Sección 5 -- dentro del intervalo esperado siempre es NORMAL,
        // sin importar la magnitud en minutos.
        if (intervalStatus === "IN_RANGE") {

            return {

                applicable: true,

                status: "NORMAL",

                severity: "NORMAL",

                direction,

                deviationMinutes,

                intervalStatus

            };

        }

        // Fuera del intervalo (o sin intervalo disponible) -- la
        // severidad se decide por magnitud en minutos (sección 3).
        const severity =
            this.classifySeverityByMinutes(Math.abs(deviationMinutes), thresholds);

        return {

            applicable: true,

            status: severity === "NORMAL" ? "NORMAL" : "DEVIATION",

            severity,

            direction,

            deviationMinutes,

            intervalStatus

        };

    }

}

PredictionDeviation.DEFAULT_WARNING_THRESHOLD_MINUTES =
    DEFAULT_WARNING_THRESHOLD_MINUTES;

PredictionDeviation.DEFAULT_SIGNIFICANT_THRESHOLD_MINUTES =
    DEFAULT_SIGNIFICANT_THRESHOLD_MINUTES;

PredictionDeviation.DEFAULT_CRITICAL_THRESHOLD_MINUTES =
    DEFAULT_CRITICAL_THRESHOLD_MINUTES;

PredictionDeviation.DEFAULT_THRESHOLDS =
    DEFAULT_THRESHOLDS;

module.exports =
    PredictionDeviation;
