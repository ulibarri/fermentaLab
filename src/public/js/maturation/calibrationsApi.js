/*
 * Cliente de los 7 endpoints REST de MaturationModelCalibration
 * (Entrega 2.6.1.16, sección 12) bajo /api/maturation/calibrations.
 */
class MaturationCalibrationsApi {

    buildQuery(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.modelType) {

            params.set("modelType", filters.modelType);

        }

        if (filters.recipeVersionId !== null && filters.recipeVersionId !== undefined && filters.recipeVersionId !== "") {

            params.set("recipeVersionId", filters.recipeVersionId);

        }

        if (filters.status) {

            params.set("status", filters.status);

        }

        const query =
            params.toString();

        return query ? `?${query}` : "";

    }

    async list(filters = {}) {

        const response =
            await Api.get(`/api/maturation/calibrations${this.buildQuery(filters)}`);

        return response.data;

    }

    async create(payload) {

        const response =
            await Api.post("/api/maturation/calibrations", payload);

        return response.data;

    }

    async detail(id) {

        const response =
            await Api.get(`/api/maturation/calibrations/${id}`);

        return response.data;

    }

    async update(id, payload) {

        const response =
            await Api.put(`/api/maturation/calibrations/${id}`, payload);

        return response.data;

    }

    async approve(id) {

        const response =
            await Api.post(`/api/maturation/calibrations/${id}/approve`, {});

        return response.data;

    }

    async activate(id) {

        const response =
            await Api.post(`/api/maturation/calibrations/${id}/activate`, {});

        return response.data;

    }

    async deactivate(id) {

        const response =
            await Api.post(`/api/maturation/calibrations/${id}/deactivate`, {});

        return response.data;

    }

    async reject(id) {

        const response =
            await Api.post(`/api/maturation/calibrations/${id}/reject`, {});

        return response.data;

    }

    /*
     * Entrega 2.6.1.17 -- evaluación de efectividad (sección 15).
     */

    async getEvaluation(id) {

        const response =
            await Api.get(`/api/maturation/calibrations/${id}/evaluation`);

        return response.data;

    }

    async getEvaluationHistory(id) {

        const response =
            await Api.get(`/api/maturation/calibrations/${id}/evaluations`);

        return response.data;

    }

    async createEvaluation(id) {

        const response =
            await Api.post(`/api/maturation/calibrations/${id}/evaluate`, {});

        return response.data;

    }

    /*
     * Entrega 2.6.1.18 -- monitoreo continuo (sección 16).
     */

    async getHealth(id) {

        const response =
            await Api.get(`/api/maturation/calibrations/${id}/health`);

        return response.data;

    }

    async getAllActiveHealth() {

        const response =
            await Api.get(`/api/maturation/calibrations/health`);

        return response.data;

    }

    /*
     * Entrega 2.6.1.27 -- evaluación post-activación (secciones 1-9).
     */

    async getPostActivationEvaluation(id) {

        const response =
            await Api.get(`/api/maturation/calibrations/${id}/post-activation-evaluation`);

        return response.data;

    }

    /*
     * Entrega 2.6.1.19 -- versionado y reemplazo controlado (sección
     * 13).
     */

    async getVersionChain(id) {

        const response =
            await Api.get(`/api/maturation/calibrations/${id}/versions`);

        return response.data;

    }

    async getComparison(id, otherId) {

        const response =
            await Api.get(`/api/maturation/calibrations/${id}/comparison/${otherId}`);

        return response.data;

    }

    async createReplacement(id, payload) {

        const response =
            await Api.post(`/api/maturation/calibrations/${id}/create-replacement`, payload);

        return response.data;

    }

}
