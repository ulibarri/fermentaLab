const { Op } = require("sequelize");

const SequelizeRepository =
    require("./SequelizeRepository");

const MaturationModelAlert =
    require("../models/MaturationModelAlert");

/*
 * Entrega 2.6.1.22, secciones 3/4/7 -- include anidado para el centro
 * de alertas: producto/receta (vía el modelo) y calibración origen
 * (vía la propia calibración, si existe). Se define una sola vez para
 * que la lista, el detalle y (indirectamente) el resumen usen
 * exactamente la misma forma.
 */
const CONTEXT_INCLUDE = [

    {

        association: "modelConfiguration",

        include: [

            {

                association: "recipeVersion",

                include: [

                    {

                        association: "recipe",

                        include: [

                            {

                                association: "product"

                            }

                        ]

                    }

                ]

            }

        ]

    },

    {

        association: "calibration",

        include: [

            {

                association: "parentCalibration"

            }

        ]

    }

];

/*
 * Repositorio de MaturationModelAlert (Entrega 2.6.1.21, extendido en
 * 2.6.1.22 con consultas MULTI-MODELO para el centro de alertas).
 *
 * Deliberadamente delgado: toda la lógica de detección/deduplicación
 * vive en `ModelAlertService` -- este repositorio solo sabe leer/crear/
 * actualizar filas, nunca decide si una condición amerita una alerta
 * nueva o la reutilización de una existente.
 */
class MaturationModelAlertRepository
    extends SequelizeRepository {

    constructor() {

        super(MaturationModelAlert);

    }

    /*
     * Todas las alertas todavía abiertas (OPEN o ACKNOWLEDGED) de un
     * modelo -- sección 9/10: "una condición activa genera una sola
     * alerta abierta". Debería haber a lo sumo una por construcción
     * (ver `ModelAlertService._detectAndPersist()`), pero se regresa
     * como lista para que el servicio pueda, además, detectar y
     * resolver alertas "huérfanas" (atadas a una calibración que ya no
     * es la vigente del modelo).
     */
    async findOpenOrAcknowledgedByModel(modelConfigurationId) {

        return await this.model.findAll({

            where: {

                modelConfigurationId,

                status: { [Op.in]: ["OPEN", "ACKNOWLEDGED"] }

            },

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    /*
     * Historial completo de un modelo (sección 8/16), más reciente
     * primero -- incluye OPEN/ACKNOWLEDGED/RESOLVED.
     */
    async findAllByModel(modelConfigurationId) {

        return await this.model.findAll({

            where: { modelConfigurationId },

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    /*
     * Entrega 2.6.1.22, secciones 2/3/10 -- consulta global "centro de
     * alertas": todas las alertas de TODOS los modelos, con los filtros
     * opcionales productId/recipeVersionId/modelId/severity/status/
     * from/to. `productId` y `recipeVersionId` se filtran a través de
     * las asociaciones anidadas (modelConfiguration -> recipeVersion ->
     * recipe -> product) usando la notación `$asociacion.campo$` de
     * Sequelize -- más simple que anidar un `where` en cada nivel del
     * `include`.
     */
    async findAllFiltered({ productId, recipeVersionId, modelId, severity, status, from, to } = {}) {

        const where = {};

        if (modelId) {

            where.modelConfigurationId = modelId;

        }

        if (severity) {

            where.severity = severity;

        }

        if (status) {

            where.status = status;

        }

        if (from || to) {

            where.createdAt = {};

            if (from) {

                where.createdAt[Op.gte] = new Date(from);

            }

            if (to) {

                where.createdAt[Op.lte] = new Date(to);

            }

        }

        if (recipeVersionId) {

            where["$modelConfiguration.recipeVersionId$"] = recipeVersionId;

        }

        if (productId) {

            where["$modelConfiguration.recipeVersion.recipe.productId$"] = productId;

        }

        return await this.model.findAll({

            where,

            include: CONTEXT_INCLUDE,

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ],

            // Necesario porque hay `where` sobre columnas de
            // asociaciones anidadas (productId/recipeVersionId) --
            // sin esto Sequelize podría intentar paginar con una
            // subconsulta que no conoce esas columnas.
            subQuery: false

        });

    }

    /*
     * Entrega 2.6.1.22, sección 4/7 -- detalle de una alerta con todo
     * el contexto necesario para mostrarla sin consultas adicionales:
     * producto/receta/modelo y la calibración asociada (incluyendo su
     * propia calibración origen, si la tiene, sección 7: "calibración
     * origen, si existe").
     */
    async findByIdWithContext(id) {

        return await this.model.findByPk(id, {

            include: CONTEXT_INCLUDE

        });

    }

    /*
     * Entrega 2.6.1.24, sección 6 -- "[Ver alerta origen]" desde una
     * propuesta: dada la calibración ORIGEN de la propuesta
     * (`parentCalibrationId`), la alerta que la originó es la más
     * reciente que apunta a esa misma calibración vía `calibrationId`
     * -- normalmente hay una sola (regla de deduplicación de 2.6.1.21),
     * pero se toma la más reciente por seguridad si alguna vez hubiera
     * más de una (ej. una resuelta manualmente y otra reabierta después,
     * criterio 17 de 2.6.1.21).
     */
    async findMostRecentByCalibration(calibrationId) {

        return await this.model.findOne({

            where: { calibrationId },

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    async create({ modelConfigurationId, calibrationId, severity, type, message, details }) {

        return await this.model.create({

            modelConfigurationId,

            calibrationId: calibrationId ?? null,

            severity,

            type,

            status: "OPEN",

            message,

            details: details ?? null

        });

    }

    /*
     * Actualiza severidad/mensaje/detalles de una alerta OPEN/
     * ACKNOWLEDGED ya existente, sin tocar su `id`/`createdAt` --
     * es la "escalada en el lugar" (WARNING -> CRITICAL, o viceversa)
     * que evita crear una segunda fila para la misma condición
     * continua (sección 9).
     */
    async updateCondition(id, { calibrationId, severity, type, message, details }) {

        const record =
            await this.model.findByPk(id);

        if (!record) {

            return null;

        }

        record.calibrationId = calibrationId ?? null;
        record.severity = severity;
        record.type = type;
        record.message = message;
        record.details = details ?? null;

        await record.save();

        return record;

    }

    async acknowledge(id) {

        return await this._setStatus(id, {

            status: "ACKNOWLEDGED",

            acknowledgedAt: new Date()

        });

    }

    async resolve(id) {

        return await this._setStatus(id, {

            status: "RESOLVED",

            resolvedAt: new Date()

        });

    }

    async _setStatus(id, fields) {

        const record =
            await this.model.findByPk(id);

        if (!record) {

            return null;

        }

        Object.assign(record, fields);

        await record.save();

        return record;

    }

}

module.exports =
    MaturationModelAlertRepository;
