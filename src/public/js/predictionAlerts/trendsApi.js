/*
 * Cliente de "Tendencias de alertas" (Entrega 2.7.0.8, Acción 15). Un
 * único endpoint agregado -- mismo criterio que
 * OperationalActionAnalyticsApi (2.7.0.7)/FermentationDashboardApi
 * (2.7.0.4): el frontend nunca compone varias llamadas ni calcula
 * métricas por su cuenta.
 */
class PredictionAlertTrendApi {

    buildQuery(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.from) {

            params.set("from", filters.from);

        }

        if (filters.to) {

            params.set("to", filters.to);

        }

        if (filters.severity) {

            params.set("severity", filters.severity);

        }

        if (filters.status) {

            params.set("status", filters.status);

        }

        if (filters.productId) {

            params.set("productId", filters.productId);

        }

        if (filters.phase) {

            params.set("phase", filters.phase);

        }

        if (filters.groupBy) {

            params.set("groupBy", filters.groupBy);

        }

        const query =
            params.toString();

        return query ? `?${query}` : "";

    }

    async analytics(filters = {}) {

        const response =
            await Api.get(`/api/prediction-alerts/analytics${this.buildQuery(filters)}`);

        return response.data;

    }

}
