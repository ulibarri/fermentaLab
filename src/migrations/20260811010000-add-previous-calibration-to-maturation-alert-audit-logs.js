"use strict";

/*
 * Entrega 2.6.1.25, sección 8 -- ACTIVATE_RECALIBRATION debe conservar
 * cuál era la calibración ACTIVE anterior, para poder reconstruir la
 * cadena v1 -> v2 -> v3 -> v4 de cambios de activación a lo largo del
 * tiempo. Deliberadamente una columna NUEVA y separada de
 * `sourceCalibrationId` (ya usada por CREATE_RECALIBRATION_PROPOSAL con
 * un significado distinto: "la calibración de la que se derivó esta
 * propuesta") -- aunque en el caso típico ambas apuntan a la misma fila
 * (la propuesta normalmente reemplaza a la que estaba activa cuando se
 * generó), no son necesariamente la misma en todos los casos, y
 * mezclar dos significados bajo un mismo campo habría sido confuso.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "maturation_alert_audit_logs",

      "previousCalibrationId",

      {

        type: Sequelize.INTEGER,

        allowNull: true,

        references: {

          model: "maturation_model_calibrations",

          key: "id"

        },

        onUpdate: "CASCADE",

        onDelete: "SET NULL"

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("maturation_alert_audit_logs", "previousCalibrationId");

  }

};
