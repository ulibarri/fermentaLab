"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "maturation_model_calibrations",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        // Regla fundamental (sección 2 de la especificación): una
        // calibración nunca pertenece solo al modelType -- siempre está
        // acotada a una recipeVersion específica. Nunca se debe aplicar
        // el offset calculado para "Tepache Original v3" a "Tepache
        // Original v4" ni a "Tamarindo v2".
        modelType: {

          type: Sequelize.STRING(30),

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

        offsetHours: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: false

        },

        // "PROPOSED" | "APPROVED" | "ACTIVE" | "REJECTED" | "INACTIVE".
        // Solo puede haber una fila ACTIVE por (modelType,
        // recipeVersionId) a la vez -- garantizado por la transacción de
        // activación (mismo criterio que MaturationModelConfiguration en
        // 2.6.1.11), no por una restricción de base de datos.
        status: {

          type: Sequelize.STRING(20),

          allowNull: false,

          defaultValue: "PROPOSED"

        },

        // Tamaño de muestra y Bias del análisis de sesgo (2.6.1.15) que
        // dio origen a esta propuesta -- se congelan al crear la
        // propuesta para que el historial siga siendo interpretable
        // aunque más adelante se evalúen más lotes y el Bias "actual"
        // cambie.
        sampleSize: {

          type: Sequelize.INTEGER,

          allowNull: true

        },

        biasHours: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: true

        },

        reason: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        approvedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        rejectedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        activatedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        deactivatedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        // Texto libre, mismo criterio que MaturationModelConfiguration
        // .activatedBy -- este proyecto no tiene sistema de
        // usuarios/login.
        createdBy: {

          type: Sequelize.STRING(120),

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

    // Consulta más frecuente: encontrar la calibración ACTIVE de un
    // (modelType, recipeVersionId) -- debe existir a lo sumo una.
    await queryInterface.addIndex(

      "maturation_model_calibrations",

      ["modelType", "recipeVersionId", "status"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "maturation_model_calibrations"

    );

  }

};
