"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "production_batches",

      "targetVolume",

      {

        type: Sequelize.DECIMAL(10, 3),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_batches",

      "secondFermentStartedAt",

      {

        type: Sequelize.DATE,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_batches",

      "secondFermentFinishedAt",

      {

        type: Sequelize.DATE,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_batches",

      "finalPsiReading",

      {

        type: Sequelize.DECIMAL(10, 3),

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn(

      "production_batches",

      "targetVolume"

    );

    await queryInterface.removeColumn(

      "production_batches",

      "secondFermentStartedAt"

    );

    await queryInterface.removeColumn(

      "production_batches",

      "secondFermentFinishedAt"

    );

    await queryInterface.removeColumn(

      "production_batches",

      "finalPsiReading"

    );

  }

};
