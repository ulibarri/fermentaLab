"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "recipe_versions",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        recipeId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "recipes",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE"

        },

        version: {

          type: Sequelize.INTEGER,

          allowNull: false

        },

        batchSize: {

          type: Sequelize.DECIMAL(10, 3),

          allowNull: false

        },

        batchUnitId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "units",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "RESTRICT"

        },

        notes: {

          type: Sequelize.STRING(255),

          allowNull: true

        },

        isCurrent: {

          type: Sequelize.BOOLEAN,

          allowNull: false,

          defaultValue: true

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

    await queryInterface.dropTable("recipe_versions");

  }

};