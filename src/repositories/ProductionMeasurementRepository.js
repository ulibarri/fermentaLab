const SequelizeRepository =
    require("./SequelizeRepository");

const ProductionMeasurement =
    require("../models/ProductionMeasurement");

class ProductionMeasurementRepository
    extends SequelizeRepository {

    constructor() {

        super(ProductionMeasurement);

    }

    async findByBatch(productionBatchId) {

        return await this.model.findAll({

            where: {

                productionBatchId

            },

            order: [

                ["measurementDate", "ASC"]

            ]

        });

    }

    async existsByBatchAndPhase(productionBatchId, phase) {

        const count = await this.model.count({

            where: {

                productionBatchId,

                phase

            }

        });

        return count > 0;

    }

}

module.exports =
    ProductionMeasurementRepository;
