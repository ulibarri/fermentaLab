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

                    // Entrega 2.6.1.16 -- se agrega el `product` anidado
                    // (además de `recipe`, ya existente) porque la
                    // pantalla de gestión de calibraciones necesita
                    // etiquetar cada versión de receta como "Producto /
                    // Receta (vN)" -- no solo "Receta (vN)" como hasta
                    // ahora. Aditivo: ningún consumidor existente
                    // (formulario de lotes) lee `recipe.product`, así
                    // que esto no cambia su comportamiento.
                    association: "recipe",

                    include: [

                        {

                            association: "product"

                        }

                    ]

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

                        // Entrega 2.6.1.20 -- se agrega `product`
                        // anidado (mismo criterio aditivo que
                        // `findAll()` desde 2.6.1.16): el dashboard de
                        // desempeño necesita etiquetar "Producto /
                        // Receta (vN)" a partir de un solo
                        // recipeVersionId, sin una segunda consulta.
                        // Ningún llamador existente (los dos
                        // `_requireRecipeVersion()` de
                        // MaturationModelCalibrationService/
                        // MaturationModelConfigurationService) lee
                        // `recipe.product`, así que esto no cambia su
                        // comportamiento.
                        association: "recipe",

                        include: [

                            {

                                association: "product"

                            }

                        ]

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