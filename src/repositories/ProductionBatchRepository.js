const { Op } = require("sequelize");

const SequelizeRepository =
    require("./SequelizeRepository");

const ProductionBatch =
    require("../models/ProductionBatch");

class ProductionBatchRepository
    extends SequelizeRepository {

    constructor() {

        super(ProductionBatch);

    }

    async findAll() {

        return await this.model.findAll({

            include: [

                {

                    association: "recipeVersion",

                    include: [

                        {

                            association: "recipe",

                            include: [

                                {

                                    association: "product",

                                    include: [

                                        {

                                            association: "category"

                                        }

                                    ]

                                }

                            ]

                        }

                    ]

                }

            ],

            order: [

                ["createdAt", "DESC"]

            ]

        });

    }

    async findById(id) {

        return await this.model.findByPk(

            id,

            {

                include: [

                    {

                        association: "recipeVersion",

                        include: [

                            {

                                association: "recipe",

                                include: [

                                    {

                                        association: "product",

                                        include: [

                                            {

                                                association: "category"

                                            }

                                        ]

                                    }

                                ]

                            }

                        ]

                    }

                ]

            }

        );

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