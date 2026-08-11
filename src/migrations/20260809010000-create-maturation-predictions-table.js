"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "maturation_predictions",

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

        // Referencia fundamental de qué configuración produjo esta
        // predicción -- nunca solo `modelType`, porque puede existir
        // más de una configuración histórica del mismo tipo de modelo
        // (sección 2 de la especificación).
        modelConfigurationId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "maturation_model_configurations",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE"

        },

        predictedAt: {

          type: Sequelize.DATE,

          allowNull: false

        },

        predictedMaturationAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        predictedDurationHours: {

          type: Sequelize.DECIMAL(10, 2),

          allowNull: true

        },

        // Copia denormalizada de modelConfiguration.modelType al
        // momento de la predicción -- conveniencia de lectura, la
        // fuente de verdad sigue siendo modelConfigurationId.
        modelType: {

          type: Sequelize.STRING(30),

          allowNull: false

        },

        // Snapshot JSON (como texto) de los datos de entrada usados
        // para esta predicción -- ver MaturationPredictionService,
        // sección 3 de la especificación.
        inputData: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        notes: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        // Solo una predicción por lote debe tener isCurrent=true a la
        // vez -- garantizado por la transacción de generación
        // (marcar-anteriores-como-no-actuales + crear la nueva), no
        // por una restricción de base de datos (mismo criterio que
        // MaturationModelConfiguration.status en 2.6.1.11).
        isCurrent: {

          type: Sequelize.BOOLEAN,

          allowNull: false,

          defaultValue: false

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

    await queryInterface.addIndex(

      "maturation_predictions",

      ["productionBatchId", "isCurrent"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "maturation_predictions"

    );

  }

};
