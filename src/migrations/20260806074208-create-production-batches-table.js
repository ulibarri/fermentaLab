"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "production_batches",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        batchNumber: {

          type: Sequelize.STRING(30),

          allowNull: false,

          unique: true

        },

        recipeVersionId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "recipe_versions",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "RESTRICT"

        },

        plannedVolume: {

          type: Sequelize.DECIMAL(10, 3),

          allowNull: false

        },

        producedVolume: {

          type: Sequelize.DECIMAL(10, 3),

          allowNull: true

        },

        status: {

          type: Sequelize.STRING(30),

          allowNull: false,

          defaultValue: "PLANNED"

        },

        startedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        finishedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        notes: {

          type: Sequelize.TEXT,

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

      "production_batches"

    );

  }

};