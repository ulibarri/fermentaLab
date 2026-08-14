const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.6.1.28 — detección automática de degradación de
 * calibraciones activas.
 *
 * Cada fila representa UN episodio de degradación detectado para una
 * calibración ACTIVE concreta -- nunca una predicción individual
 * (sección 2: "no debemos considerar degradación simplemente porque
 * una predicción individual tenga un error grande", la detección
 * siempre opera sobre métricas agregadas, ver DegradationDetection.js
 * y CalibrationDegradationService).
 *
 * Ciclo de vida (sección 7):
 *   DETECTED -> ACKNOWLEDGED -> RESOLVED
 *   DETECTED -------------------> RESOLVED
 *
 * "Reconocer" (ACKNOWLEDGED) nunca implica "resuelto" -- mismo
 * criterio que MaturationModelAlert (2.6.1.21). Solo
 * CalibrationDegradationService decide cuándo una fila pasa a
 * RESOLVED (manualmente, o automáticamente al detectar recuperación
 * con muestra suficiente, sección 9). Nunca se borran registros
 * anteriores (sección 7, explícito).
 */
const MaturationCalibrationDegradationEvent = sequelize.define("MaturationCalibrationDegradationEvent", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    calibrationId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    detectedAt: {

        type: DataTypes.DATE,

        allowNull: false

    },

    sampleSize: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    baselineMaeHours: {

        type: DataTypes.FLOAT,

        allowNull: true

    },

    currentMaeHours: {

        type: DataTypes.FLOAT,

        allowNull: true

    },

    baselineRmseHours: {

        type: DataTypes.FLOAT,

        allowNull: true

    },

    currentRmseHours: {

        type: DataTypes.FLOAT,

        allowNull: true

    },

    baselineBiasHours: {

        type: DataTypes.FLOAT,

        allowNull: true

    },

    currentBiasHours: {

        type: DataTypes.FLOAT,

        allowNull: true

    },

    degradationPercentage: {

        type: DataTypes.FLOAT,

        allowNull: true

    },

    thresholdPercentage: {

        type: DataTypes.FLOAT,

        allowNull: false

    },

    // "DETECTED" | "ACKNOWLEDGED" | "RESOLVED".
    status: {

        type: DataTypes.STRING(20),

        allowNull: false,

        defaultValue: "DETECTED"

    },

    acknowledgedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    resolvedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    // Entrega 2.6.1.29, sección 8 -- puntero "hacia adelante" de la
    // trazabilidad bidireccional alerta<->propuesta. Nullable: la
    // mayoría de eventos (sin decisión todavía, o resueltos por
    // recuperación espontánea) nunca generan una propuesta. Ver el
    // comentario de la migración
    // (20260812000000-add-proposal-tracking-to-degradation-events-and-audit-logs.js)
    // para el porqué de vivir en el EVENTO y no en la calibración.
    proposalId: {

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

    tableName: "maturation_calibration_degradation_events",

    timestamps: true

});

module.exports = MaturationCalibrationDegradationEvent;
