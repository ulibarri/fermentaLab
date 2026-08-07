"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "production_measurements",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        productionBatchId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "production_batches",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE"

        },

        measurementDate: {

          type: Sequelize.DATE,

          allowNull: false

        },

        phase: {

          type: Sequelize.STRING(20),

          allowNull: false

        },

        ph: {

          type: Sequelize.DECIMAL(5, 2),

          allowNull: true

        },

        brix: {

          type: Sequelize.DECIMAL(5, 2),

          allowNull: true

        },

        specificGravity: {

          type: Sequelize.DECIMAL(6, 4),

          allowNull: true

        },

        estimatedAlcohol: {

          type: Sequelize.DECIMAL(5, 2),

          allowNull: true

        },

        liquidTemperature: {

          type: Sequelize.DECIMAL(5, 2),

          allowNull: true

        },

        ambientTemperature: {

          type: Sequelize.DECIMAL(5, 2),

          allowNull: true

        },

        psi: {

          type: Sequelize.DECIMAL(10, 3),

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

      "production_measurements"

    );

  }

};
