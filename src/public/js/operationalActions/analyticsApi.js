/*
 * Cliente de "Análisis de acciones operativas" (Entrega 2.7.0.7,
 * Acción 9). Un único endpoint agregado -- el frontend nunca compone
 * varias llamadas ni calcula métricas por su cuenta (spec explícito:
 * "el frontend no debe calcular las métricas agregadas").
 */
class OperationalActionAnalyticsApi {

    buildQuery(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.from) {

            params.set("from", filters.from);

        }

        if (filters.to) {

            params.set("to", filters.to);

        }

        if (filters.actionType) {

            params.set("actionType", filters.actionType);

        }

        if (filters.effectivenessStatus) {

            params.set("effectivenessStatus", filters.effectivenessStatus);

        }

        if (filters.alertSeverity) {

            params.set("alertSeverity", filters.alertSeverity);

        }

        if (filters.productId) {

            params.set("productId", filters.productId);

        }

        const query =
            params.toString();

        return query ? `?${query}` : "";

    }

    async analytics(filters = {}) {

        const response =
            await Api.get(`/api/operational-actions/analytics${this.buildQuery(filters)}`);

        return response.data;

    }

}
