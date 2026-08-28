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

    /*
     * Entrega 2.7.0.1, secciones 1-6 -- estado operativo en vivo del
     * lote (rango de confianza / cerca del límite / fuera de
     * predicción, más alerta de deriva). Capa separada de todo lo
     * anterior en este archivo (que es trazabilidad/auditoría del
     * MODELO) -- ver el comentario de cabecera de
     * BatchOperationalPredictionService.js.
     */
    async getOperationalStatus() {

        const response = await Api.get(

            `/api/maturation/batches/${this.batchId}/operational-status`

        );

        return response.data;

    }

    /*
     * Entrega 2.7.0.3, sección 13 -- alertas de desviación de la
     * fermentación (capa OPERATIVA de lote, independiente de todo lo
     * anterior en este archivo). Namespace propio pedido literalmente
     * por el spec ("/api/batches/:id/prediction-alerts"), distinto del
     * "/api/maturation/..." que usa el resto de este cliente.
     */
    async getAlertHistory() {

        const response = await Api.get(

            `/api/batches/${this.batchId}/prediction-alerts`

        );

        return response.data;

    }

    async getActiveAlert() {

        const response = await Api.get(

            `/api/batches/${this.batchId}/prediction-alerts/active`

        );

        return response.data;

    }

    /*
     * Entrega 2.7.0.5, sección 13 -- acciones operativas de UNA alerta
     * (namespace por-alerta, "/api/prediction-alerts/:id/actions",
     * distinto de "/api/batches/:id/prediction-alerts" de arriba que es
     * por-lote). No usa `this.batchId` -- se llama con el id de la
     * alerta concreta, resuelta desde la tarjeta de estado o desde una
     * fila del historial ya cargado en el cliente.
     */
    async getAlertActions(alertId) {

        const response = await Api.get(

            `/api/prediction-alerts/${alertId}/actions`

        );

        return response.data;

    }

    async createAlertAction(alertId, payload) {

        const response = await Api.post(

            `/api/prediction-alerts/${alertId}/actions`,

            payload

        );

        return response.data;

    }

}
