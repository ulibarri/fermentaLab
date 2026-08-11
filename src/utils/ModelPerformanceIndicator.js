/*
 * Indicador global de desempeño del modelo (Entrega 2.6.1.20, sección
 * 8). Módulo puro (sin Sequelize ni Express) -- resume en un solo
 * semáforo GOOD/WARNING/POOR/INSUFFICIENT_DATA lo que el dashboard ya
 * muestra en detalle (MAE raw vs. calibrated + salud de la
 * calibración activa), reutilizando exactamente esos dos insumos ya
 * calculados -- nunca recalcula MAE ni salud aquí (mismo criterio de
 * "aceptar insumos ya resumidos" que `CalibrationEffectiveness.js`/
 * `CalibrationHealth.js`).
 */

// Mismo mínimo de muestra que el resto del proyecto (2.6.1.3/2.6.1.7/
// 2.6.1.14/2.6.1.15) -- por debajo de esto, ningún indicador GOOD/
// WARNING/POOR se declara, sin importar qué tan bien luzcan los
// números.
const MIN_SAMPLE_SIZE = 5;

class ModelPerformanceIndicator {

    /*
     * Sección 8, en orden de prioridad (el primero que aplique gana):
     *
     *   1. sampleSize < 5, o falta maeRaw/maeCalibrated  -> INSUFFICIENT_DATA
     *      (el spec solo dice "cuando no tengamos suficientes
     *      evaluaciones" -- se reutiliza el mismo umbral de 5 del
     *      resto del proyecto en vez de inventar uno nuevo).
     *   2. calibrationHealth ausente (nunca hubo una calibración
     *      activa para este modelo/receta)               -> INSUFFICIENT_DATA
     *      (las cuatro reglas GOOD/WARNING/POOR del spec están
     *      literalmente definidas en términos del health de la
     *      calibración -- sin una calibración no hay ninguna regla
     *      aplicable, así que declarar GOOD/WARNING/POOR aquí sería
     *      fabricar una lectura que el spec no define. Judgment call,
     *      documentado.)
     *   3. calibrationHealth === "INSUFFICIENT_DATA"       -> INSUFFICIENT_DATA
     *      (propaga directamente -- ver CalibrationHealth.js).
     *   4. maeCalibrated >= maeRaw, o
     *      calibrationHealth === "DEGRADED"                -> POOR
     *   5. maeCalibrated < maeRaw y
     *      calibrationHealth === "WARNING"                 -> WARNING
     *   6. maeCalibrated < maeRaw y
     *      calibrationHealth === "HEALTHY"                 -> GOOD
     *   7. cualquier otro caso (defensivo, no debería ocurrir dado lo
     *      anterior)                                       -> WARNING
     */
    static classifyIndicator({ sampleSize, maeRaw, maeCalibrated, calibrationHealth }) {

        if (!sampleSize || sampleSize < MIN_SAMPLE_SIZE) {

            return "INSUFFICIENT_DATA";

        }

        if (maeRaw === null || maeRaw === undefined || maeCalibrated === null || maeCalibrated === undefined) {

            return "INSUFFICIENT_DATA";

        }

        if (!calibrationHealth) {

            return "INSUFFICIENT_DATA";

        }

        if (calibrationHealth === "INSUFFICIENT_DATA") {

            return "INSUFFICIENT_DATA";

        }

        const calibratedIsBetter =
            maeCalibrated < maeRaw;

        if (!calibratedIsBetter || calibrationHealth === "DEGRADED") {

            return "POOR";

        }

        if (calibrationHealth === "WARNING") {

            return "WARNING";

        }

        if (calibrationHealth === "HEALTHY") {

            return "GOOD";

        }

        return "WARNING";

    }

}

ModelPerformanceIndicator.MIN_SAMPLE_SIZE =
    MIN_SAMPLE_SIZE;

module.exports =
    ModelPerformanceIndicator;
