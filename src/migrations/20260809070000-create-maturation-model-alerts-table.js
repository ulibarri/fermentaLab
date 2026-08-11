"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "maturation_model_alerts",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        // A qué modelo (MaturationModelConfiguration, 2.6.1.11)
        // pertenece esta alerta -- sección 8 de la especificación
        // ("modelId" en el mockup es esta FK).
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

        // Calibración a la que se refiere la condición detectada --
        // nullable porque una alerta INSUFFICIENT_DATA por falta de
        // calibración activa no tiene ninguna calibración concreta que
        // señalar (sección 22: "conservar la relación con la
        // calibración origen" cuando sí existe).
        calibrationId: {

          type: Sequelize.INTEGER,

          allowNull: true,

          references: {

            model: "maturation_model_calibrations",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "SET NULL"

        },

        // "WARNING" | "CRITICAL" | "INSUFFICIENT_DATA". INFO nunca se
        // persiste como fila -- ver RecalibrationAlertRules.js: INFO
        // significa "no hay ninguna condición activa que registrar",
        // no una alerta real (sección 9 leída como "una condición
        // activa genera una alerta"; la ausencia de condición no es
        // una condición).
        severity: {

          type: Sequelize.STRING(20),

          allowNull: false

        },

        // "PERFORMANCE_DETERIORATION" | "INSUFFICIENT_DATA" -- catálogo
        // cerrado inicial (sección 8: campo "type").
        type: {

          type: Sequelize.STRING(40),

          allowNull: false

        },

        // "OPEN" | "ACKNOWLEDGED" | "RESOLVED" (sección 11). Se agrega
        // como campo explícito además de acknowledgedAt/resolvedAt --
        // mismo criterio dual status+timestamps que ya usa
        // MaturationModelCalibration (2.6.1.16) para PROPOSED/APPROVED/
        // ACTIVE/etc.
        status: {

          type: Sequelize.STRING(20),

          allowNull: false,

          defaultValue: "OPEN"

        },

        message: {

          type: Sequelize.TEXT,

          allowNull: false

        },

        // Snapshot JSON (como texto) de las métricas que produjeron
        // esta alerta -- maeHistorical/maeRecent/biasHistorical/
        // biasRecent/rmseHistorical/rmseRecent/health/trend -- para que
        // la alerta sea auditable (sección 7: "FermentaLab debe ser
        // auditable y comprensible") incluso después de que las
        // métricas en vivo hayan cambiado. Campo adicional más allá de
        // la lista literal de la sección 8, mismo criterio que
        // MaturationPrediction.inputData (2.6.1.12).
        details: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        acknowledgedAt: {

          type: Sequelize.DATE,

          allowNull: true

        },

        resolvedAt: {

          type: Sequelize.DATE,

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

    // Consulta más frecuente: la alerta OPEN/ACKNOWLEDGED vigente de un
    // modelo (para no duplicar, sección 9/10).
    await queryInterface.addIndex(

      "maturation_model_alerts",

      ["modelConfigurationId", "status"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "maturation_model_alerts"

    );

  }

};
