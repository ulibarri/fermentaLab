const { Op } =
    require("sequelize");

const SequelizeRepository =
    require("./SequelizeRepository");

const ProductionAlertAction =
    require("../models/ProductionAlertAction");

/*
 * Repositorio de ProductionAlertAction (Entrega 2.7.0.5, extendido en
 * 2.7.0.6).
 *
 * Deliberadamente delgado -- mismo criterio que
 * ProductionPredictionAlertRepository (2.7.0.3): toda la lógica de
 * validación/clasificación vive en ProductionAlertActionService/
 * ActionEffectiveness, este repositorio solo sabe leer/crear/actualizar
 * filas. Sección 17 (2.7.0.5) -- sin delete(): ninguna acción se
 * elimina desde la interfaz. `update()` (heredado de
 * SequelizeRepository, sin override) se usa EXCLUSIVAMENTE para
 * persistir el resultado de la evaluación de efectividad (2.7.0.6,
 * sección 11) -- nunca para editar los datos originales de la acción.
 */
class ProductionAlertActionRepository
    extends SequelizeRepository {

    constructor() {

        super(ProductionAlertAction);

    }

    /*
     * Todas las acciones de UNA alerta, cronológicamente (sección 12/18
     * -- "se muestran cronológicamente").
     */
    async findByAlert(alertId) {

        return await this.model.findAll({

            where: {

                alertId

            },

            order: [

                ["createdAt", "ASC"],

                ["id", "ASC"]

            ]

        });

    }

    /*
     * Entrega 2.7.0.6, sección 4/8/13 -- todas las acciones PENDING de
     * UN LOTE (no de una alerta específica: la evaluación automática se
     * dispara por lote, y un lote puede tener acciones repartidas entre
     * varios episodios de alerta). Usa la columna denormalizada
     * `productionBatchId` -- ver comentario del modelo -- para no
     * depender de un JOIN contra production_prediction_alerts en cada
     * medición nueva.
     */
    async findPendingByBatch(productionBatchId) {

        return await this.model.findAll({

            where: {

                productionBatchId,

                effectivenessStatus: "PENDING"

            }

        });

    }

    /*
     * Entrega 2.7.0.7, Acción 9 -- consulta consolidada para el análisis
     * agregado, con los filtros aplicados en la BASE DE DATOS (nunca en
     * JS después de traer todo, sección "El backend deberá aplicar los
     * filtros antes de realizar las agregaciones"). `from`/`to` filtran
     * sobre `createdAt` (= "actionCreatedAt" del spec, la fecha de
     * REGISTRO de la acción -- ver judgment call en el resumen de la
     * entrega). `productId` requiere resolver la cadena completa
     * alert -> productionBatch -> recipeVersion -> recipe -> product,
     * exactamente igual que `batchMatchesProductFilter()`
     * (services/support/batchCandidates.js) resuelve la misma cadena
     * para los análisis de maduración -- aquí se hace vía un `include`
     * `required:true` en vez de un filtro en JS porque esta consulta ya
     * necesita un JOIN por fila (a diferencia de esos servicios, que
     * parten de una lista de LOTES, no de acciones).
     */
    async findForAnalytics({ from, to, actionType, effectivenessStatus, alertSeverity, productId } = {}) {

        const where =
            {};

        if (from || to) {

            where.createdAt =
                {};

            if (from) {

                where.createdAt[Op.gte] = from;

            }

            if (to) {

                where.createdAt[Op.lte] = to;

            }

        }

        if (actionType) {

            where.type = actionType;

        }

        if (effectivenessStatus) {

            where.effectivenessStatus = effectivenessStatus;

        }

        if (alertSeverity) {

            where.alertSeverityAtAction = alertSeverity;

        }

        const include =
            [];

        if (productId !== null && productId !== undefined && productId !== "") {

            include.push({

                association: "alert",

                required: true,

                attributes: [],

                include: [

                    {

                        association: "productionBatch",

                        required: true,

                        attributes: [],

                        include: [

                            {

                                association: "recipeVersion",

                                required: true,

                                attributes: [],

                                include: [

                                    {

                                        association: "recipe",

                                        required: true,

                                        attributes: [],

                                        include: [

                                            {

                                                association: "product",

                                                required: true,

                                                attributes: [],

                                                where: { id: productId }

                                            }

                                        ]

                                    }

                                ]

                            }

                        ]

                    }

                ]

            });

        }

        return await this.model.findAll({

            where,

            include,

            order: [

                ["createdAt", "ASC"]

            ]

        });

    }

}

module.exports =
    ProductionAlertActionRepository;
