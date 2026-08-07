class MeasurementApi {

    constructor(batchId) {

        this.batchId = batchId;

    }

    async getAll() {

        const response = await Api.get(

            `/api/batches/${this.batchId}/measurements`

        );

        return response.data;

    }

    async create(entity) {

        const response = await Api.post(

            `/api/batches/${this.batchId}/measurements`,

            entity

        );

        return response.data;

    }

    async update(id, entity) {

        const response = await Api.put(

            `/api/measurements/${id}`,

            entity

        );

        return response.data;

    }

    async delete(id) {

        const response = await Api.delete(

            `/api/measurements/${id}`

        );

        return response.data;

    }

}
