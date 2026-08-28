/*
 * Estado operativo de un lote y alertas de deriva de predicción
 * (Entrega 2.7.0.1, secciones 3/6). Módulo puro (sin Sequelize ni
 * Express).
 *
 * Sección 7 -- separación de responsabilidades, explícita en el spec:
 * este módulo es la capa "Lote -> Predicción operativa -> Alerta
 * operacional", completamente independiente de la capa "Modelo ->
 * Predicción -> Evaluación del modelo" (DegradationDetection.js,
 * CalibrationHealth.js, 2.6.1.x). Una desviación aquí NUNCA implica que
 * el modelo esté degradado -- ese diagnóstico sigue dependiendo
 * exclusivamente de la evidencia estadística acumulada que construye
 * DegradationDetection.js. Este módulo no importa ni es importado por
 * ninguno de los módulos de esa otra capa.
 */

function round(value, decimals) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

// Sección 3 -- "cerca del límite" es el último tramo de la ventana de
// confianza antes del límite superior. No hay un número exacto en el
// spec; se elige el último 25% de la ventana como zona de alerta
// temprana (documentado como judgment call, ver resumen de la entrega).
const NEAR_LIMIT_WINDOW_FRACTION = 0.25;

// Sección 6 -- a partir de cuántas horas de diferencia entre dos
// predicciones consecutivas del MISMO lote se considera una desviación
// operativa "significativa" (la que sí se muestra como alerta) en vez
// de simple ruido de una medición a otra. Judgment call, sin número
// explícito en el spec.
const SIGNIFICANT_DRIFT_THRESHOLD_HOURS = 2;

class BatchOperationalStatus {

    /*
     * Sección 3 -- clasifica un instante (`now`) contra la ventana de
     * confianza [lowerBound, upperBound] de la predicción VIGENTE.
     *
     * Diseñado para reutilizarse en DOS momentos distintos con el mismo
     * código (nunca dos implementaciones separadas):
     *   - en vivo, con `now = new Date()`, mientras el lote sigue en
     *     curso (sección 3, el caso principal);
     *   - retrospectivamente, con `now = actualMaturationAt`, una vez
     *     que el lote ya finalizó, para clasificar si el resultado real
     *     cayó dentro de la ventana que se había prometido (útil para
     *     el historial, sección 5).
     *
     * Nunca inventa un estado si no hay ventana de confianza aplicable
     * -- "UNAVAILABLE" es un resultado legítimo, no un error.
     */
    static classifyRangeStatus({ now, lowerBound, upperBound }) {

        if (!upperBound || !lowerBound) {

            return { code: "UNAVAILABLE", label: "Sin ventana de confianza disponible", emoji: "⚪" };

        }

        const nowMillis =
            new Date(now).getTime();

        const lowerMillis =
            new Date(lowerBound).getTime();

        const upperMillis =
            new Date(upperBound).getTime();

        if (!Number.isFinite(nowMillis) || !Number.isFinite(lowerMillis) || !Number.isFinite(upperMillis)) {

            return { code: "UNAVAILABLE", label: "Sin ventana de confianza disponible", emoji: "⚪" };

        }

        if (nowMillis >= upperMillis) {

            return { code: "OUT_OF_RANGE", label: "FUERA DE PREDICCIÓN", emoji: "🔴" };

        }

        const windowMillis =
            upperMillis - lowerMillis;

        const nearLimitThresholdMillis =
            upperMillis - (windowMillis * NEAR_LIMIT_WINDOW_FRACTION);

        if (nowMillis >= nearLimitThresholdMillis) {

            return { code: "NEAR_LIMIT", label: "CERCA DEL LÍMITE", emoji: "🟡" };

        }

        return { code: "IN_RANGE", label: "EN RANGO", emoji: "🟢" };

    }

    /*
     * Sección 6 -- deriva entre las dos predicciones VIGENTES más
     * recientes del mismo lote (`previousPredictedMaturationAt` ->
     * `currentPredictedMaturationAt`, en ese orden cronológico).
     * `driftHours` positivo significa que la nueva estimación se
     * ATRASÓ respecto a la anterior (la fermentación va más lenta de lo
     * esperado, el ejemplo del spec); negativo, que se ADELANTÓ.
     */
    static classifyDrift({ previousPredictedMaturationAt, currentPredictedMaturationAt, thresholdHours = SIGNIFICANT_DRIFT_THRESHOLD_HOURS }) {

        if (!previousPredictedMaturationAt || !currentPredictedMaturationAt) {

            return { code: "NONE", driftHours: null, direction: null };

        }

        const previousMillis =
            new Date(previousPredictedMaturationAt).getTime();

        const currentMillis =
            new Date(currentPredictedMaturationAt).getTime();

        if (!Number.isFinite(previousMillis) || !Number.isFinite(currentMillis)) {

            return { code: "NONE", driftHours: null, direction: null };

        }

        const driftHours =
            round((currentMillis - previousMillis) / (60 * 60 * 1000), 2);

        const direction =
            driftHours > 0 ? "SLOWER" : (driftHours < 0 ? "FASTER" : "UNCHANGED");

        const magnitude =
            Math.abs(driftHours);

        const code =
            magnitude >= thresholdHours ? "SIGNIFICANT" : "NONE";

        return { code, driftHours, direction };

    }

}

BatchOperationalStatus.NEAR_LIMIT_WINDOW_FRACTION =
    NEAR_LIMIT_WINDOW_FRACTION;

BatchOperationalStatus.SIGNIFICANT_DRIFT_THRESHOLD_HOURS =
    SIGNIFICANT_DRIFT_THRESHOLD_HOURS;

module.exports =
    BatchOperationalStatus;
