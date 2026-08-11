/*
 * Monitoreo continuo de calibraciones (Entrega 2.6.1.18).
 *
 * Módulo puro (sin Sequelize ni Express). Va un paso más allá de la
 * evaluación puntual de 2.6.1.17 ("¿mejoró la calibración?") para
 * responder "¿sigue funcionando ADEMÁS hoy?" -- comparando una VENTANA
 * MÓVIL de las predicciones más recientes contra tanto el desempeño
 * histórico (desde la activación, sección 4) como la ventana anterior
 * (sección 11, para detectar tendencia).
 *
 * Reutiliza `CalibrationEffectiveness.js` (2.6.1.17) para la
 * clasificación IMPROVED/DEGRADED/NO_SIGNIFICANT_CHANGE dentro de la
 * ventana reciente y su umbral de 5% -- nunca reimplementa esa lógica
 * ni introduce un segundo número mágico para "cambio significativo"
 * (el mismo 5% se reutiliza aquí como umbral de tendencia, sección 11).
 */

const CalibrationEffectiveness =
    require("./CalibrationEffectiveness");

// Sección 3: "Inicialmente: recentWindowSize = 10" -- las últimas N
// predicciones evaluables que usaron la calibración.
const RECENT_WINDOW_SIZE = 10;

// Sección 10: "N < 5 -> INSUFFICIENT_DATA" -- nunca se declara salud
// (buena o mala) a partir de menos de 5 observaciones recientes. Se
// aplica también a la ventana anterior antes de calcular tendencia
// (sección 11): nunca se afirma "mejorando"/"empeorando" comparando
// contra una ventana con muy pocos puntos.
const MIN_RECENT_SAMPLE_SIZE = 5;

// Sección 6: HEALTHY exige que el Bias reciente esté dentro de ±1h.
const HEALTHY_BIAS_THRESHOLD_HOURS = 1;

// Sección 8: deterioro del MAE reciente respecto al MAE calibrado
// histórico superior a este umbral -> DEGRADED.
const DEGRADED_HISTORICAL_DRIFT_PERCENTAGE = 20;

// Sección 13: recommendRecalibration exige la ventana reciente
// COMPLETA (no solo el mínimo de 5) -- "recentSampleSize >= 10".
const RECALIBRATION_MIN_SAMPLE_SIZE = 10;

function round(value, decimals) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

class CalibrationHealth {

    /*
     * Sección 12: `maeChangePercentage` -- a diferencia de
     * `CalibrationEffectiveness.computeImprovement()` (positivo =
     * mejora), aquí positivo = EMPEORÓ (el MAE reciente creció respecto
     * al histórico) -- así queda igual al ejemplo de la sección 12
     * (histórico 1.8h -> reciente 2.2h -> +22.22%). Es un CAMBIO, no una
     * mejora -- por eso el signo es el opuesto.
     */
    static computeMaeChangePercentage(historicalMaeHours, recentMaeHours) {

        if (

            historicalMaeHours === null || historicalMaeHours === undefined || !(historicalMaeHours > 0) ||
            recentMaeHours === null || recentMaeHours === undefined

        ) {

            return null;

        }

        return round(((recentMaeHours - historicalMaeHours) / historicalMaeHours) * 100, 2);

    }

    /*
     * Sección 11: compara la ventana reciente contra la ventana
     * INMEDIATAMENTE ANTERIOR (no contra el histórico completo) --
     * responde "¿la trayectoria reciente va para mejor o para peor?",
     * una señal distinta y complementaria a `health` (que solo mira el
     * estado actual). Nunca reporta una tendencia si cualquiera de las
     * dos ventanas tiene menos del mínimo de muestras (sección 10,
     * extendido aquí por el mismo motivo: no fabricar una dirección a
     * partir de 1-2 puntos).
     */
    static computeTrend(previousWindowSampleSize, previousWindowMaeHours, recentSampleSize, recentMaeHours) {

        if (

            !previousWindowSampleSize || previousWindowSampleSize < MIN_RECENT_SAMPLE_SIZE ||
            !recentSampleSize || recentSampleSize < MIN_RECENT_SAMPLE_SIZE ||
            previousWindowMaeHours === null || previousWindowMaeHours === undefined || !(previousWindowMaeHours > 0) ||
            recentMaeHours === null || recentMaeHours === undefined

        ) {

            return null;

        }

        // Aquí sí, positivo = mejora (mismo signo que
        // CalibrationEffectiveness.computeImprovement) -- comparamos
        // "antes" contra "ahora", así que MAE bajando es una mejora.
        const changePercentage =
            ((previousWindowMaeHours - recentMaeHours) / previousWindowMaeHours) * 100;

        if (changePercentage > CalibrationEffectiveness.MAE_IMPROVEMENT_THRESHOLD_PERCENTAGE) {

            return "IMPROVING";

        }

        if (changePercentage < -CalibrationEffectiveness.MAE_IMPROVEMENT_THRESHOLD_PERCENTAGE) {

            return "DETERIORATING";

        }

        return "STABLE";

    }

    /*
     * Sección 13: "Tenemos suficiente evidencia para recomendar
     * revisar la calibración" -- nunca "el sistema debe crear
     * automáticamente una nueva calibración" (sección 15). Exige la
     * ventana reciente COMPLETA (10, no solo el mínimo de 5) antes de
     * recomendar nada, para no alarmar con una muestra parcial.
     */
    static shouldRecommendRecalibration(recentSampleSize, health) {

        return Boolean(

            recentSampleSize >= RECALIBRATION_MIN_SAMPLE_SIZE &&
            health === "DEGRADED"

        );

    }

    /*
     * Sección 6-10: clasificación de salud, en orden de prioridad
     * (evaluado de arriba hacia abajo -- el primero que aplique gana):
     *
     *   1. recentSampleSize < 5                          -> INSUFFICIENT_DATA (sección 10)
     *   2. recentCalibratedMae > recentRawMae             -> DEGRADED (sección 9: la calibración
     *                                                        empeora respecto a no calibrar en absoluto,
     *                                                        sin importar el desempeño histórico)
     *   3. deterioro vs. MAE calibrado histórico > 20%     -> DEGRADED (sección 8, ejemplo 1.8h->2.4h=33.3%)
     *   4. recentResult=IMPROVED (sección 6, reutilizando
     *      CalibrationEffectiveness.classifyResult sobre la ventana
     *      reciente) Y |Bias reciente| <= 1h (sección 6) Y el MAE
     *      reciente no empeoró respecto al histórico              -> HEALTHY
     *   5. cualquier otro caso                             -> WARNING (sección 7)
     *
     * NOTA sobre el punto 4: la sección 6, leída literalmente, solo
     * exige recentResult=IMPROVED + Bias en banda -- sin mencionar el
     * histórico. Pero el propio ejemplo narrativo de la sección 7
     * ("MAE histórico 1.8h -> reciente 2.1h... comienza a perder
     * efectividad") describe una calibración que TODAVÍA gana contra
     * el modelo sin calibrar (podría seguir siendo "IMPROVED" contra
     * su propio raw) pero que ya no debería considerarse HEALTHY. Sin
     * la cláusula adicional "no empeoró respecto al histórico", ese
     * caso podría clasificar como HEALTHY por error, contradiciendo la
     * intención narrativa de la sección 7. Se agrega esa cláusula
     * como síntesis deliberada de ambas secciones -- flagged como
     * decisión de diseño.
     */
    static classifyHealth({ recentSampleSize, recentRawMaeHours, recentCalibratedMaeHours, recentCalibratedBiasHours, historicalCalibratedMaeHours }) {

        if (!recentSampleSize || recentSampleSize < MIN_RECENT_SAMPLE_SIZE) {

            return "INSUFFICIENT_DATA";

        }

        if (

            recentRawMaeHours !== null && recentRawMaeHours !== undefined &&
            recentCalibratedMaeHours !== null && recentCalibratedMaeHours !== undefined &&
            recentCalibratedMaeHours > recentRawMaeHours

        ) {

            return "DEGRADED";

        }

        if (historicalCalibratedMaeHours !== null && historicalCalibratedMaeHours !== undefined && historicalCalibratedMaeHours > 0) {

            const historicalDriftPercentage =
                ((recentCalibratedMaeHours - historicalCalibratedMaeHours) / historicalCalibratedMaeHours) * 100;

            if (historicalDriftPercentage > DEGRADED_HISTORICAL_DRIFT_PERCENTAGE) {

                return "DEGRADED";

            }

        }

        const improvement =
            CalibrationEffectiveness.computeImprovement(recentRawMaeHours, recentCalibratedMaeHours);

        const recentResult =
            CalibrationEffectiveness.classifyResult(recentSampleSize, improvement.maeImprovementPercentage);

        const biasWithinBand =
            recentCalibratedBiasHours !== null && recentCalibratedBiasHours !== undefined &&
            Math.abs(recentCalibratedBiasHours) <= HEALTHY_BIAS_THRESHOLD_HOURS;

        const notWorseThanHistorical =
            historicalCalibratedMaeHours === null || historicalCalibratedMaeHours === undefined ||
            recentCalibratedMaeHours <= historicalCalibratedMaeHours;

        if (recentResult === "IMPROVED" && biasWithinBand && notWorseThanHistorical) {

            return "HEALTHY";

        }

        return "WARNING";

    }

    /*
     * Punto de entrada principal -- arma exactamente la forma del
     * ejemplo JSON de la sección 12. `historical`/`recent`/
     * `previousWindow` son `{sampleSize, maeHours, biasHours}` ya
     * calculados (típicamente vía
     * `ModelAccuracyMetrics.summarizeModelAccuracy()`, nunca
     * recalculado aquí). `recentRawMaeHours` es un insumo adicional
     * -- necesario para las reglas de las secciones 6/9 -- que
     * deliberadamente NO se expone en el bloque `recent` de la
     * respuesta (la sección 12 solo muestra maeHours/biasHours/
     * sampleSize del escenario CALIBRADO ahí).
     */
    static buildHealthReport({ calibrationId, modelType, recipeVersionId, status, historical, recent, previousWindow, recentRawMaeHours }) {

        const maeChangePercentage =
            this.computeMaeChangePercentage(historical.maeHours, recent.maeHours);

        const trend =
            this.computeTrend(previousWindow.sampleSize, previousWindow.maeHours, recent.sampleSize, recent.maeHours);

        const health =
            this.classifyHealth({

                recentSampleSize: recent.sampleSize,

                recentRawMaeHours,

                recentCalibratedMaeHours: recent.maeHours,

                recentCalibratedBiasHours: recent.biasHours,

                historicalCalibratedMaeHours: historical.maeHours

            });

        const recommendRecalibration =
            this.shouldRecommendRecalibration(recent.sampleSize, health);

        return {

            calibrationId,

            modelType,

            recipeVersionId,

            status,

            health,

            historical,

            recent,

            previousWindow,

            maeChangePercentage,

            trend,

            recommendRecalibration

        };

    }

}

CalibrationHealth.RECENT_WINDOW_SIZE =
    RECENT_WINDOW_SIZE;

CalibrationHealth.MIN_RECENT_SAMPLE_SIZE =
    MIN_RECENT_SAMPLE_SIZE;

CalibrationHealth.HEALTHY_BIAS_THRESHOLD_HOURS =
    HEALTHY_BIAS_THRESHOLD_HOURS;

CalibrationHealth.DEGRADED_HISTORICAL_DRIFT_PERCENTAGE =
    DEGRADED_HISTORICAL_DRIFT_PERCENTAGE;

CalibrationHealth.RECALIBRATION_MIN_SAMPLE_SIZE =
    RECALIBRATION_MIN_SAMPLE_SIZE;

module.exports =
    CalibrationHealth;
