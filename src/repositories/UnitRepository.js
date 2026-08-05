const SequelizeRepository =
    require("./SequelizeRepository");

const Unit =
    require("../models/Unit");

class UnitRepository
    extends SequelizeRepository {

    constructor() {

        super(Unit);

    }

    async findByCode(code) {

        return await this.model.findOne({

            where: {

                code

            }

        });

    }

}

module.exports = UnitRepository;