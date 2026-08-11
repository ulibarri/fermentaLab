"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    // rawPredictedMaturationAt: la salida CRUDA del modelo, antes de
    // aplicar cualquier offset de calibración. predictedMaturationAt
    // (columna ya existente desde 2.6.1.12) sigue siendo el valor FINAL
    // -- el que de verdad se muestra como "la predicción" -- para no
    // romper ningún consumidor existente de esa columna (sección 9 de
    // la especificación: "no debemos esconder la predicción original",
    // pero tampoco se puede dejar de mostrar la final en el mismo campo
    // que ya usan las entregas 2.6.1.12-2.6.1.15).
    await queryInterface.addColumn(

      "maturation_predictions",

      "rawPredictedMaturationAt",

      {

        type: Sequelize.DATE,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_predictions",

      "calibrationOffsetHours",

      {

        type: Sequelize.DECIMAL(10, 2),

        allowNull: true

      }

    );

    // Nullable: la mayoría de las predicciones nunca tendrán una
    // calibración ACTIVE que les aplique. FK nullable con onDelete
    // SET NULL (a diferencia de modelConfigurationId, que es
    // obligatorio y usa CASCADE) -- este proyecto no expone ningún
    // endpoint para borrar una calibración, pero si algún día lo
    // hiciera, perder la fila de calibración no debería arrastrar
    // consigo predicciones históricas ya generadas (sección 10:
    // trazabilidad completa incluso "seis meses después").
    await queryInterface.addColumn(

      "maturation_predictions",

      "calibrationId",

      {

        type: Sequelize.INTEGER,

        allowNull: true,

        references: {

          model: "maturation_model_calibrations",

          key: "id"

        },

        onUpdate: "CASCADE",

        onDelete: "SET NULL"

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("maturation_predictions", "calibrationId");

    await queryInterface.removeColumn("maturation_predictions", "calibrationOffsetHours");

    await queryInterface.removeColumn("maturation_predictions", "rawPredictedMaturationAt");

  }

};
