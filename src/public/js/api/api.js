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

                throw new Error(
                    data.message || "Error en la petición."
                );

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