const BaseService =
    require("./BaseService");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const VALID_PHASES = ["F1", "F2", "FINAL"];

class ProductionMeasurementService
    extends BaseService {

    constructor() {

        super(

            new ProductionMeasurementRepository()

        );

        this.batchRepository =
            new ProductionBatchRepository();

    }

    validate(data) {

        if (!data) {

            throw new Error("No se recibieron datos.");

        }

        if (!data.measurementDate) {

            throw new Error("measurementDate es obligatoria.");

        }

        if (!data.phase) {

            throw new Error("phase es obligatoria.");

        }

        if (!VALID_PHASES.includes(data.phase)) {

            throw new Error(
                `phase debe ser una de: ${VALID_PHASES.join(", ")}.`
            );

        }

        if (data.ph !== undefined && data.ph !== null) {

            if (data.ph < 0 || data.ph > 14) {

                throw new Error("ph debe estar entre 0 y 14.");

            }

        }

        if (data.brix !== undefined && data.brix !== null) {

            if (data.brix < 0) {

                throw new Error("brix debe ser mayor o igual a 0.");

            }

        }

        if (data.specificGravity !== undefined && data.specificGravity !== null) {

            if (data.specificGravity <= 0) {

                throw new Error("specificGravity debe ser mayor a 0.");

            }

        }

        if (data.psi !== undefined && data.psi !== null) {

            if (data.psi < 0) {

                throw new Error("psi debe ser mayor o igual a 0.");

            }

        }

    }

    buildValues(data) {

        return {

            measurementDate: data.measurementDate,

            phase: data.phase,

            ph: data.ph ?? null,

            brix: data.brix ?? null,

            specificGravity: data.specificGravity ?? null,

            estimatedAlcohol: data.estimatedAlcohol ?? null,

            liquidTemperature: data.liquidTemperature ?? null,

            ambientTemperature: data.ambientTemperature ?? null,

            psi: data.psi ?? null,

            notes: data.notes ?? null

        };

    }

    async findByBatch(batchId) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        return await this.repository.findByBatch(batchId);

    }

    async createForBatch(batchId, data) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        if (batch.status === "PLANNED") {

            throw new Error(
                "No se pueden agregar mediciones a lotes en estado PLANNED."
            );

        }

        this.validate(data);

        return await this.repository.create({

            productionBatchId: batchId,

            ...this.buildValues(data)

        });

    }

    async update(id, data) {

        const measurement =
            await this.repository.findById(id);

        if (!measurement) {

            throw new Error("Measurement not found");

        }

        this.validate(data);

        return await this.repository.update(

            id,

            this.buildValues(data)

        );

    }

    async delete(id) {

        const measurement =
            await this.repository.findById(id);

        if (!measurement) {

            throw new Error("Measurement not found");

        }

        return await this.repository.delete(id);

    }

}

module.exports =
    ProductionMeasurementService;
