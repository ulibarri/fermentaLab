class BatchApi extends CrudApi {

    constructor() {

        super("/api/batches");

    }
    async start(id) {

        const response = await Api.put(

            `${this.baseUrl}/${id}/start`,

            {}

        );

        return response.data;

    }
    async complete(id, data) {

        const response = await Api.put(

            `${this.baseUrl}/${id}/complete`,

            data

        );

        return response.data;

    }

    async startSecondFermentation(id) {

        const response = await Api.put(

            `${this.baseUrl}/${id}/second-fermentation/start`,

            {}

        );

        return response.data;

    }

    async finishSecondFermentation(id, data) {

        const response = await Api.put(

            `${this.baseUrl}/${id}/second-fermentation/finish`,

            data

        );

        return response.data;

    }

    async cancel(id, data) {

        const response = await Api.delete(

            `${this.baseUrl}/${id}`,

            data

        );

        return response.data;

    }

}