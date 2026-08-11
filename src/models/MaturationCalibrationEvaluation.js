const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.6.1.17 — Evaluación de efectividad de la calibración.
 *
 * Cada fila es el resultado PERSISTIDO de comparar, sobre un conjunto de
 * predicciones que efectivamente usaron una calibración específica
 * (`calibrationId`), el desempeño SIN calibrar (`rawPredictedMaturationAt`)
 * contra el desempeño CALIBRADO (`predictedMaturationAt`) -- nunca al
 * revés, y nunca mezclando predicciones de otra calibración/modelo/
 * versión de receta (sección 16: ver
 * `CalibrationEffectivenessService._collectEvaluableComparisons()`).
 *
 * Guardar el resultado (en vez de solo calcularlo bajo demanda) permite
 * observar si una calibración sigue siendo útil conforme llegan nuevos
 * lotes (sección 14: "Historial") -- cada fila es una fotografía de un
 * momento dado, nunca se actualiza retroactivamente.
 *
 * Solo persiste MAE/RMSE/Bias + mejora + resultado (la tabla literal de
 * la sección 11, más `maeImprovementHours` que pide la sección 18) --
 * deliberadamente NO persiste el desglose EARLY/LATE/EXACT de cada
 * escenario (eso solo aparece en la respuesta EN VIVO de
 * GET /calibrations/:id/evaluation, que reproduce el JSON completo de
 * la sección 10). Ver CalibrationEffectivenessService para el porqué.
 */
const MaturationCalibrationEvaluation = sequelize.define("MaturationCalibrationEvaluation", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    calibrationId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    evaluationStartedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    evaluationEndedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    sampleSize: {

        type: DataTypes.INTEGER,

        allowNull: false,

        defaultValue: 0

    },

    rawMaeHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    calibratedMaeHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    rawRmseHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    calibratedRmseHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    rawBiasHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    calibratedBiasHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    maeImprovementHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    maeImprovementPercentage: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    result: {

        type: DataTypes.STRING(30),

        allowNull: false

    },

    // --- Entrega 2.6.1.18: monitoreo continuo (ventana móvil) --------
    //
    // Congela, junto con el resultado puntual de arriba, el estado de
    // salud calculado en el momento de esta evaluación -- ver
    // src/utils/CalibrationHealth.js y
    // CalibrationEffectivenessService.evaluateAndStore().
    recentSampleSize: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    recentMaeHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    recentBiasHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    previousWindowSampleSize: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    previousWindowMaeHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    previousWindowBiasHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    maeChangePercentage: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    // "IMPROVING" | "DETERIORATING" | "STABLE" | null.
    trend: {

        type: DataTypes.STRING(20),

        allowNull: true

    },

    // "HEALTHY" | "WARNING" | "DEGRADED" | "INSUFFICIENT_DATA".
    health: {

        type: DataTypes.STRING(30),

        allowNull: true

    },

    recommendRecalibration: {

        type: DataTypes.BOOLEAN,

        allowNull: false,

        defaultValue: false

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

    tableName: "maturation_calibration_evaluations",

    timestamps: true

});

module.exports = MaturationCalibrationEvaluation;
