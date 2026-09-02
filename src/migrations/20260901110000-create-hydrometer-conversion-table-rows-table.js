"use strict";

/*
 * Entrega 2.8.0.2, sección 6 -- filas SG/Brix/Alcohol de una versión de
 * tabla (dato puro, ver src/models/HydrometerConversionTableRow.js).
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "hydrometer_conversion_table_rows",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        hydrometerConversionTableId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "hydrometer_conversion_tables",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE"

        },

        rowOrder: {

          type: Sequelize.INTEGER,

          allowNull: false

        },

        sg: {

          type: Sequelize.DECIMAL(10, 4),

          allowNull: false

        },

        brix: {

          type: Sequelize.DECIMAL(10, 4),

          allowNull: false

        },

        alcohol: {

          type: Sequelize.DECIMAL(10, 4),

          allowNull: false

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

    // Consulta más frecuente: todas las filas de una tabla, en orden.
    await queryInterface.addIndex(

      "hydrometer_conversion_table_rows",

      ["hydrometerConversionTableId", "rowOrder"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "hydrometer_conversion_table_rows"

    );

  }

};
