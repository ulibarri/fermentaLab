class Api {

    static async request(url, options = {}) {

        try {

            const response = await fetch(url, {

                headers: {
                    "Content-Type": "application/json",
                    ...(options.headers || {})
                },

                ...options

            });

            const data = await response.json();

            if (!response.ok) {

                const error = new Error(
                    data.message || "Error en la petición."
                );

                // Entrega 2.6.1.23 -- algunos endpoints (ej. la
                // propuesta de recalibración duplicada) responden con un
                // código HTTP específico (409) y datos extra en el body
                // (ej. `existingProposal`) que el llamador necesita para
                // reaccionar distinto de un error genérico. Aditivo:
                // ningún código existente lee estas dos propiedades, así
                // que esto no cambia el comportamiento de nadie más.
                error.statusCode = response.status;
                error.data = data;

                throw error;

            }

            return data;

        }
        catch (err) {

            console.error(err);

            throw err;

        }

    }

    static get(url) {

        return this.request(url);

    }

    static post(url, body) {

        return this.request(url, {

            method: "POST",

            body: JSON.stringify(body)

        });

    }

    static put(url, body) {

        return this.request(url, {

            method: "PUT",

            body: JSON.stringify(body)

        });

    }

    static delete(url, body) {

        return this.request(url, {

            method: "DELETE",

            ...(body !== undefined
                ? { body: JSON.stringify(body) }
                : {})

        });

    }

}