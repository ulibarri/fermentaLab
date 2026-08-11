const SequelizeRepository =
    require("./SequelizeRepository");

const MaturationModelConfiguration =
    require("../models/MaturationModelConfiguration");

/*
 * Repositorio de MaturationModelConfiguration (Entrega 2.6.1.11).
 *
 * NOTA sobre transacciones: SequelizeRepository.create()/update() (la
 * base compartida por todos los repositorios) en realidad NO reenvían
 * un `transaction` a Sequelize aunque se les pase como argumento extra
 * — algunos servicios existentes (ej. ProductionBatchService) ya pasan
 * `transaction` a `this.repository.create(...)`/`update(...)` esperando
 * que se use, pero la base class lo ignora silenciosamente. Esta
 * entrega exige explícitamente que la activación de un modelo ocurra
 * "dentro de una transacción" (sección 6, criterio de aceptación #12)
 * — la garantía de unicidad de un único modelo ACTIVE por recipeVersion
 * depende de que desactivar el anterior y crear/activar el nuevo pasen
 * o fallen juntos. Por eso este repositorio, a diferencia de la base,
 * SÍ reenvía `{ transaction }` a cada llamada de Sequelize.
 */
class MaturationModelConfigurationRepository
    extends SequelizeRepository {

    constructor() {

        super(MaturationModelConfiguration);

    }

    /*
     * El modelo actualmente ACTIVE de una recipeVersion, o null si
     * ninguno lo está (recipeVersion sin modelo activo configurado
     * todavía -> NO_ACTIVE_MODEL).
     */
    async findActiveByRecipeVersion(recipeVersionId, transaction = null) {

        return await this.model.findOne({

            where: {

                recipeVersionId,

                status: "ACTIVE"

            },

            transaction

        });

    }

    /*
     * Historial completo (ACTIVE + INACTIVE) de una recipeVersion,
     * más reciente primero.
     */
    async findHistoryByRecipeVersion(recipeVersionId) {

        return await this.model.findAll({

            where: {

                recipeVersionId

            },

            order: [

                ["activatedAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    /*
     * Desactiva una fila existente (status=INACTIVE, deactivatedAt=ahora).
     * Regresa null si el id no existe (nunca lanza — quien llama decide
     * si eso es un error).
     */
    async deactivate(id, transaction = null) {

        const record =
            await this.model.findByPk(id, { transaction });

        if (!record) {

            return null;

        }

        record.status =
            "INACTIVE";

        record.deactivatedAt =
            new Date();

        await record.save({ transaction });

        return record;

    }

    /*
     * Crea una fila nueva YA como ACTIVE (activatedAt=ahora,
     * deactivatedAt=null). Quien llama es responsable de haber
     * desactivado primero cualquier fila ACTIVE previa de la misma
     * recipeVersion, dentro de la misma transacción (ver
     * MaturationModelConfigurationService._activate()).
     */
    async createActive({ recipeVersionId, modelType, source, activatedBy, notes }, transaction = null) {

        return await this.model.create({

            recipeVersionId,

            modelType,

            status: "ACTIVE",

            activatedAt: new Date(),

            deactivatedAt: null,

            source,

            activatedBy: activatedBy ?? null,

            notes: notes ?? null

        }, { transaction });

    }

}

module.exports =
    MaturationModelConfigurationRepository;
