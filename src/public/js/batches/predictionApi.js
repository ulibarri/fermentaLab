/*
 * Cliente de la API de trazabilidad de predicciones (Entrega 2.6.1.12).
 * Mismo patrón que MeasurementApi: una clase liviana por lote, sin
 * lógica de presentación.
 */
class PredictionApi {

    constructor(batchId) {

        this.batchId = batchId;

    }

    async getHistory() {

        const response = await Api.get(

            `/api/maturation/predictions/batch/${this.batchId}`

        );

        return response.data;

    }

    async getDetail(predictionId) {

        const response = await Api.get(

            `/api/maturation/predictions/${predictionId}`

        );

        return response.data;

    }

    /*
     * Entrega 2.6.1.13 -- Predicción vs. Real: todas las predicciones
     * del lote, cada una ya evaluada contra la misma maduración real
     * (orden cronológico ascendente). Superconjunto de getHistory():
     * incluye todo lo que esa devuelve más errorHours/direction/etc.,
     * así que la vista de historial usa esta llamada en vez de las dos.
     */
    async getBatchAnalysis() {

        const response = await Api.get(

            `/api/maturation/batches/${this.batchId}/prediction-analysis`

        );

        return response.data;

    }

    async getEvaluation(predictionId) {

        const response = await Api.get(

            `/api/maturation/predictions/${predictionId}/evaluation`

        );

        return response.data;

    }

    /*
     * Entrega 2.6.1.18, sección 18 -- salud EN VIVO de la calibración
     * que esta predicción usó (no del lote), para el indicador
     * WARNING/DEGRADED en la tarjeta/detalle de predicción. No es
     * batch-scoped como el resto de este cliente -- se llama con el
     * calibrationId que ya viene resuelto en `prediction.calibration`.
     */
    async getCalibrationHealth(calibrationId) {

        const response = await Api.get(

            `/api/maturation/calibrations/${calibrationId}/health`

        );

        return response.data;

    }

}
