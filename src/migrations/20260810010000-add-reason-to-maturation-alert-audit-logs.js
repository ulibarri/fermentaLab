"use strict";

/*
 * Entrega 2.6.1.24, sección 12 -- REJECT_RECALIBRATION_PROPOSAL debe
 * conservar el motivo de rechazo en la propia fila de auditoría (para
 * poder reconstruir "Propuesta v3 -> Rechazada -> Usuario: Alex ->
 * Motivo: ... -> Fecha: ..." sin tener que ir a buscarlo en otra
 * parte). Columna nueva, nullable -- las acciones de 2.6.1.23
 * (CREATE_RECALIBRATION_PROPOSAL/ACKNOWLEDGE_ALERT/RESOLVE_ALERT) nunca
 * la usan, quedan en null.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "maturation_alert_audit_logs",

      "reason",

      {

        type: Sequelize.TEXT,

        allowNull: true

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("maturation_alert_audit_logs", "reason");

  }

};
