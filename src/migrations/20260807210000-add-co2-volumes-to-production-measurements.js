"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "production_measurements",

      "co2Volumes",

      {

        type: Sequelize.DECIMAL(6, 3),

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn(

      "production_measurements",

      "co2Volumes"

    );

  }

};
