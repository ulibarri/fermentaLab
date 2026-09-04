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

    async getMaturation() {

        const response = await Api.get(

            `/api/batches/${this.batchId}/maturation`

        );

        return response.data;

    }

    async getMaturationEvaluation() {

        const response = await Api.get(

            `/api/batches/${this.batchId}/maturation/evaluation`

        );

        return response.data;

    }

    // Entrega 2.8.0.4, sección 7 -- auditoría de hidrómetro por lote
    // (Brix derivado vía tabla del fabricante vs. Brix real de
    // BrixMate). Mismo molde que getMaturation()/getMaturationEvaluation()
    // de arriba -- solo lectura, nunca envía ningún payload.
    async getHydrometerAudit() {

        const response = await Api.get(

            `/api/batches/${this.batchId}/hydrometer/audit`

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
