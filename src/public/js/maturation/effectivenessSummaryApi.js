/*
 * Cliente del endpoint de análisis global del proceso de recalibración
 * (Entrega 2.6.1.33, sección 15). Solo tres filtros -- los mismos tres
 * que soporta el servidor (`model`/`dateFrom`/`dateTo`); cualquier otro
 * filtro de la sección 12 (estado/calibración/resultado/nivel de
 * efectividad) se aplica del lado del cliente sobre `records`, ver
 * effectivenessSummary.js.
 */
class RecalibrationEffectivenessSummaryApi {

    buildQuery(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.model) {

            params.set("model", filters.model);

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

    async getSummary(filters = {}) {

        const response =
            await Api.get(`/api/maturation/calibrations/effectiveness-summary${this.buildQuery(filters)}`);

        return response.data;

    }

}
