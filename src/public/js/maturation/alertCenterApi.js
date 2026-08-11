/*
 * Cliente de los endpoints del centro de alertas (Entrega 2.6.1.22,
 * sección 10/11) + los dos que ya existían desde 2.6.1.21
 * (acknowledge/resolve, "se mantienen" per la propia especificación).
 */
class MaturationAlertCenterApi {

    buildQuery(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.productId) {

            params.set("productId", filters.productId);

        }

        if (filters.recipeVersionId) {

            params.set("recipeVersionId", filters.recipeVersionId);

        }

        if (filters.modelId) {

            params.set("modelId", filters.modelId);

        }

        if (filters.severity) {

            params.set("severity", filters.severity);

        }

        if (filters.status) {

            params.set("status", filters.status);

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
            await Api.get(`/api/maturation/alerts${this.buildQuery(filters)}`);

        return response.data;

    }

    async summary(filters = {}) {

        const response =
            await Api.get(`/api/maturation/alerts/summary${this.buildQuery(filters)}`);

        return response.data;

    }

    async detail(id) {

        const response =
            await Api.get(`/api/maturation/alerts/${id}`);

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

    /*
     * Entrega 2.6.1.23, sección 7 -- mismo endpoint que ya usaba el
     * dashboard desde 2.6.1.21 (`POST /models/:modelId/
     * recalibration-proposal`), ahora también invocable desde el
     * Centro de Alertas. Puede responder 409 cuando ya existe una
     * propuesta equivalente -- `Api.request()` (2.6.1.23) adjunta
     * `err.statusCode`/`err.data` al error para que el llamador pueda
     * distinguir ese caso de un error genérico.
     */
    async createRecalibrationProposal(modelId, payload = {}) {

        const response =
            await Api.post(`/api/maturation/models/${modelId}/recalibration-proposal`, payload);

        return response.data;

    }

}
