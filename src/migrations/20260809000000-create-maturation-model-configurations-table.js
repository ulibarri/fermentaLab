"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "maturation_model_configurations",

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

        modelType: {

          type: Sequelize.STRING(30),

          allowNull: false

        },

        status: {

          type: Sequelize.STRING(20),

          allowNull: false,

          defaultValue: "INACTIVE"

        },

        activatedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        deactivatedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        source: {

          type: Sequelize.STRING(20),

          allowNull: false

        },

        activatedBy: {

          type: Sequelize.STRING(120),

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

    // Consulta más frecuente: encontrar el modelo ACTIVE de una
    // recipeVersion (debe existir a lo sumo uno). Un índice compuesto
    // acelera esa búsqueda; la unicidad en sí la garantiza la
    // transacción de activación (desactivar-antes-de-activar), no una
    // restricción de base de datos, porque SQLite no soporta índices
    // únicos parciales (WHERE status = 'ACTIVE') de forma portable.
    await queryInterface.addIndex(

      "maturation_model_configurations",

      ["recipeVersionId", "status"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "maturation_model_configurations"

    );

  }

};
