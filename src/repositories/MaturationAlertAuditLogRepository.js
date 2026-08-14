const SequelizeRepository =
    require("./SequelizeRepository");

const MaturationAlertAuditLog =
    require("../models/MaturationAlertAuditLog");

/*
 * Repositorio de MaturationAlertAuditLog (Entrega 2.6.1.23).
 *
 * Deliberadamente mínimo -- ninguna acceptance criterion de esta
 * entrega pide un endpoint de lectura/consulta del log de auditoría,
 * solo que las acciones "se registren" (criterio 11). `log()` es la
 * única operación de escritura real; `findByModel()` se deja lista
 * para una futura pantalla de auditoría, pero no se expone todavía por
 * ningún controller/ruta -- ver el resumen final de la entrega para
 * este judgment call.
 */
class MaturationAlertAuditLogRepository
    extends SequelizeRepository {

    constructor() {

        super(MaturationAlertAuditLog);

    }

    /*
     * Entrega 2.6.1.29, sección 13/14 -- `degradationEventId` es
     * aditivo (solo GENERATE_RECALIBRATION_PROPOSAL_FROM_DEGRADATION la
     * envía) y `transaction` es un parámetro nuevo y opcional: permite
     * que esta escritura participe en la MISMA transacción que crea la
     * propuesta y la asocia al evento (CalibrationDegradationService.
     * generateProposal()), sin cambiar ningún llamador existente
     * (approve()/reject()/activate() de RecalibrationProposalService,
     * 2.6.1.24/25, siguen llamando `log()` sin transacción, tal como
     * siempre lo hicieron).
     */
    async log({ userId, action, modelId, alertId, sourceCalibrationId, targetCalibrationId, reason, previousCalibrationId, degradationEventId }, transaction = null) {

        return await this.model.create({

            userId: userId ?? null,

            action,

            modelId: modelId ?? null,

            alertId: alertId ?? null,

            sourceCalibrationId: sourceCalibrationId ?? null,

            targetCalibrationId: targetCalibrationId ?? null,

            // Entrega 2.6.1.24, sección 12 -- solo
            // REJECT_RECALIBRATION_PROPOSAL la envía; el resto de
            // acciones la dejan en null.
            reason: reason ?? null,

            // Entrega 2.6.1.25, sección 8 -- solo ACTIVATE_RECALIBRATION
            // la envía.
            previousCalibrationId: previousCalibrationId ?? null,

            // Entrega 2.6.1.29, sección 14 -- solo
            // GENERATE_RECALIBRATION_PROPOSAL_FROM_DEGRADATION la envía.
            degradationEventId: degradationEventId ?? null

        }, { transaction });

    }

    async findByModel(modelId) {

        return await this.model.findAll({

            where: { modelId },

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

}

module.exports =
    MaturationAlertAuditLogRepository;
