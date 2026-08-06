const SequelizeRepository =
    require("./SequelizeRepository");

const Ingredient =
    require("../models/Ingredient");

class IngredientRepository
    extends SequelizeRepository {

    constructor() {

        super(Ingredient);

    }

    async findAll() {

        return await this.model.findAll({

            include: {

                association: "unit"

            }

        });

    }

    async findById(id) {

        return await this.model.findByPk(

            id,

            {

                include: {

                    association: "unit"

                }

            }

        );

    }

}

module.exports = IngredientRepository;