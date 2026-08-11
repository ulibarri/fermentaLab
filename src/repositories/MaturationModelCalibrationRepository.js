const { Op } =
    require("sequelize");

const SequelizeRepository =
    require("./SequelizeRepository");

const MaturationModelCalibration =
    require("../models/MaturationModelCalibration");

const RECIPE_VERSION_INCLUDE = {

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

};

/*
 * Entrega 2.6.1.24, secciones 2/4 -- include compartido por las
 * consultas del "centro de propuestas de recalibración": receta/
 * producto (igual que RECIPE_VERSION_INCLUDE) más la calibración
 * ORIGEN (`parentCalibration`), necesaria para la columna "Calibración
 * origen" y para el detalle de comparación. Se define aparte de
 * RECIPE_VERSION_INCLUDE (usado por findAll()/findById() desde
 * 2.6.1.16) para no cambiar la forma de esas consultas ya existentes.
 */
const PROPOSAL_CONTEXT_INCLUDE = [

    RECIPE_VERSION_INCLUDE,

    {

        association: "parentCalibration"

    }

];

/*
 * Repositorio de MaturationModelCalibration (Entrega 2.6.1.16).
 *
 * Mismo criterio que MaturationModelConfigurationRepository (2.6.1.11)
 * y MaturationPredictionRepository (2.6.1.12): reenvía `{ transaction }`
 * explícitamente a Sequelize en vez de confiar en la base compartida
 * (que la ignora en silencio) -- la garantía de "solo una calibración
 * ACTIVE por (modelType, recipeVersionId)" depende de que desactivar la
 * anterior y activar la nueva ocurran en la misma transacción (ver
 * MaturationModelCalibrationService._activate()).
 */
class MaturationModelCalibrationRepository
    extends SequelizeRepository {

    constructor() {

        super(MaturationModelCalibration);

    }

    async findById(id, transaction = null) {

        return await this.model.findByPk(id, {

            include: [RECIPE_VERSION_INCLUDE],

            transaction

        });

    }

    /*
     * Listado completo para la tabla de gestión (sección 14), más
     * reciente primero. Filtros opcionales -- todos combinables, todos
     * ausentes por defecto (regresa todas las calibraciones).
     */
    async findAll(filters = {}) {

        const where = {};

        if (filters.modelType) {

            where.modelType = filters.modelType;

        }

        if (filters.recipeVersionId) {

            where.recipeVersionId = filters.recipeVersionId;

        }

        if (filters.status) {

            where.status = filters.status;

        }

        return await this.model.findAll({

            where,

            include: [RECIPE_VERSION_INCLUDE],

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    /*
     * La calibración ACTIVE de un (modelType, recipeVersionId), o null
     * si ninguna lo está. Es la consulta que
     * MaturationPredictionService.generatePrediction() usa para saber
     * si debe aplicar un offset (sección 8), y la que
     * MaturationModelCalibrationService._activate() usa para saber cuál
     * desactivar antes de activar una nueva (sección 6: "solo una
     * ACTIVE por modelType+recipeVersionId").
     */
    async findActiveByModelAndRecipeVersion(modelType, recipeVersionId, transaction = null) {

        return await this.model.findOne({

            where: {

                modelType,

                recipeVersionId,

                status: "ACTIVE"

            },

            transaction

        });

    }

    /*
     * Entrega 2.6.1.23, sección 4 -- ¿ya existe una propuesta PROPOSED
     * derivada de esta calibración origen? `parentCalibrationId` ya
     * identifica sin ambigüedad tanto la calibración origen como el
     * (modelType, recipeVersionId) al que pertenece (2.6.1.19,
     * `createReplacement()` siempre hereda ese alcance del padre), así
     * que no hace falta repetir el filtro por modelType/recipeVersionId
     * aparte. Si hubiera más de una (no debería, esta misma consulta es
     * la que lo evita hacia adelante), se toma la más reciente.
     */
    async findProposedByParent(parentCalibrationId, transaction = null) {

        return await this.model.findOne({

            where: {

                parentCalibrationId,

                status: "PROPOSED"

            },

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ],

            transaction

        });

    }

    /*
     * Entrega 2.6.1.19, sección 3 -- siguiente número de versión DENTRO
     * de (modelType, recipeVersionId), nunca global. Simplemente
     * MAX(version)+1 en ese alcance (1 si todavía no existe ninguna) --
     * calculado siempre server-side, el cliente nunca propone su propio
     * número de versión.
     */
    async _nextVersion(modelType, recipeVersionId, transaction = null) {

        const maxVersion =
            await this.model.max("version", {

                where: { modelType, recipeVersionId },

                transaction

            });

        return (maxVersion || 0) + 1;

    }

    /*
     * Crea una propuesta nueva, siempre en estado PROPOSED (sección 3
     * -- el estado inicial nunca lo decide el cliente). `parentCalibrationId`
     * es opcional (null para la primera versión de un alcance, sección
     * 2) -- `version` SIEMPRE se calcula aquí, nunca se acepta del
     * llamador, para que quede garantizado incremental y sin huecos por
     * construcción (2.6.1.19, criterio "la versión sea incremental por
     * modelType + recipeVersionId").
     */
    async create({ modelType, recipeVersionId, offsetHours, sampleSize, biasHours, reason, createdBy, parentCalibrationId }, transaction = null) {

        const version =
            await this._nextVersion(modelType, recipeVersionId, transaction);

        return await this.model.create({

            modelType,

            recipeVersionId,

            offsetHours,

            status: "PROPOSED",

            sampleSize: sampleSize ?? null,

            biasHours: biasHours ?? null,

            reason: reason ?? null,

            createdBy: createdBy ?? null,

            parentCalibrationId: parentCalibrationId ?? null,

            version

        }, { transaction });

    }

    /*
     * Entrega 2.6.1.19, sección 13 -- cadena de versiones de un
     * (modelType, recipeVersionId): todas las calibraciones de ese
     * alcance, ordenadas por `version` ASC. `version` es por
     * construcción incremental y sin huecos dentro de un alcance (ver
     * `_nextVersion()`), así que esta lista YA es la cadena #7→#8→#9 del
     * mockup sin necesidad de recorrer `parentCalibrationId` como un
     * grafo -- cada fila conserva su propio `parentCalibrationId` para
     * que el cliente pueda seguir dibujando las flechas exactas si lo
     * necesita, pero el orden mostrado se basa en `version`, no en un
     * recorrido de punteros (más robusto: nunca se rompe si alguna fila
     * antigua, antes de esta entrega, quedó con `parentCalibrationId`
     * null por la migración aditiva).
     */
    async findVersionChain(modelType, recipeVersionId) {

        return await this.model.findAll({

            where: { modelType, recipeVersionId },

            include: [RECIPE_VERSION_INCLUDE],

            order: [

                ["version", "ASC"],

                ["id", "ASC"]

            ]

        });

    }

    /*
     * Edita offsetHours/reason de una propuesta -- quien llama
     * (MaturationModelCalibrationService) es responsable de verificar
     * que el estado actual permite editarla (sección 13: nunca ACTIVE).
     */
    async updateEditableFields(id, { offsetHours, reason }, transaction = null) {

        const record =
            await this.model.findByPk(id, { transaction });

        if (!record) {

            return null;

        }

        if (offsetHours !== undefined) {

            record.offsetHours = offsetHours;

        }

        if (reason !== undefined) {

            record.reason = reason;

        }

        await record.save({ transaction });

        return record;

    }

    /*
     * Entrega 2.6.1.24, sección 7 -- `approvedBy` es adicional y
     * retrocompatible: el llamador original (MaturationModelCalibrationService,
     * desde 2.6.1.16) nunca pasaba un segundo argumento aquí, así que
     * este parámetro por defecto vacío no cambia ningún caller
     * existente.
     */
    async approve(id, { approvedBy } = {}, transaction = null) {

        return await this._setStatus(id, {

            status: "APPROVED",

            approvedAt: new Date(),

            approvedBy: approvedBy ?? null

        }, transaction);

    }

    /*
     * Entrega 2.6.1.24, sección 8 -- `rejectedBy`/`rejectionReason`
     * adicionales, mismo criterio de retrocompatibilidad que approve()
     * de arriba. Este repositorio NO exige que `rejectionReason` venga
     * presente -- esa validación ("motivo obligatorio") vive en
     * RecalibrationProposalService, específica del flujo de propuestas
     * de recalibración; el endpoint genérico /calibrations/:id/reject
     * (2.6.1.16, todavía en uso desde /maturation/calibrations) sigue
     * pudiendo rechazar sin motivo exactamente como antes.
     */
    async reject(id, { rejectedBy, rejectionReason } = {}, transaction = null) {

        return await this._setStatus(id, {

            status: "REJECTED",

            rejectedAt: new Date(),

            rejectedBy: rejectedBy ?? null,

            rejectionReason: rejectionReason ?? null

        }, transaction);

    }

    /*
     * Entrega 2.6.1.24, secciones 2/3 -- listado del "centro de
     * propuestas de recalibración". `parentCalibrationId IS NOT NULL`
     * es la definición operativa de "propuesta de recalibración" en
     * este modelo de datos: toda calibración creada por
     * `createReplacement()` (2.6.1.19, el único camino que usa
     * `ModelAlertService.createRecalibrationProposal()`, 2.6.1.21/23)
     * hereda el `parentCalibrationId` de su origen; una calibración de
     * primera versión creada manualmente vía `POST /calibrations`
     * (2.6.1.16, sin alerta de por medio) nunca tiene padre y por lo
     * tanto no es "una propuesta de recalibración" en el sentido de
     * esta entrega -- no tiene una "calibración origen" que mostrar en
     * la columna del mismo nombre. Judgment call flagueado en el
     * resumen de la entrega.
     */
    async findRecalibrationProposals({ modelType, productId, status, createdBy, from, to } = {}) {

        const where = {

            parentCalibrationId: { [Op.ne]: null }

        };

        if (modelType) {

            where.modelType = modelType;

        }

        if (status) {

            where.status = status;

        }

        if (createdBy) {

            where.createdBy = { [Op.like]: `%${createdBy}%` };

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

        if (productId) {

            where["$recipeVersion.recipe.productId$"] = productId;

        }

        return await this.model.findAll({

            where,

            include: PROPOSAL_CONTEXT_INCLUDE,

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ],

            subQuery: false

        });

    }

    /*
     * Entrega 2.6.1.24, sección 4 -- detalle de una propuesta con todo
     * el contexto (receta/producto + calibración origen) para no
     * necesitar una segunda consulta.
     */
    async findProposalWithContext(id) {

        return await this.model.findByPk(id, {

            include: PROPOSAL_CONTEXT_INCLUDE

        });

    }

    /*
     * Entrega 2.6.1.25, sección 7 -- `activatedBy` adicional y
     * retrocompatible, mismo criterio que approve()/reject() (2.6.1.24):
     * el único caller anterior (MaturationModelCalibrationService.activate(),
     * desde 2.6.1.16) nunca pasaba un segundo argumento, así que este
     * default vacío no cambia el endpoint genérico
     * /calibrations/:id/activate.
     */
    async activateRow(id, { activatedBy } = {}, transaction = null) {

        return await this._setStatus(id, {

            status: "ACTIVE",

            activatedAt: new Date(),

            activatedBy: activatedBy ?? null

        }, transaction);

    }

    async deactivateRow(id, transaction = null) {

        return await this._setStatus(id, {

            status: "INACTIVE",

            deactivatedAt: new Date()

        }, transaction);

    }

    async _setStatus(id, fields, transaction) {

        const record =
            await this.model.findByPk(id, { transaction });

        if (!record) {

            return null;

        }

        Object.assign(record, fields);

        await record.save({ transaction });

        return record;

    }

}

module.exports =
    MaturationModelCalibrationRepository;
