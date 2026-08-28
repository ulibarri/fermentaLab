/*
 * Cliente del panel operativo de fermentaciones (Entrega 2.7.0.4,
 * sección 13). Un único endpoint agregado -- nunca compone
 * /api/batches + /api/measurements + /api/maturation por separado
 * (sección 13, requisito explícito).
 */
class FermentationDashboardApi {

    buildQuery(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.phase) {

            params.set("phase", filters.phase);

        }

        if (filters.severity) {

            params.set("severity", filters.severity);

        }

        if (filters.alertsOnly !== undefined && filters.alertsOnly !== null && filters.alertsOnly !== "") {

            params.set("alertsOnly", filters.alertsOnly);

        }

        if (filters.productId) {

            params.set("productId", filters.productId);

        }

        const query =
            params.toString();

        return query ? `?${query}` : "";

    }

    async active(filters = {}) {

        const response =
            await Api.get(`/api/fermentations/active${this.buildQuery(filters)}`);

        return response.data;

    }

}
