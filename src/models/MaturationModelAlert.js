const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.6.1.21 — alertas y recomendaciones de recalibración.
 *
 * Cada fila representa UNA condición detectada para un modelo (y,
 * cuando aplica, una calibración concreta) -- nunca un evento puntual
 * por lote (sección 5: "no se deberá generar una alerta crítica por un
 * único lote", la condición se evalúa siempre sobre las ventanas ya
 * agregadas de CalibrationHealth, 2.6.1.18).
 *
 * Ciclo de vida (sección 11):
 *   OPEN -> ACKNOWLEDGED -> RESOLVED
 *   OPEN -------------------> RESOLVED
 *
 * "Reconocer" (ACKNOWLEDGED) nunca implica "resuelto" -- la condición
 * puede seguir existiendo (sección 10). Solo `ModelAlertService` decide
 * cuándo una fila pasa a RESOLVED (la condición desapareció, o cambió
 * la calibración activa del modelo).
 */
const MaturationModelAlert = sequelize.define("MaturationModelAlert", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    modelConfigurationId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    calibrationId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    // "WARNING" | "CRITICAL" | "INSUFFICIENT_DATA".
    severity: {

        type: DataTypes.STRING(20),

        allowNull: false

    },

    // "PERFORMANCE_DETERIORATION" | "INSUFFICIENT_DATA".
    type: {

        type: DataTypes.STRING(40),

        allowNull: false

    },

    // "OPEN" | "ACKNOWLEDGED" | "RESOLVED".
    status: {

        type: DataTypes.STRING(20),

        allowNull: false,

        defaultValue: "OPEN"

    },

    message: {

        type: DataTypes.TEXT,

        allowNull: false

    },

    // JSON-como-texto con el snapshot de métricas que originó la
    // alerta -- ver el comentario de la migración.
    details: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    acknowledgedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    resolvedAt: {

        type: DataTypes.DATE,

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

    tableName: "maturation_model_alerts",

    timestamps: true

});

module.exports = MaturationModelAlert;
