/*
 * Cliente del endpoint de evolución del modelo (Entrega 2.6.1.31,
 * sección 13).
 */
class MaturationModelHistoryApi {

    buildQuery(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.modelType) {

            params.set("modelType", filters.modelType);

        }

        if (filters.recipeVersionId) {

            params.set("recipeVersionId", filters.recipeVersionId);

        }

        if (filters.dateFrom) {

            params.set("dateFrom", filters.dateFrom);

        }

        if (filters.dateTo) {

            params.set("dateTo", filters.dateTo);

        }

        const query =
            params.toString();

        return query ? `?${query}` : "";

    }

    async getHistory(filters = {}) {

        const response =
            await Api.get(`/api/maturation/calibrations/history${this.buildQuery(filters)}`);

        return response.data;

    }

}
