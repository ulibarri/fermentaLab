const { Op } =
    require("sequelize");

const SequelizeRepository =
    require("./SequelizeRepository");

const ProductionPredictionAlert =
    require("../models/ProductionPredictionAlert");

/*
 * Repositorio de ProductionPredictionAlert (Entrega 2.7.0.3).
 *
 * Deliberadamente delgado -- mismo criterio que
 * MaturationCalibrationDegradationEventRepository (2.6.1.28) y
 * MaturationModelAlertRepository (2.6.1.21): toda la lógica de
 * detección/deduplicación/recuperación vive en
 * ProductionPredictionAlertService, este repositorio solo sabe leer/
 * crear/actualizar filas.
 */
class ProductionPredictionAlertRepository
    extends SequelizeRepository {

    constructor() {

        super(ProductionPredictionAlert);

    }

    /*
     * La alerta ACTIVE vigente de un lote -- sección 7: "debe existir
     * una alerta activa", a lo sumo una por construcción (el servicio
     * nunca crea una segunda mientras exista una sin resolver), pero se
     * toma la más reciente por seguridad.
     */
    async findActiveByBatch(productionBatchId) {

        return await this.model.findOne({

            where: {

                productionBatchId,

                status: "ACTIVE"

            },

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    /*
     * Historial completo de un lote (sección 12/16 -- "las alertas
     * resueltas permanecen almacenadas"), más reciente primero.
     */
    async findByBatch(productionBatchId) {

        return await this.model.findAll({

            where: {

                productionBatchId

            },

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    async findById(id) {

        return await this.model.findByPk(id);

    }

    async create({ productionBatchId, predictionId, type, severity, expectedFinishAt, predictedFinishAt, deviationMinutes, message }, transaction = null) {

        return await this.model.create({

            productionBatchId,

            predictionId,

            type,

            severity,

            expectedFinishAt,

            predictedFinishAt,

            deviationMinutes,

            message,

            status: "ACTIVE"

        }, { transaction });

    }

    /*
     * Sección 7 -- refresca EN EL LUGAR una alerta ACTIVE ya existente
     * (nunca crea una fila nueva para la misma desviación continua,
     * mismo patrón que
     * MaturationCalibrationDegradationEventRepository.updateSnapshot(),
     * 2.6.1.28). Nunca toca `createdAt` (el inicio del episodio no
     * cambia al refrescarse) ni `status`/`resolvedAt`.
     */
    async updateActive(id, { predictionId, type, severity, expectedFinishAt, predictedFinishAt, deviationMinutes, message }, transaction = null) {

        const record =
            await this.model.findByPk(id, { transaction });

        if (!record) {

            return null;

        }

        record.predictionId = predictionId;
        record.type = type;
        record.severity = severity;
        record.expectedFinishAt = expectedFinishAt;
        record.predictedFinishAt = predictedFinishAt;
        record.deviationMinutes = deviationMinutes;
        record.message = message;

        await record.save({ transaction });

        return record;

    }

    /*
     * Sección 8 -- el lote volvió al intervalo esperado. Queda fija
     * como registro histórico a partir de aquí (sección 16).
     */
    async resolve(id, { message }, transaction = null) {

        const record =
            await this.model.findByPk(id, { transaction });

        if (!record) {

            return null;

        }

        record.status = "RESOLVED";
        record.resolvedAt = new Date();

        if (message) {

            record.message = message;

        }

        await record.save({ transaction });

        return record;

    }

    /*
     * Entrega 2.7.0.8, Acción 15 -- consulta consolidada para el
     * análisis de tendencias, con los filtros aplicados en la BASE DE
     * DATOS (mismo criterio que `ProductionAlertActionRepository.
     * findForAnalytics()`, 2.7.0.7). `from`/`to` filtran sobre
     * `createdAt` (sección 14: "alertas creadas -> createdAt" es la
     * fuente de fecha por defecto para acotar qué alertas entran en el
     * análisis). A diferencia de 2.7.0.7 (que solo necesitaba el
     * producto para FILTRAR), aquí la cadena
     * productionBatch->recipeVersion->recipe->product se trae SIEMPRE
     * (LEFT JOIN, `required` implícito en false salvo cuando se filtra
     * por `productId`) porque el servicio necesita el nombre/id del
     * producto de CADA alerta para la sección 11 ("alertas por
     * producto/receta"), no solo para filtrar una -- por eso, a
     * diferencia de 2.7.0.7, no se usa `attributes: []` en los niveles
     * intermedios. `phase` se resuelve vía la asociación ya existente
     * `prediction` (`ProductionPredictionAlert.belongsTo(MaturationPrediction)`,
     * 2.7.0.3) -- la alerta no tiene columna `phase` propia, pero la
     * relación con su predicción sí la tiene desde 2.7.0.2 (sección 15:
     * "cuando la relación esté disponible de manera fiable" -- lo está,
     * vía `predictionId`).
     */
    async findForAnalytics({ from, to, severity, status, productId, phase } = {}) {

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

        if (severity) {

            where.severity = severity;

        }

        if (status) {

            where.status = status;

        }

        const hasProductFilter =
            productId !== null && productId !== undefined && productId !== "";

        const include =
            [

                {

                    association: "productionBatch",

                    include: [

                        {

                            association: "recipeVersion",

                            include: [

                                {

                                    association: "recipe",

                                    include: [

                                        {

                                            association: "product",

                                            ...(hasProductFilter ? { required: true, where: { id: productId } } : {})

                                        }

                                    ]

                                }

                            ]

                        }

                    ]

                }

            ];

        if (phase) {

            include.push({

                association: "prediction",

                required: true,

                where: { phase }

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
    ProductionPredictionAlertRepository;
