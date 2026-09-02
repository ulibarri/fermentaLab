"use strict";

/*
 * Entrega 2.8.0.2, secciones 1-4/12 -- cabecera de una versión de la
 * tabla de conversión del fabricante. Ver comentarios en
 * src/models/HydrometerConversionTable.js para el detalle de cada
 * campo.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "hydrometer_conversion_tables",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        name: {

          type: Sequelize.STRING(150),

          allowNull: false

        },

        manufacturer: {

          type: Sequelize.STRING(150),

          allowNull: true

        },

        instrument: {

          type: Sequelize.STRING(60),

          allowNull: false

        },

        source: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        version: {

          type: Sequelize.INTEGER,

          allowNull: false,

          defaultValue: 1

        },

        parentTableId: {

          type: Sequelize.INTEGER,

          allowNull: true,

          references: {

            model: "hydrometer_conversion_tables",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "SET NULL"

        },

        // "DRAFT" | "VALIDATED" | "ACTIVE" | "INACTIVE".
        status: {

          type: Sequelize.STRING(20),

          allowNull: false,

          defaultValue: "DRAFT"

        },

        rowCount: {

          type: Sequelize.INTEGER,

          allowNull: true

        },

        minSg: {

          type: Sequelize.DECIMAL(10, 4),

          allowNull: true

        },

        maxSg: {

          type: Sequelize.DECIMAL(10, 4),

          allowNull: true

        },

        lastValidationErrors: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        createdBy: {

          type: Sequelize.STRING(120),

          allowNull: true

        },

        validatedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        validatedBy: {

          type: Sequelize.STRING(120),

          allowNull: true

        },

        activatedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        activatedBy: {

          type: Sequelize.STRING(120),

          allowNull: true

        },

        deactivatedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        changeReason: {

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

    // Consulta más frecuente (sección 15, GET /api/hydrometer/convert
    // usa la tabla ACTIVE de un instrumento): a lo sumo una fila ACTIVE
    // por instrument.
    await queryInterface.addIndex(

      "hydrometer_conversion_tables",

      ["instrument", "status"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "hydrometer_conversion_tables"

    );

  }

};
