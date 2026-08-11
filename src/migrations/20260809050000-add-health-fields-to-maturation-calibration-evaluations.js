"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    // Entrega 2.6.1.18 -- monitoreo continuo. Cada vez que se guarda una
    // evaluación (POST /calibrations/:id/evaluate), además del resultado
    // puntual ya persistido (2.6.1.17), ahora también se congela el
    // estado de salud calculado en ese momento -- sección 19: "Así
    // podremos reconstruir posteriormente [una línea de tiempo de
    // salud] sin perder información."

    await queryInterface.addColumn(

      "maturation_calibration_evaluations",

      "recentSampleSize",

      {

        type: Sequelize.INTEGER,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_calibration_evaluations",

      "recentMaeHours",

      {

        type: Sequelize.DECIMAL(10, 2),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_calibration_evaluations",

      "recentBiasHours",

      {

        type: Sequelize.DECIMAL(10, 2),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_calibration_evaluations",

      "previousWindowSampleSize",

      {

        type: Sequelize.INTEGER,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_calibration_evaluations",

      "previousWindowMaeHours",

      {

        type: Sequelize.DECIMAL(10, 2),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_calibration_evaluations",

      "previousWindowBiasHours",

      {

        type: Sequelize.DECIMAL(10, 2),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_calibration_evaluations",

      "maeChangePercentage",

      {

        type: Sequelize.DECIMAL(10, 2),

        allowNull: true

      }

    );

    // "IMPROVING" | "DETERIORATING" | "STABLE" | null (null cuando no
    // hay suficientes muestras en la ventana anterior para comparar).
    await queryInterface.addColumn(

      "maturation_calibration_evaluations",

      "trend",

      {

        type: Sequelize.STRING(20),

        allowNull: true

      }

    );

    // "HEALTHY" | "WARNING" | "DEGRADED" | "INSUFFICIENT_DATA".
    await queryInterface.addColumn(

      "maturation_calibration_evaluations",

      "health",

      {

        type: Sequelize.STRING(30),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_calibration_evaluations",

      "recommendRecalibration",

      {

        type: Sequelize.BOOLEAN,

        allowNull: false,

        defaultValue: false

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("maturation_calibration_evaluations", "recommendRecalibration");

    await queryInterface.removeColumn("maturation_calibration_evaluations", "health");

    await queryInterface.removeColumn("maturation_calibration_evaluations", "trend");

    await queryInterface.removeColumn("maturation_calibration_evaluations", "maeChangePercentage");

    await queryInterface.removeColumn("maturation_calibration_evaluations", "previousWindowBiasHours");

    await queryInterface.removeColumn("maturation_calibration_evaluations", "previousWindowMaeHours");

    await queryInterface.removeColumn("maturation_calibration_evaluations", "previousWindowSampleSize");

    await queryInterface.removeColumn("maturation_calibration_evaluations", "recentBiasHours");

    await queryInterface.removeColumn("maturation_calibration_evaluations", "recentMaeHours");

    await queryInterface.removeColumn("maturation_calibration_evaluations", "recentSampleSize");

  }

};
