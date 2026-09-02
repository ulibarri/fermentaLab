/*
 * Cliente de "Reporte consolidado" (Entrega 2.7.0.9). Un único
 * endpoint agregado -- mismo criterio que PredictionAlertTrendApi
 * (2.7.0.8)/OperationalActionAnalyticsApi (2.7.0.7): el frontend nunca
 * compone varias llamadas ni calcula métricas por su cuenta.
 */
class OperationalReportApi {

    buildQuery(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.from) {

            params.set("from", filters.from);

        }

        if (filters.to) {

            params.set("to", filters.to);

        }

        if (filters.productId) {

            params.set("productId", filters.productId);

        }

        const query =
            params.toString();

        return query ? `?${query}` : "";

    }

    async report(filters = {}) {

        const response =
            await Api.get(`/api/analytics/operational-report${this.buildQuery(filters)}`);

        return response.data;

    }

}
