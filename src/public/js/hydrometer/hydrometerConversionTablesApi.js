/*
 * Entrega 2.8.0.2 -- cliente API de la pantalla administrativa. Mismo
 * patrón que `MaturationCalibrationsApi`/`OperationalReportApi`: sin
 * código de DOM, solo envoltorios delgados sobre `Api.get/post`.
 */
class HydrometerConversionTablesApi {

    list(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.instrument) {

            params.set("instrument", filters.instrument);

        }

        if (filters.status) {

            params.set("status", filters.status);

        }

        const query =
            params.toString();

        return Api.get(`/api/hydrometer/tables${query ? "?" + query : ""}`)
            .then(response => response.data);

    }

    getById(id) {

        return Api.get(`/api/hydrometer/tables/${id}`)
            .then(response => response.data);

    }

    create(payload) {

        return Api.post("/api/hydrometer/tables", payload)
            .then(response => response.data);

    }

    /*
     * Sección 16 -- import de archivo (multipart). No pasa por `Api`
     * (siempre serializa a JSON y fuerza `Content-Type:
     * application/json`) -- se usa `fetch` directo con `FormData`,
     * dejando que el navegador arme el boundary multipart. `file`
     * puede ser un `File` real (input type="file") o un `Blob`
     * construido a mano a partir del texto pegado en el textarea de
     * "pegar CSV" (mismo endpoint para ambos casos, ver
     * hydrometerConversionTables.js).
     */
    async importCsv(file, meta = {}) {

        const formData =
            new FormData();

        formData.append("file", file, file.name || "tabla.csv");

        Object.entries(meta).forEach(([key, value]) => {

            if (value !== undefined && value !== null && value !== "") {

                formData.append(key, value);

            }

        });

        const response =
            await fetch("/api/hydrometer/tables/import", {

                method: "POST",

                body: formData

            });

        const data =
            await response.json();

        if (!response.ok) {

            const error =
                new Error(data.message || "No se pudo importar el archivo.");

            error.data = data;

            throw error;

        }

        return data.data;

    }

    validate(id, validatedBy) {

        return Api.post(`/api/hydrometer/tables/${id}/validate`, { validatedBy })
            .then(response => response.data);

    }

    activate(id, activatedBy) {

        return Api.post(`/api/hydrometer/tables/${id}/activate`, { activatedBy })
            .then(response => response.data);

    }

    simulate(id, { scale, value }) {

        return Api.post(`/api/hydrometer/tables/${id}/simulate`, { scale, value })
            .then(response => response.data);

    }

}
