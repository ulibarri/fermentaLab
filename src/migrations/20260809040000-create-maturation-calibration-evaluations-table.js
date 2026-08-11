"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "maturation_calibration_evaluations",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        calibrationId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "maturation_model_calibrations",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE"

        },

        evaluationStartedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        evaluationEndedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        sampleSize: {

          type: Sequelize.INTEGER,

          allowNull: false,

          defaultValue: 0

        },

        rawMaeHours: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: true

        },

        calibratedMaeHours: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: true

        },

        rawRmseHours: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: true

        },

        calibratedRmseHours: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: true

        },

        rawBiasHours: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: true

        },

        calibratedBiasHours: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: true

        },

        // Sección 18: mejora absoluta en horas (más fácil de interpretar
        // operacionalmente que solo el porcentaje) -- no está en la
        // tabla literal de la sección 11, pero la sección 18 pide
        // explícitamente conservarla.
        maeImprovementHours: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: true

        },

        maeImprovementPercentage: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: true

        },

        // "IMPROVED" | "DEGRADED" | "NO_SIGNIFICANT_CHANGE" | "INSUFFICIENT_DATA".
        result: {

          type: Sequelize.STRING(30),

          allowNull: false

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

    await queryInterface.addIndex(

      "maturation_calibration_evaluations",

      ["calibrationId", "createdAt"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "maturation_calibration_evaluations"

    );

  }

};
