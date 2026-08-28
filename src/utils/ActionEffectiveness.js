/*
 * Entrega 2.7.0.6 -- "análisis de efectividad de las acciones
 * operativas".
 *
 * Módulo puro (sin Sequelize/Express): decide el resultado OBSERVABLE
 * de una acción operativa comparando la desviación del lote al momento
 * de registrarla contra la desviación (o ausencia de alerta) en la
 * evaluación posterior más reciente. Nunca infiere causalidad (sección
 * 2, explícito) -- solo clasifica una diferencia de magnitud.
 */

// Sección 7 -- "no debemos marcar +4h00 -> +3h58 como IMPROVED... debe
// existir un umbral mínimo de cambio". 30 minutos es el valor que el
// spec propone como ejemplo -- exportado con default, nunca hardcodeado
// dentro de classify(), mismo criterio "configurable" ya establecido en
// este proyecto (PredictionDeviation.DEFAULT_THRESHOLDS, 2.7.0.3;
// FermentationDashboard.DEFAULT_STALE_MEASUREMENT_MINUTES, 2.7.0.4).
const DEFAULT_MINIMUM_IMPROVEMENT_MINUTES = 30;

const EFFECTIVENESS_STATUSES = [

    "PENDING",

    "IMPROVED",

    "UNCHANGED",

    "WORSENED",

    "RESOLVED"

];

class ActionEffectiveness {

    /*
     * Sección 1/6/7 -- clasificación central.
     *
     * `deviationMinutesBefore`/`deviationMinutesAfter` son los valores
     * CON SIGNO ya persistidos por ProductionPredictionAlert
     * (deviationMinutes > 0 = SLOWER, < 0 = FASTER, ver
     * PredictionDeviation.evaluate(), 2.7.0.3) -- la comparación de
     * "mejora" usa la MAGNITUD (valor absoluto: qué tan lejos está el
     * lote de lo esperado, sin importar la dirección), porque una
     * desviación que pasa de "+4h30 de retraso" a "-0h10 de adelanto"
     * sigue siendo una mejora real, no algo indefinido por cambiar de
     * signo.
     *
     * `alertStillActive` -- sección 6, el criterio que DIFERENCIA
     * RESOLVED de IMPROVED: RESOLVED significa que la condición de
     * alerta dejó de existir (gana sobre cualquier comparación de
     * magnitud); IMPROVED significa que la magnitud bajó lo suficiente
     * pero la alerta sigue activa.
     *
     * Si no hay todavía un `deviationMinutesAfter` (o falta el "antes",
     * defensivamente), regresa PENDING -- nunca inventa un resultado
     * (sección 13). En la práctica, el servicio solo llama a classify()
     * cuando ya existe una predicción nueva que evaluar, así que esta
     * rama es principalmente una salvaguarda.
     */
    static classify({ deviationMinutesBefore, deviationMinutesAfter, alertStillActive, minimumImprovementMinutes = DEFAULT_MINIMUM_IMPROVEMENT_MINUTES }) {

        if (!alertStillActive) {

            return "RESOLVED";

        }

        if (deviationMinutesBefore === null || deviationMinutesBefore === undefined || deviationMinutesAfter === null || deviationMinutesAfter === undefined) {

            return "PENDING";

        }

        const before =
            Math.abs(deviationMinutesBefore);

        const after =
            Math.abs(deviationMinutesAfter);

        const improvementMinutes =
            before - after;

        if (improvementMinutes >= minimumImprovementMinutes) {

            return "IMPROVED";

        }

        if (-improvementMinutes >= minimumImprovementMinutes) {

            return "WORSENED";

        }

        return "UNCHANGED";

    }

    /*
     * Sección 9/17 -- "Cambio: -3h 10m" del mockup. Con signo con
     * respecto a la MAGNITUD (negativo = la desviación se redujo
     * -mejora-, positivo = aumentó -empeoramiento-), consistente con
     * `classify()` de arriba. null cuando falta cualquiera de los dos
     * valores -- nunca fabrica un número.
     */
    static changeMinutes(deviationMinutesBefore, deviationMinutesAfter) {

        if (deviationMinutesBefore === null || deviationMinutesBefore === undefined || deviationMinutesAfter === null || deviationMinutesAfter === undefined) {

            return null;

        }

        return Math.abs(deviationMinutesAfter) - Math.abs(deviationMinutesBefore);

    }

    static isValidStatus(status) {

        return EFFECTIVENESS_STATUSES.includes(status);

    }

}

ActionEffectiveness.DEFAULT_MINIMUM_IMPROVEMENT_MINUTES =
    DEFAULT_MINIMUM_IMPROVEMENT_MINUTES;

ActionEffectiveness.EFFECTIVENESS_STATUSES =
    EFFECTIVENESS_STATUSES;

module.exports =
    ActionEffectiveness;
