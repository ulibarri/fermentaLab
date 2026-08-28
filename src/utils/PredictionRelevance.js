/*
 * Entrega 2.7.0.2, sección 2 -- "No debemos asumir que cualquier
 * medición modifica el modelo. La lógica deberá determinar cuáles son
 * las mediciones relevantes para la predicción de la fase
 * correspondiente."
 *
 * Módulo puro (sin Sequelize ni Express): decide si UNA medición
 * concreta, la que acaba de disparar el flujo de
 * ProductionMeasurementService.createForBatch(), justifica generar una
 * predicción nueva.
 *
 * Reutiliza recipeVersion.maturationMetric como ÚNICA fuente de verdad
 * de "qué variable usa el modelo de esta fase" -- el mismo campo que ya
 * consume MaturationCalculator.analyze() (2.6.0.7) y
 * MaturationPredictionService._buildInputSnapshot() (2.6.1.12). No se
 * declara aquí una segunda lista de "variables válidas": si mañana
 * maturationMetric cambia de valor permitido, este módulo lo sigue sin
 * necesitar ningún cambio.
 *
 * Sección 2, última línea: "Para F2 deberán utilizarse únicamente las
 * variables que correspondan al modelo de F2. No debemos introducir
 * nuevas variables predictivas en esta entrega" -- por eso `phase` es
 * un parámetro explícito (default "F1", el único caso real que dispara
 * predicciones hoy) en vez de asumirlo fijo dentro del módulo.
 */
class PredictionRelevance {

    /*
     * measurement       -- la medición recién guardada (con al menos
     *                       `phase` y el campo de maturationMetric).
     * phase             -- fase que corresponde a la predicción que se
     *                       está evaluando (default "F1").
     * maturationMetric  -- "ph" | "brix" | "specificGravity", tal como
     *                       viene de recipeVersion.maturationMetric.
     *
     * Regresa false (nunca lanza) cuando falta cualquier dato de
     * entrada -- "sin suficiente información para decidir" se trata
     * como "no relevante", nunca como "relevante por defecto" (mismo
     * criterio conservador que el resto del proyecto: nunca disparar
     * trabajo de más sin evidencia clara de que corresponde).
     */
    static isRelevant({ measurement, phase = "F1", maturationMetric }) {

        if (!measurement || !maturationMetric) {

            return false;

        }

        if (measurement.phase !== phase) {

            return false;

        }

        const value =
            measurement[maturationMetric];

        return value !== null && value !== undefined && value !== "";

    }

}

module.exports =
    PredictionRelevance;
