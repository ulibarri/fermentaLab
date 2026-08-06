const SequelizeRepository = require("./SequelizeRepository");
const ProductionBatch = require("../models/ProductionBatch");
const { Op } = require("sequelize");

class ProductionBatchRepository
    extends SequelizeRepository {

    constructor() {

        super(ProductionBatch);

    }
    async nextSequence(prefix, date) {

        const count =
            await this.model.count({

                where: {

                    batchNumber: {

                        [Op.like]:
                            `${prefix}-${date}-%`

                    }

                }

            });

        return count + 1;

    }

}

module.exports =
    ProductionBatchRepository;