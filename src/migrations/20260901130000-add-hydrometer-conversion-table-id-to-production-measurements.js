"use strict";

/*
 * Entrega 2.8.0.2, sección 5 -- "las mediciones calculadas
 * automáticamente deben poder identificar con qué tabla de conversión
 * se calcularon", además de los campos ya existentes desde 2.8.0.1
 * (hydrometerInputScale/hydrometerInputValue/hydrometerConversionMethod).
 * Columna ADITIVA y NULLABLE, mismo criterio que esa entrega: nunca se
 * backfillea un valor inventado para filas históricas (ni las de antes
 * de 2.8.0.1, ni las capturadas en modo AUTO entre 2.8.0.1 y esta
 * entrega, que nunca tuvieron una tabla en base de datos con la cual
 * relacionarlas) -- quedan en NULL, que se lee como "no se registró con
 * qué tabla se calculó esta lectura".
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "production_measurements",

      "hydrometerConversionTableId",

      {

        type: Sequelize.INTEGER,

        allowNull: true,

        references: {

          model: "hydrometer_conversion_tables",

          key: "id"

        },

        onUpdate: "CASCADE",

        onDelete: "SET NULL"

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn(

      "production_measurements",

      "hydrometerConversionTableId"

    );

  }

};
