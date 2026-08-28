"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "production_prediction_alerts",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        // Entrega 2.7.0.3, sección 6 -- "ProductionPredictionAlert
        // relacionada con ProductionBatch". Deliberadamente separada de
        // maturation_model_alerts (2.6.1.21, alertas de DEGRADACIÓN DEL
        // MODELO) -- ver sección 10 del spec, "no debemos mezclar alerta
        // de lote con alerta de degradación del modelo".
        productionBatchId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "production_batches",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE"

        },

        // La predicción VIGENTE en el momento en que se creó/actualizó
        // esta alerta (sección 6: "relacionada con ProductionPrediction").
        // Se refresca junto con el resto de la fila mientras la alerta
        // sigue ACTIVE (nunca crea una fila nueva -- sección 7).
        predictionId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "maturation_predictions",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE"

        },

        // "SLOWER" | "FASTER" -- dirección de la desviación (mismo
        // vocabulario que BatchOperationalStatus.classifyDrift(),
        // 2.7.0.1). Ver PredictionDeviation.js.
        type: {

          type: Sequelize.STRING(10),

          allowNull: false

        },

        // "WARNING" | "SIGNIFICANT" | "CRITICAL" (sección 2/3).
        severity: {

          type: Sequelize.STRING(20),

          allowNull: false

        },

        // Centro del intervalo de la predicción usada como línea base
        // (sección 5 -- "Predicción: 18:00" del ejemplo).
        expectedFinishAt: {

          type: Sequelize.DATE,

          allowNull: false

        },

        // ETA de la predicción vigente que disparó/mantiene esta alerta.
        predictedFinishAt: {

          type: Sequelize.DATE,

          allowNull: false

        },

        deviationMinutes: {

          type: Sequelize.FLOAT,

          allowNull: false

        },

        // "ACTIVE" | "RESOLVED" (sección 6/8).
        status: {

          type: Sequelize.STRING(20),

          allowNull: false,

          defaultValue: "ACTIVE"

        },

        message: {

          type: Sequelize.TEXT,

          allowNull: false

        },

        resolvedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        createdAt: {

          type: Sequelize.DATE,

          allowNull: false

        },

        updatedAt: {

          type: Sequelize.DATE,

          allowNull: false

        }

      }

    );

    // Consulta más frecuente: la alerta ACTIVE (a lo sumo una,
    // sección 7 -- "no queremos alerta 1, alerta 2...") de un lote.
    await queryInterface.addIndex(

      "production_prediction_alerts",

      ["productionBatchId", "status"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "production_prediction_alerts"

    );

  }

};
