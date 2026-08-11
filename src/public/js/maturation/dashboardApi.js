/*
 * Cliente del dashboard de desempeño del modelo (Entrega 2.6.1.20,
 * sección 10). Reutiliza directamente GET /api/maturation/models/status
 * (2.6.1.11) para poblar el selector "Modelo de maduración" a partir
 * de una versión de receta -- nunca se reimplementa esa consulta aquí.
 */
class MaturationDashboardApi {

    async getModelStatus(recipeVersionId) {

        const response =
            await Api.get(`/api/maturation/models/status?recipeVersionId=${recipeVersionId}`);

        return response.data;

    }

    async getDashboard(modelId, filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.period) {

            params.set("period", filters.period);

        }

        if (filters.calibrationId) {

            params.set("calibrationId", filters.calibrationId);

        }

        const query =
            params.toString();

        const response =
            await Api.get(`/api/maturation/models/${modelId}/dashboard${query ? `?${query}` : ""}`);

        return response.data;

    }

}
