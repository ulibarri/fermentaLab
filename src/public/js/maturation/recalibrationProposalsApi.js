/*
 * Cliente de los 4 endpoints REST de propuestas de recalibración
 * (Entrega 2.6.1.24, sección 11).
 */
class MaturationRecalibrationProposalsApi {

    buildQuery(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.modelType) {

            params.set("modelType", filters.modelType);

        }

        if (filters.productId) {

            params.set("productId", filters.productId);

        }

        if (filters.status) {

            params.set("status", filters.status);

        }

        if (filters.createdBy) {

            params.set("createdBy", filters.createdBy);

        }

        if (filters.from) {

            params.set("from", filters.from);

        }

        if (filters.to) {

            params.set("to", filters.to);

        }

        const query =
            params.toString();

        return query ? `?${query}` : "";

    }

    async list(filters = {}) {

        const response =
            await Api.get(`/api/maturation/recalibration-proposals${this.buildQuery(filters)}`);

        return response.data;

    }

    async detail(id) {

        const response =
            await Api.get(`/api/maturation/recalibration-proposals/${id}`);

        return response.data;

    }

    async approve(id, payload = {}) {

        const response =
            await Api.post(`/api/maturation/recalibration-proposals/${id}/approve`, payload);

        return response.data;

    }

    async reject(id, payload = {}) {

        const response =
            await Api.post(`/api/maturation/recalibration-proposals/${id}/reject`, payload);

        return response.data;

    }

    /*
     * Entrega 2.6.1.25, sección 11 -- endpoint propio del namespace de
     * propuestas (nunca el genérico /calibrations/:id/activate).
     */
    async activate(id, payload = {}) {

        const response =
            await Api.post(`/api/maturation/recalibration-proposals/${id}/activate`, payload);

        return response.data;

    }

}
