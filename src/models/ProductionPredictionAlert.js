const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.7.0.3 — alertas de desviación de la fermentación.
 *
 * Cada fila representa UN episodio continuo de desviación detectado
 * para un lote concreto (nunca una medición individual -- la severidad
 * se decide comparando la predicción vigente contra la línea base de la
 * predicción anterior, ver PredictionDeviation.js/
 * ProductionPredictionAlertService).
 *
 * Ciclo de vida (sección 8):
 *   ACTIVE -> RESOLVED
 *
 * Mientras la desviación continúa (incluso si su severidad escala de
 * WARNING a SIGNIFICANT, por ejemplo), la MISMA fila se refresca en el
 * lugar -- nunca se crea una segunda fila para el mismo episodio
 * (sección 7, requisito explícito: "no queremos Alerta 1, Alerta 2,
 * Alerta 3..."). Solo cuando el lote vuelve al intervalo esperado la
 * fila pasa a RESOLVED, y a partir de ahí queda fija como registro
 * histórico permanente (sección 8/16 -- nunca se borra).
 *
 * Deliberadamente una entidad SEPARADA de MaturationModelAlert
 * (2.6.1.21, degradación del MODELO) -- sección 10 del spec: una
 * desviación de UN lote nunca debe mezclarse con, ni disparar
 * automáticamente, una conclusión sobre el modelo o una recalibración.
 */
const ProductionPredictionAlert = sequelize.define("ProductionPredictionAlert", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    productionBatchId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    predictionId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    // "SLOWER" | "FASTER" -- ver PredictionDeviation.js.
    type: {

        type: DataTypes.STRING(10),

        allowNull: false

    },

    // "WARNING" | "SIGNIFICANT" | "CRITICAL".
    severity: {

        type: DataTypes.STRING(20),

        allowNull: false

    },

    expectedFinishAt: {

        type: DataTypes.DATE,

        allowNull: false

    },

    predictedFinishAt: {

        type: DataTypes.DATE,

        allowNull: false

    },

    deviationMinutes: {

        type: DataTypes.FLOAT,

        allowNull: false

    },

    // "ACTIVE" | "RESOLVED".
    status: {

        type: DataTypes.STRING(20),

        allowNull: false,

        defaultValue: "ACTIVE"

    },

    message: {

        type: DataTypes.TEXT,

        allowNull: false

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

    tableName: "production_prediction_alerts",

    timestamps: true

});

module.exports = ProductionPredictionAlert;
