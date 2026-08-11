const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.6.1.23 — auditoría de acciones operativas sobre alertas y
 * calibraciones. Ver el comentario de la migración
 * (20260809080000-create-maturation-alert-audit-log-table.js) para el
 * detalle de cada campo, incluyendo por qué `alertId` es adicional a
 * la lista literal de la sección 6.
 */
const MaturationAlertAuditLog = sequelize.define("MaturationAlertAuditLog", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    userId: {

        type: DataTypes.STRING(100),

        allowNull: true

    },

    action: {

        type: DataTypes.STRING(40),

        allowNull: false

    },

    modelId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    alertId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    sourceCalibrationId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    targetCalibrationId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    // Entrega 2.6.1.24, sección 12 -- solo REJECT_RECALIBRATION_PROPOSAL
    // la usa; el resto de acciones la dejan en null.
    reason: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    // Entrega 2.6.1.25, sección 8 -- solo ACTIVATE_RECALIBRATION la usa
    // (la calibración que estaba ACTIVE justo antes de este cambio).
    previousCalibrationId: {

        type: DataTypes.INTEGER,

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

    tableName: "maturation_alert_audit_logs",

    timestamps: true

});

module.exports = MaturationAlertAuditLog;
