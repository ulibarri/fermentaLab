class CrudApi {

    constructor(baseUrl) {

        this.baseUrl = baseUrl;

    }

    async getAll() {

        const response = await Api.get(this.baseUrl);

        return response.data;

    }

    async get(id) {

        const response = await Api.get(

            `${this.baseUrl}/${id}`

        );

        return response.data;

    }

    async create(entity) {

        const response = await Api.post(

            this.baseUrl,

            entity

        );

        return response.data;

    }

    async update(id, entity) {

        const response = await Api.put(

            `${this.baseUrl}/${id}`,

            entity

        );

        return response.data;

    }

    async delete(id) {

        const response = await Api.delete(

            `${this.baseUrl}/${id}`

        );

        return response.data;

    }

}