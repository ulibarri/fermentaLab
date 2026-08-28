const { Op } = require("sequelize");

const SequelizeRepository =
    require("./SequelizeRepository");

const ProductionBatch =
    require("../models/ProductionBatch");

const FermentationDashboard =
    require("../utils/FermentationDashboard");

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

    /*
     * Entrega 2.7.0.4, secciones 8/14 -- lotes "monitorizables" para el
     * panel operativo: solo los estados de
     * FermentationDashboard.MONITORABLE_STATUSES (nunca PLANNED/
     * F2_DONE/F2_SKIPPED/CANCELLED). Incluye la misma cadena
     * recipeVersion->recipe->product que findAll()/findById() (para
     * "producto/receta", sección 4) -- pero NUNCA measurements/
     * predictions/alerts: esos se resuelven aparte, una fila a la vez,
     * vía los métodos "lean" de sus propios repositorios (findLatestByBatch(),
     * findCurrentByBatch(), findActiveByBatch()), justamente para no
     * cargar el historial completo de nadie en esta consulta (sección
     * 14, criterio de aceptación explícito de rendimiento).
     */
    async findActiveForDashboard() {

        return await this.model.findAll({

            where: {

                status: { [Op.in]: FermentationDashboard.MONITORABLE_STATUSES }

            },

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

                ["createdAt", "ASC"]

            ]

        });

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