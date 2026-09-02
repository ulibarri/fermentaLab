"use strict";

/*
 * Entrega 2.8.0.1, sección 10 -- trazabilidad de cómo se obtuvo una
 * medición del hidrómetro (SG/Brix/Alcohol): "cuando una medición se
 * calcule automáticamente, debe guardarse cómo se obtuvo." Tres columnas
 * ADITIVAS y NULLABLE sobre `production_measurements`, mismo criterio de
 * siempre en este proyecto (ver `brixLafmate`/`co2Volumes`): nunca se
 * backfillea un valor inventado para las filas históricas (sección 11,
 * "no debemos recalcular automáticamente registros históricos") --
 * quedan en NULL, que se lee como "no se registró cómo se capturó esta
 * lectura" en vez de asumir "MANUAL" retroactivamente para algo que en
 * realidad no sabemos.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "production_measurements",

      "hydrometerInputScale",

      {

        // "SG" | "BRIX" | "ALCOHOL" -- misma convención STRING(20) +
        // allow-list en el servicio que `phase`/`effectivenessStatus`
        // (nunca un Sequelize ENUM real en este proyecto).
        type: Sequelize.STRING(20),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_measurements",

      "hydrometerInputValue",

      {

        // Debe alojar tanto un SG (hasta 4 decimales, ej. 1.0225) como
        // un Brix o %Alcohol (hasta 1-2 decimales) -- DECIMAL(10,4)
        // cubre ambos casos con margen sin perder precisión interna de
        // interpolación (sección 7: "manejar internamente la precisión
        // necesaria").
        type: Sequelize.DECIMAL(10, 4),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_measurements",

      "hydrometerConversionMethod",

      {

        // "MANUAL" | "TABLE_EXACT" | "INTERPOLATED" (sección 10).
        type: Sequelize.STRING(20),

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn(

      "production_measurements",

      "hydrometerConversionMethod"

    );

    await queryInterface.removeColumn(

      "production_measurements",

      "hydrometerInputValue"

    );

    await queryInterface.removeColumn(

      "production_measurements",

      "hydrometerInputScale"

    );

  }

};
