const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.6.1.30 — evaluación y priorización de propuestas de
 * recalibración. Ver el comentario de la migración
 * (20260812010000-create-recalibration-proposal-evaluations-table.js)
 * para el porqué de una tabla de historial inmutable en vez de campos
 * sobre `MaturationModelCalibration`.
 */
const RecalibrationProposalEvaluation = sequelize.define("RecalibrationProposalEvaluation", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    calibrationId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    sampleSize: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    maeActualHours: { type: DataTypes.FLOAT, allowNull: true },

    maeProposedHours: { type: DataTypes.FLOAT, allowNull: true },

    rmseActualHours: { type: DataTypes.FLOAT, allowNull: true },

    rmseProposedHours: { type: DataTypes.FLOAT, allowNull: true },

    biasActualHours: { type: DataTypes.FLOAT, allowNull: true },

    biasProposedHours: { type: DataTypes.FLOAT, allowNull: true },

    maeImprovementPercentage: { type: DataTypes.FLOAT, allowNull: true },

    rmseImprovementPercentage: { type: DataTypes.FLOAT, allowNull: true },

    biasImprovementPercentage: { type: DataTypes.FLOAT, allowNull: true },

    improvedCount: { type: DataTypes.INTEGER, allowNull: true },

    worsenedCount: { type: DataTypes.INTEGER, allowNull: true },

    unchangedCount: { type: DataTypes.INTEGER, allowNull: true },

    consistencyPercentage: { type: DataTypes.FLOAT, allowNull: true },

    adjustmentMagnitudePercentage: { type: DataTypes.FLOAT, allowNull: true },

    score: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    // "LOW" | "MEDIUM" | "HIGH".
    recommendation: {

        type: DataTypes.STRING(10),

        allowNull: false

    },

    // JSON string: {positives:[...], warnings:[...]}.
    explanation: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    evaluatedAt: {

        type: DataTypes.DATE,

        allowNull: false

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

    tableName: "recalibration_proposal_evaluations",

    timestamps: true

});

module.exports = RecalibrationProposalEvaluation;
