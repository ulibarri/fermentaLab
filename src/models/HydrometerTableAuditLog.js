const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.8.0.2, sección 14 -- "no necesitamos construir todavía un
 * sistema completo de auditoría de toda la aplicación; únicamente dejar
 * trazabilidad de las versiones de tablas." Calcado deliberadamente de
 * `MaturationAlertAuditLog` (2.6.1.23): tabla append-only (nada la
 * actualiza después de creada), un solo método de escritura
 * (`log()` en `HydrometerTableAuditLogRepository`), y un método de
 * lectura (`findByTable()`) que puede no estar expuesto todavía vía
 * ningún controller -- igual que `MaturationAlertAuditLogRepository
 * .findByModel()` en su momento.
 */
const HydrometerTableAuditLog = sequelize.define("HydrometerTableAuditLog", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    // Sin sistema de autenticación en este proyecto todavía (mismo
    // criterio que MaturationAlertAuditLog.userId) -- texto libre,
    // opcional.
    userId: {

        type: DataTypes.STRING(100),

        allowNull: true

    },

    // "CREATED" | "IMPORTED" | "VALIDATED" | "VALIDATION_FAILED" |
    // "ACTIVATED" | "DEACTIVATED" (sección 14: quién creó, quién
    // validó, cuándo se activó, quién desactivó).
    action: {

        type: DataTypes.STRING(40),

        allowNull: false

    },

    // La tabla sobre la que se registra la acción.
    tableId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    // Solo presente en ACTIVATED: la tabla que quedó INACTIVE como
    // efecto secundario de activar `tableId` (sección 14: "versión
    // anterior, versión nueva").
    previousTableId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    reason: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    createdAt: {

        type: DataTypes.DATE,

        allowNull: false

    },

    updatedAt: {

        type: DataTypes.DATE,

        allowNull: false

    }

}, {

    tableName: "hydrometer_table_audit_logs",

    timestamps: true

});

module.exports = HydrometerTableAuditLog;
