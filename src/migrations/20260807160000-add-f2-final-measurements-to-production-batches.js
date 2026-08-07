"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "production_batches",

      "finalPh",

      {

        type: Sequelize.DECIMAL(5, 2),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_batches",

      "finalBrix",

      {

        type: Sequelize.DECIMAL(5, 2),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_batches",

      "finalSpecificGravity",

      {

        type: Sequelize.DECIMAL(6, 4),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_batches",

      "estimatedAlcohol",

      {

        type: Sequelize.DECIMAL(5, 2),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_batches",

      "finalTemperature",

      {

        type: Sequelize.DECIMAL(5, 2),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_batches",

      "ambientTemperature",

      {

        type: Sequelize.DECIMAL(5, 2),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_batches",

      "carbonationNotes",

      {

        type: Sequelize.TEXT,

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn(
      "production_batches",
      "finalPh"
    );

    await queryInterface.removeColumn(
      "production_batches",
      "finalBrix"
    );

    await queryInterface.removeColumn(
      "production_batches",
      "finalSpecificGravity"
    );

    await queryInterface.removeColumn(
      "production_batches",
      "estimatedAlcohol"
    );

    await queryInterface.removeColumn(
      "production_batches",
      "finalTemperature"
    );

    await queryInterface.removeColumn(
      "production_batches",
      "ambientTemperature"
    );

    await queryInterface.removeColumn(
      "production_batches",
      "carbonationNotes"
    );

  }

};
