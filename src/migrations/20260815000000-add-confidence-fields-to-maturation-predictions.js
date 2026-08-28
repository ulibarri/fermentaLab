"use strict";

/*
 * Entrega 2.7.0.1, sección 8 -- "trazabilidad": cada predicción debe
 * conservar sus "límites de confianza" además de lo que ya guardaba
 * desde 2.6.1.12/16 (modelo, calibración, fecha, entradas). Aditivo
 * puro -- ninguna columna existente cambia, así que ninguna fila
 * histórica ni ningún consumidor previo de MaturationPrediction se ve
 * afectado. Todas las columnas nuevas son nullable: una predicción
 * generada sin evidencia histórica suficiente (o antes de esta entrega)
 * simplemente no tiene ventana de confianza, nunca un número inventado.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "maturation_predictions",

      "confidenceLowerBound",

      {

        type: Sequelize.DATE,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_predictions",

      "confidenceUpperBound",

      {

        type: Sequelize.DATE,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_predictions",

      "confidenceWindowHours",

      {

        type: Sequelize.FLOAT,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_predictions",

      "confidencePercentage",

      {

        type: Sequelize.FLOAT,

        allowNull: true

      }

    );

    // "CALIBRATION" (histórico de la calibración usada) / "MODEL"
    // (histórico general del modelConfiguration, sin calibración
    // aplicable) / "UNAVAILABLE" (sin evidencia suficiente) -- ver
    // PredictionConfidence.js.
    await queryInterface.addColumn(

      "maturation_predictions",

      "confidenceBasis",

      {

        type: Sequelize.STRING(20),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_predictions",

      "confidenceSampleSize",

      {

        type: Sequelize.INTEGER,

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("maturation_predictions", "confidenceSampleSize");
    await queryInterface.removeColumn("maturation_predictions", "confidenceBasis");
    await queryInterface.removeColumn("maturation_predictions", "confidencePercentage");
    await queryInterface.removeColumn("maturation_predictions", "confidenceWindowHours");
    await queryInterface.removeColumn("maturation_predictions", "confidenceUpperBound");
    await queryInterface.removeColumn("maturation_predictions", "confidenceLowerBound");

  }

};
