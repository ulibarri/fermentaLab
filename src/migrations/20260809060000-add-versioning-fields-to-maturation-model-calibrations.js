"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    // Entrega 2.6.1.19 -- versionado y reemplazo controlado de
    // calibraciones (sección 2/3). Una calibración nunca se sobrescribe:
    // corregir un offset significa crear una fila NUEVA que apunta a la
    // anterior via parentCalibrationId, nunca hacer UPDATE sobre
    // offsetHours de una fila ya evaluada/activa.

    // Self-FK -- null en la primera versión de una cadena (sección 2,
    // ejemplo Calibration #7). onDelete: SET NULL por el mismo motivo
    // que calibrationId en maturation_predictions (2.6.1.16): este
    // proyecto no tiene endpoint DELETE para calibraciones (sección 5,
    // regla explícita "no eliminar calibraciones"), pero un ON DELETE
    // RESTRICT sin necesidad real solo complicaría una operación manual
    // de mantenimiento futura -- perder el padre nunca debe arrastrar
    // consigo el borrado de sus hijos.
    await queryInterface.addColumn(

      "maturation_model_calibrations",

      "parentCalibrationId",

      {

        type: Sequelize.INTEGER,

        allowNull: true,

        references: {

          model: "maturation_model_calibrations",

          key: "id"

        },

        onDelete: "SET NULL"

      }

    );

    // Incremental dentro de (modelType, recipeVersionId) -- nunca
    // global (sección 3). Se calcula en el repositorio al crear, nunca
    // se deja que el cliente lo proponga.
    await queryInterface.addColumn(

      "maturation_model_calibrations",

      "version",

      {

        type: Sequelize.INTEGER,

        allowNull: false,

        defaultValue: 1

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("maturation_model_calibrations", "version");

    await queryInterface.removeColumn("maturation_model_calibrations", "parentCalibrationId");

  }

};
