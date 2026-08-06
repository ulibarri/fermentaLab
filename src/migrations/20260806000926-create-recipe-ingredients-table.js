"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "recipe_ingredients",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        recipeVersionId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "recipe_versions",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE"

        },

        ingredientId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "ingredients",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "RESTRICT"

        },

        unitId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "units",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "RESTRICT"

        },

        quantity: {

          type: Sequelize.DECIMAL(12, 3),

          allowNull: false

        },

        sortOrder: {

          type: Sequelize.INTEGER,

          allowNull: false,

          defaultValue: 1

        },

        notes: {

          type: Sequelize.STRING(255),

          allowNull: true

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

      "recipe_ingredients"

    );

  }

};