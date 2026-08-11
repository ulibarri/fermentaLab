"use strict";

/*
 * Entrega 2.6.1.24, secciones 7/8 -- registrar QUIÉN aprobó/rechazó una
 * propuesta y POR QUÉ se rechazó. `approvedAt`/`rejectedAt` ya existían
 * desde 2.6.1.16 (solo la fecha) -- esta migración agrega los tres
 * campos que faltaban, sin tocar ninguno existente. Aditiva y
 * retrocompatible: las filas ya creadas (2.6.1.16-23) simplemente
 * quedan con estos tres campos en null.
 *
 * Mismo criterio "texto libre, sin autenticación" que `createdBy`
 * desde 2.6.1.16 -- ver `MaturationModelCalibrationService.approve()`/
 * `reject()`.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "maturation_model_calibrations",

      "approvedBy",

      {

        type: Sequelize.STRING(100),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_model_calibrations",

      "rejectedBy",

      {

        type: Sequelize.STRING(100),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "maturation_model_calibrations",

      "rejectionReason",

      {

        type: Sequelize.TEXT,

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("maturation_model_calibrations", "approvedBy");

    await queryInterface.removeColumn("maturation_model_calibrations", "rejectedBy");

    await queryInterface.removeColumn("maturation_model_calibrations", "rejectionReason");

  }

};
