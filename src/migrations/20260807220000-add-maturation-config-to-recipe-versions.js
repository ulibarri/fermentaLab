"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "recipe_versions",

      "maturationMetric",

      {

        type: Sequelize.STRING(30),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "recipe_versions",

      "maturationTarget",

      {

        type: Sequelize.DECIMAL(10, 4),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "recipe_versions",

      "maturationRateThreshold",

      {

        type: Sequelize.DECIMAL(10, 4),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "recipe_versions",

      "maturationTargetTolerance",

      {

        type: Sequelize.DECIMAL(10, 4),

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn(
      "recipe_versions",
      "maturationMetric"
    );

    await queryInterface.removeColumn(
      "recipe_versions",
      "maturationTarget"
    );

    await queryInterface.removeColumn(
      "recipe_versions",
      "maturationRateThreshold"
    );

    await queryInterface.removeColumn(
      "recipe_versions",
      "maturationTargetTolerance"
    );

  }

};
