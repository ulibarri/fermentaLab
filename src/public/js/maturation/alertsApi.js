/*
 * Cliente de los 4 endpoints REST de alertas y recomendaciones de
 * recalibración (Entrega 2.6.1.21, sección 12).
 */
class MaturationAlertsApi {

    async getAlerts(modelId) {

        const response =
            await Api.get(`/api/maturation/models/${modelId}/alerts`);

        return response.data;

    }

    async acknowledge(id) {

        const response =
            await Api.post(`/api/maturation/alerts/${id}/acknowledge`, {});

        return response.data;

    }

    async resolve(id) {

        const response =
            await Api.post(`/api/maturation/alerts/${id}/resolve`, {});

        return response.data;

    }

    async createRecalibrationProposal(modelId, payload = {}) {

        const response =
            await Api.post(`/api/maturation/models/${modelId}/recalibration-proposal`, payload);

        return response.data;

    }

}
