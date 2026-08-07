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

}

module.exports =
    ProductionMeasurementRepository;
