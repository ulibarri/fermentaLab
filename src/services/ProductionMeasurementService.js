const BaseService =
    require("./BaseService");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const CarbonationCalculator =
    require("../utils/CarbonationCalculator");

const MaturationCalculator =
    require("../utils/MaturationCalculator");

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

        if (data.brixLafmate !== undefined && data.brixLafmate !== null) {

            if (data.brixLafmate < 0) {

                throw new Error("brixLafmate debe ser mayor o igual a 0.");

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

    calculateCo2Volumes(phase, psi, ambientTemperature) {

        if (phase !== "F2") {

            return null;

        }

        if (psi === null || psi === undefined) {

            return null;

        }

        if (ambientTemperature === null || ambientTemperature === undefined) {

            return null;

        }

        try {

            const result =
                CarbonationCalculator.calculate({

                    psi,

                    temperature: ambientTemperature

                });

            return result.co2Volumes;

        } catch (err) {

            // No bloqueamos el guardado de la medición si la combinación
            // de PSI/temperatura queda fuera del dominio de la fórmula;
            // simplemente no se puede estimar el CO2 para esa lectura.

            return null;

        }

    }

    buildValues(data) {

        const isF2 =
            data.phase === "F2";

        const psi =
            isF2 ? (data.psi ?? null) : 0;

        const ambientTemperature =
            data.ambientTemperature ?? null;

        const co2Volumes =
            this.calculateCo2Volumes(

                data.phase,

                psi,

                ambientTemperature

            );

        return {

            measurementDate: data.measurementDate,

            phase: data.phase,

            ph: data.ph ?? null,

            brix: data.brix ?? null,

            brixLafmate: data.brixLafmate ?? null,

            specificGravity: data.specificGravity ?? null,

            estimatedAlcohol: data.estimatedAlcohol ?? null,

            liquidTemperature: data.liquidTemperature ?? null,

            ambientTemperature,

            psi,

            co2Volumes,

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

    async getMaturationPrediction(batchId, phase = "F1") {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        const recipeVersion =
            batch.recipeVersion;

        if (!recipeVersion || !recipeVersion.maturationMetric) {

            return {

                configured: false,

                message: "Este lote no tiene configurado un objetivo de maduración en su receta."

            };

        }

        const measurements =
            await this.repository.findByBatch(batchId);

        const toNumberOrNull = value =>

            value === null || value === undefined
                ? null
                : Number(value);

        const analysis =
            MaturationCalculator.analyze({

                measurements,

                metric: recipeVersion.maturationMetric,

                targetValue: toNumberOrNull(recipeVersion.maturationTarget),

                rateThreshold: toNumberOrNull(recipeVersion.maturationRateThreshold),

                targetTolerance: toNumberOrNull(recipeVersion.maturationTargetTolerance),

                phase

            });

        return {

            configured: true,

            ...analysis

        };

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
