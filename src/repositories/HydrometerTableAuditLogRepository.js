const HydrometerTableAuditLog =
    require("../models/HydrometerTableAuditLog");

/*
 * Entrega 2.8.0.2, sección 14 -- calcado de
 * `MaturationAlertAuditLogRepository` (2.6.1.23): un solo método de
 * escritura, append-only, más un método de lectura que todavía no está
 * expuesto vía ningún controller (queda listo para una futura pantalla
 * de historial de una tabla específica).
 */
class HydrometerTableAuditLogRepository {

    async log({ userId, action, tableId, previousTableId, reason }, transaction = null) {

        return await HydrometerTableAuditLog.create({

            userId: userId ?? null,

            action,

            tableId: tableId ?? null,

            previousTableId: previousTableId ?? null,

            reason: reason ?? null

        }, { transaction });

    }

    async findByTable(tableId) {

        return await HydrometerTableAuditLog.findAll({

            where: { tableId },

            order: [["createdAt", "ASC"]]

        });

    }

}

module.exports =
    HydrometerTableAuditLogRepository;
