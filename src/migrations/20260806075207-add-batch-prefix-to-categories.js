"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "categories",

      "batchPrefix",

      {

        type: Sequelize.STRING(5),

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn(

      "categories",

      "batchPrefix"

    );

  }

};