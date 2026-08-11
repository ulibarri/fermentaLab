/*
 * Comparación Predicción vs. Maduración Real (Entrega 2.6.1.13).
 *
 * Módulo puro (sin Sequelize ni Express) que cierra el ciclo:
 *
 *   Predicción (MaturationPrediction, inmutable, Entrega 2.6.1.12)
 *        +
 *   Maduración real (ProductionBatch.finishedAt — el evento YA
 *   existente que se estampa cuando el usuario finaliza F1 vía
 *   ProductionBatchService.complete(), sección 2 de la especificación:
 *   "no debemos introducir una fecha adicional... la fuente deberá
 *   ser el evento/registro de maduración real establecido por las
 *   entregas anteriores")
 *        =
 *   Evaluación individual (errorHours con signo, absoluteErrorHours,
 *   errorPercentage, direction).
 *
 * No persiste nada: la evaluación se deriva bajo demanda a partir de
 * dos hechos ya inmutables (la predicción y `finishedAt`), así que
 * siempre es reproducible y nunca puede quedar "desincronizada" con
 * un cálculo guardado en otro momento -- ni la predicción ni
 * `finishedAt` cambian una vez fijados (sección 10: "NO modificamos
 * Prediction #115").
 */

// ±15 minutos (sección 7): dentro de este margen la predicción se
// considera EXACT, no evidencia de error significativo.
const EXACT_THRESHOLD_HOURS = 0.25;

function round(value, decimals) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

class PredictionEvaluation {

    /*
     * errorHours = actualMaturationAt - predictedMaturationAt (sección 3):
     * positivo cuando la maduración real ocurrió DESPUÉS de lo predicho
     * (la predicción fue temprana/adelantada -- EARLY), negativo cuando
     * ocurrió ANTES (la predicción fue tardía/retrasada -- LATE).
     */
    static computeErrorHours(predictedMaturationAt, actualMaturationAt) {

        const predictedMillis =
            new Date(predictedMaturationAt).getTime();

        const actualMillis =
            new Date(actualMaturationAt).getTime();

        if (!Number.isFinite(predictedMillis) || !Number.isFinite(actualMillis)) {

            return null;

        }

        return (actualMillis - predictedMillis) / (1000 * 60 * 60);

    }

    /*
     * EARLY  -- el modelo predijo una maduración ANTERIOR a la real
     *           (error > +umbral).
     * LATE   -- el modelo predijo una maduración POSTERIOR a la real
     *           (error < -umbral).
     * EXACT  -- |error| dentro de ±EXACT_THRESHOLD_HOURS (sección 7):
     *           una diferencia de minutos no es evidencia de error
     *           significativo.
     */
    static determineDirection(errorHours) {

        if (errorHours === null || errorHours === undefined) {

            return null;

        }

        if (errorHours > EXACT_THRESHOLD_HOURS) {

            return "EARLY";

        }

        if (errorHours < -EXACT_THRESHOLD_HOURS) {

            return "LATE";

        }

        return "EXACT";

    }

    /*
     * errorPercentage = absoluteErrorHours / actualDurationHours × 100
     * (sección 5), donde actualDurationHours es la duración REAL de la
     * fase F1 (desde la primera medición F1 hasta actualMaturationAt) --
     * la misma referencia temporal que predictedDurationHours (Entrega
     * 2.6.1.12), así que:
     *
     *   actualDurationHours
     *     = actualMaturationAt - primeraMediciónF1
     *     = (predictedMaturationAt - primeraMediciónF1) + (actualMaturationAt - predictedMaturationAt)
     *     = predictedDurationHours + errorHours
     *
     * Esto evita tener que volver a consultar las mediciones del lote
     * (que ya no forman parte de la predicción inmutable) para obtener
     * un número matemáticamente idéntico. Si predictedDurationHours no
     * está disponible (el modelo no pudo dar una ETA/duración en el
     * momento de la predicción), el porcentaje queda null -- nunca se
     * fabrica usando otra referencia temporal (sección 5, explícito).
     */
    static computeErrorPercentage(predictedDurationHours, absoluteErrorHours, errorHours) {

        if (

            predictedDurationHours === null || predictedDurationHours === undefined ||
            absoluteErrorHours === null || absoluteErrorHours === undefined ||
            errorHours === null || errorHours === undefined

        ) {

            return null;

        }

        const actualDurationHours =
            predictedDurationHours + errorHours;

        if (!(actualDurationHours > 0)) {

            return null;

        }

        return round((absoluteErrorHours / actualDurationHours) * 100, 2);

    }

    /*
     * Punto de entrada principal. Regresa siempre un objeto con
     * `status` explícito -- nunca inventa un error de 0 ni un
     * direction "EXACT" cuando en realidad falta información
     * (secciones 14/15, criterios de aceptación):
     *
     *   - "PENDING"     -- hay predicción pero todavía no hay
     *                      actualMaturationAt (el lote no ha
     *                      terminado F1). PENDING ≠ EXACT.
     *   - "UNAVAILABLE" -- hay actualMaturationAt pero la predicción
     *                      en sí no tenía una ETA calculable (modelo
     *                      divergente/insuficiente en su momento) --
     *                      no hay con qué comparar el instante real.
     *   - "EVALUATED"   -- ambos datos están disponibles; se calculan
     *                      todas las métricas.
     */
    static evaluatePrediction({ predictedMaturationAt, predictedDurationHours, actualMaturationAt }) {

        if (!actualMaturationAt) {

            return {

                status: "PENDING",

                reason: "no_actual_maturation",

                errorHours: null,

                absoluteErrorHours: null,

                errorPercentage: null,

                direction: null

            };

        }

        if (!predictedMaturationAt) {

            return {

                status: "UNAVAILABLE",

                reason: "prediction_without_eta",

                errorHours: null,

                absoluteErrorHours: null,

                errorPercentage: null,

                direction: null

            };

        }

        const errorHours =
            round(this.computeErrorHours(predictedMaturationAt, actualMaturationAt), 2);

        if (errorHours === null) {

            return {

                status: "UNAVAILABLE",

                reason: "invalid_dates",

                errorHours: null,

                absoluteErrorHours: null,

                errorPercentage: null,

                direction: null

            };

        }

        const absoluteErrorHours =
            round(Math.abs(errorHours), 2);

        const direction =
            this.determineDirection(errorHours);

        const errorPercentage =
            this.computeErrorPercentage(predictedDurationHours, absoluteErrorHours, errorHours);

        return {

            status: "EVALUATED",

            reason: null,

            errorHours,

            absoluteErrorHours,

            errorPercentage,

            direction

        };

    }

}

PredictionEvaluation.EXACT_THRESHOLD_HOURS =
    EXACT_THRESHOLD_HOURS;

module.exports =
    PredictionEvaluation;
