const SequelizeRepository =
    require("./SequelizeRepository");

const RecipeVersion =
    require("../models/RecipeVersion");

class RecipeVersionRepository
    extends SequelizeRepository {

    constructor() {

        super(RecipeVersion);

    }
    async findAll() {

        return await this.model.findAll({

            include: [

                {

                    association: "recipe"

                },

                {

                    association: "batchUnit"

                }

            ]

        });

    }

    async findById(id) {

        return await this.model.findByPk(

            id,

            {

                include: [

                    {

                        association: "recipe"

                    },

                    {

                        association: "batchUnit"

                    }

                ]

            }

        );

    }

}

module.exports =
    RecipeVersionRepository;