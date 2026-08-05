"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "units",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        code: {

          type: Sequelize.STRING(10),

          allowNull: false,

          unique: true

        },

        name: {

          type: Sequelize.STRING(50),

          allowNull: false

        },

        symbol: {

          type: Sequelize.STRING(10),

          allowNull: false

        },

        active: {

          type: Sequelize.BOOLEAN,

          allowNull: false,

          defaultValue: true

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

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "units"

    );

  }

};