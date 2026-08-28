"use strict";

/*
 * Entrega 2.7.0.2, sección 3 -- "ProductionPrediction" (conceptual):
 * MaturationPrediction ya cubre casi todos los campos mínimos pedidos
 * por el spec (id, productionBatchId, calibrationId, predictedAt,
 * predictedMaturationAt≈predictedFinishAt, confidenceLowerBound/
 * UpperBound≈lowerBound/upperBound desde 2.7.0.1, modelConfigurationId≈
 * modelId) -- el único campo que faltaba es `phase`. Aditivo puro
 * (ninguna columna existente cambia), nullable: las filas históricas
 * (generadas antes de esta entrega, siempre F1 en la práctica ya que
 * F2 nunca disparó predicciones) simplemente no tienen este dato
 * retroactivamente inventado -- solo las predicciones nuevas lo
 * estampan (ver MaturationPredictionService.generatePrediction()).
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "maturation_predictions",

      "phase",

      {

        type: Sequelize.STRING(10),

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("maturation_predictions", "phase");

  }

};
