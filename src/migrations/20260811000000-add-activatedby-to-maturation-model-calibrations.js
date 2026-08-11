"use strict";

/*
 * Entrega 2.6.1.25, sección 7 -- "quién decidió poner la calibración en
 * producción". `activatedAt` ya existía desde 2.6.1.16 (solo la fecha);
 * `activatedBy` era el único campo de la terna created/approved/
 * activated que le faltaba a esta tabla (created/approved ya tenían su
 * "por quién" desde 2.6.1.16/2.6.1.24). Mismo criterio "texto libre,
 * sin autenticación" de siempre.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "maturation_model_calibrations",

      "activatedBy",

      {

        type: Sequelize.STRING(100),

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("maturation_model_calibrations", "activatedBy");

  }

};
