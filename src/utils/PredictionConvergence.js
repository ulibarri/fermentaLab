const PostActivationEvaluation =
    require("./PostActivationEvaluation");

/*
 * Entrega 2.7.0.2, secciones 7/8 -- "Convergencia hacia el resultado
 * real". Módulo puro: a partir de la línea de tiempo de predicciones YA
 * EVALUADAS de un lote (el mismo array que ya produce
 * MaturationPredictionService.getBatchPredictionAnalysis(), 2.6.1.13 --
 * orden cronológico ascendente, cada una con `status`/
 * `absoluteErrorHours` vía PredictionEvaluation), extrae el error
 * inicial/intermedio/final y clasifica la tendencia. No consulta nada
 * ni recalcula ningún error -- solo transforma la lista que ya le
 * pasan (sección 8: "no propongo todavía crear un nuevo indicador
 * estadístico complejo. En esta entrega basta con medir la evolución
 * de los errores").
 *
 * Reutiliza PostActivationEvaluation.IMPROVEMENT_THRESHOLD_PERCENTAGE
 * (5%, el mismo umbral que 2.6.1.27/CalibrationEffectiveness ya usan
 * para decidir "¿esta métrica se movió lo suficiente para no ser
 * ruido?") en vez de inventar un segundo umbral para la misma pregunta
 * aplicada a otra magnitud en horas -- ambos casos son "cambio relativo
 * porcentual de un error", así que el mismo criterio aplica.
 */
class PredictionConvergence {

    static _point(entry) {

        return {

            id: entry.id,

            predictedAt: entry.predictedAt,

            predictedMaturationAt: entry.predictedMaturationAt,

            absoluteErrorHours: entry.absoluteErrorHours

        };

    }

    /*
     * predictions -- lista ya ordenada cronológicamente ascendente,
     * cada elemento con `status` ("EVALUATED"/"PENDING"/"UNAVAILABLE",
     * ver PredictionEvaluation) y `absoluteErrorHours`. Solo las
     * entradas EVALUATED entran al análisis de convergencia -- nunca se
     * trata un "PENDING" o "UNAVAILABLE" como error 0 (mismo criterio
     * de "nunca fabricar un número" del resto del proyecto).
     */
    static summarize(predictions) {

        const evaluated =
            (predictions || []).filter(p =>

                p.status === "EVALUATED" &&
                p.absoluteErrorHours !== null &&
                p.absoluteErrorHours !== undefined

            );

        if (evaluated.length === 0) {

            return {

                applicable: false,

                reason: (!predictions || predictions.length === 0) ? "NO_PREDICTIONS" : "NOT_EVALUATED",

                initial: null,

                intermediate: null,

                final: null,

                trend: null

            };

        }

        const initial =
            evaluated[0];

        const final =
            evaluated[evaluated.length - 1];

        // Sección 8, ejemplo literal: con exactamente 3 predicciones
        // evaluadas hay una "intermedia" natural. Con menos de 3 no hay
        // un punto medio distinto de inicial/final que mostrar; con más
        // de 3, se toma el punto medio de la serie (criterio simple y
        // determinista, ya que el spec no pide ningún otro).
        const intermediate =
            evaluated.length >= 3
                ? evaluated[Math.floor((evaluated.length - 1) / 2)]
                : null;

        let trend;

        if (evaluated.length < 2) {

            trend = "INSUFFICIENT_DATA";

        } else if (initial.absoluteErrorHours > 0) {

            const improvementPercentage =
                ((initial.absoluteErrorHours - final.absoluteErrorHours) / initial.absoluteErrorHours) * 100;

            if (improvementPercentage > PostActivationEvaluation.IMPROVEMENT_THRESHOLD_PERCENTAGE) {

                trend = "MEJORANDO";

            } else if (improvementPercentage < -PostActivationEvaluation.IMPROVEMENT_THRESHOLD_PERCENTAGE) {

                trend = "EMPEORANDO";

            } else {

                trend = "ESTABLE";

            }

        } else if (final.absoluteErrorHours > 0) {

            // La predicción inicial ya era exacta (error 0) y la final
            // dejó de serlo -- solo puede haber empeorado.
            trend = "EMPEORANDO";

        } else {

            trend = "ESTABLE";

        }

        return {

            applicable: true,

            reason: null,

            initial: this._point(initial),

            intermediate: intermediate ? this._point(intermediate) : null,

            final: this._point(final),

            trend

        };

    }

}

module.exports =
    PredictionConvergence;
