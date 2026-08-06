const SequelizeRepository =
    require("./SequelizeRepository");

const RecipeIngredient =
    require("../models/RecipeIngredient");

class RecipeIngredientRepository
    extends SequelizeRepository {

    constructor() {

        super(RecipeIngredient);

    }

    async findByRecipeVersion(recipeVersionId) {

        return await this.model.findAll({

            where: {

                recipeVersionId

            },

            include: [

                {

                    association: "ingredient"

                },

                {

                    association: "unit"

                }

            ],

            order: [

                ["sortOrder", "ASC"]

            ]

        });

    }

}

module.exports =
    RecipeIngredientRepository;