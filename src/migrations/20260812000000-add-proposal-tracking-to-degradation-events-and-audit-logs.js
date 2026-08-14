"use strict";

/*
 * Entrega 2.6.1.29 -- generación automática de propuestas de
 * recalibración a partir de una alerta de degradación (2.6.1.28).
 *
 * Dos columnas aditivas, cada una completando una mitad de la
 * trazabilidad bidireccional que pide la sección 8 del spec
 * ("DegradationEvent -> proposalId -> RecalibrationProposal" /
 * "desde la propuesta -> sourceAlert"):
 *
 *   - maturation_calibration_degradation_events.proposalId: el
 *     puntero "hacia adelante" (alerta -> propuesta). Vive en el
 *     EVENTO, no en la calibración -- una calibración "propuesta"
 *     (parentCalibrationId no nulo, 2.6.1.24) puede haber nacido del
 *     flujo de alertas de SALUD (2.6.1.21/23, sin ningún evento de
 *     degradación involucrado) o de este flujo nuevo; el evento de
 *     degradación es quien sabe, sin ambigüedad, si generó una
 *     propuesta y cuál. Nullable: la enorme mayoría de eventos
 *     (DETECTED todavía sin decisión, o RESOLVED por recuperación
 *     espontánea) nunca tienen una.
 *
 *   - maturation_alert_audit_logs.degradationEventId: paralelo a la
 *     columna `alertId` ya existente (2.6.1.23, que apunta a
 *     maturation_model_alerts) -- mismo criterio de "un único log de
 *     auditoría para todo el ciclo de vida de calibraciones/alertas"
 *     (nunca un segundo mecanismo de auditoría paralelo), solo que
 *     esta acción nueva (GENERATE_RECALIBRATION_PROPOSAL_FROM_DEGRADATION)
 *     se origina en una MaturationCalibrationDegradationEvent en vez
 *     de una MaturationModelAlert -- de ahí la columna separada en
 *     vez de reutilizar `alertId` con un significado distinto.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(

      "maturation_calibration_degradation_events",

      "proposalId",

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

    await queryInterface.addColumn(

      "maturation_alert_audit_logs",

      "degradationEventId",

      {

        type: Sequelize.INTEGER,

        allowNull: true,

        references: {

          model: "maturation_calibration_degradation_events",

          key: "id"

        },

        onUpdate: "CASCADE",

        onDelete: "SET NULL"

      }

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("maturation_alert_audit_logs", "degradationEventId");

    await queryInterface.removeColumn("maturation_calibration_degradation_events", "proposalId");

  }

};
