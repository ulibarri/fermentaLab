"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "recipes",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        code: {

          type: Sequelize.STRING(20),

          allowNull: false,

          unique: true

        },

        productId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "products",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "RESTRICT"

        },

        name: {

          type: Sequelize.STRING(100),

          allowNull: false

        },

        description: {

          type: Sequelize.STRING(255),

          allowNull: true

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

    await queryInterface.dropTable("recipes");

  }

};