const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.6.1.32 — efectividad real de las recalibraciones. Ver el
 * comentario de la migración
 * (20260813000000-create-recalibration-effectiveness-evaluations-table.js)
 * para el porqué de una tabla de historial inmutable con dos pares
 * baseline/valor por métrica (simulación vs. resultado real).
 */
const RecalibrationEffectivenessEvaluation = sequelize.define("RecalibrationEffectivenessEvaluation", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    calibrationId: { type: DataTypes.INTEGER, allowNull: false },

    parentCalibrationId: { type: DataTypes.INTEGER, allowNull: true },

    status: { type: DataTypes.STRING(20), allowNull: false },

    sampleSize: { type: DataTypes.INTEGER, allowNull: false },

    minimumSampleSize: { type: DataTypes.INTEGER, allowNull: false },

    simulationBaselineMaeHours: { type: DataTypes.FLOAT, allowNull: true },
    simulatedMaeHours: { type: DataTypes.FLOAT, allowNull: true },
    expectedMaeImprovementPercentage: { type: DataTypes.FLOAT, allowNull: true },

    simulationBaselineRmseHours: { type: DataTypes.FLOAT, allowNull: true },
    simulatedRmseHours: { type: DataTypes.FLOAT, allowNull: true },
    expectedRmseImprovementPercentage: { type: DataTypes.FLOAT, allowNull: true },

    simulationBaselineBiasHours: { type: DataTypes.FLOAT, allowNull: true },
    simulatedBiasHours: { type: DataTypes.FLOAT, allowNull: true },
    expectedBiasImprovementPercentage: { type: DataTypes.FLOAT, allowNull: true },

    realBaselineMaeHours: { type: DataTypes.FLOAT, allowNull: true },
    realMaeHours: { type: DataTypes.FLOAT, allowNull: true },
    actualMaeImprovementPercentage: { type: DataTypes.FLOAT, allowNull: true },

    realBaselineRmseHours: { type: DataTypes.FLOAT, allowNull: true },
    realRmseHours: { type: DataTypes.FLOAT, allowNull: true },
    actualRmseImprovementPercentage: { type: DataTypes.FLOAT, allowNull: true },

    realBaselineBiasHours: { type: DataTypes.FLOAT, allowNull: true },
    realBiasHours: { type: DataTypes.FLOAT, allowNull: true },
    actualBiasImprovementPercentage: { type: DataTypes.FLOAT, allowNull: true },

    effectivenessScore: { type: DataTypes.FLOAT, allowNull: true },

    isRegression: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    maeCheck: { type: DataTypes.BOOLEAN, allowNull: true },
    rmseCheck: { type: DataTypes.BOOLEAN, allowNull: true },
    biasCheck: { type: DataTypes.BOOLEAN, allowNull: true },

    evaluatedAt: { type: DataTypes.DATE, allowNull: false },

    createdAt: { type: DataTypes.DATE, allowNull: false },

    updatedAt: { type: DataTypes.DATE, allowNull: false }

}, {

    tableName: "recalibration_effectiveness_evaluations",

    timestamps: true

});

module.exports = RecalibrationEffectivenessEvaluation;
