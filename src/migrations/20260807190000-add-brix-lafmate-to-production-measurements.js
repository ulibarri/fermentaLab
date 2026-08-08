"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "production_measurements",

      "brixLafmate",

      {

        type: Sequelize.DECIMAL(5, 2),

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn(

      "production_measurements",

      "brixLafmate"

    );

  }

};
