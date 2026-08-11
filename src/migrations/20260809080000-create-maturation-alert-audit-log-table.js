"use strict";

/*
 * Entrega 2.6.1.23, sección 6 -- registro de auditoría para acciones
 * operativas sobre alertas/calibraciones. Tabla append-only: nada la
 * actualiza después de creada (el propio `updatedAt` queda igual a
 * `createdAt` para siempre), pero se mantiene el par timestamps/
 * updatedAt por consistencia con el resto de modelos del proyecto en
 * vez de introducir una convención nueva solo para esta tabla.
 *
 * Campos literales de la sección 6: userId/action/modelId/
 * sourceCalibrationId/targetCalibrationId/createdAt. `alertId` es un
 * campo ADICIONAL más allá de esa lista -- mismo criterio que
 * `MaturationModelAlert.details` (2.6.1.21) o `MaturationPrediction.
 * inputData` (2.6.1.12): sin él, dos acciones ACKNOWLEDGE_ALERT/
 * RESOLVE_ALERT sobre el mismo modelo en momentos distintos solo se
 * podrían distinguir por `createdAt`, lo cual es frágil; con él, cada
 * fila de auditoría apunta sin ambigüedad a la alerta exacta sobre la
 * que se actuó.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "maturation_alert_audit_logs",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        // Sin sistema de autenticación en este proyecto todavía (ver
        // MaturationModelCalibration.createdBy, 2.6.1.16, mismo
        // precedente) -- texto libre, opcional.
        userId: {

          type: Sequelize.STRING(100),

          allowNull: true

        },

        // "CREATE_RECALIBRATION_PROPOSAL" | "ACKNOWLEDGE_ALERT" |
        // "RESOLVE_ALERT" (sección 6, catálogo inicial).
        action: {

          type: Sequelize.STRING(40),

          allowNull: false

        },

        modelId: {

          type: Sequelize.INTEGER,

          allowNull: true,

          references: {

            model: "maturation_model_configurations",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "SET NULL"

        },

        // Campo adicional (ver comentario de arriba) -- nullable porque
        // CREATE_RECALIBRATION_PROPOSAL no actúa sobre ninguna alerta
        // concreta.
        alertId: {

          type: Sequelize.INTEGER,

          allowNull: true,

          references: {

            model: "maturation_model_alerts",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "SET NULL"

        },

        sourceCalibrationId: {

          type: Sequelize.INTEGER,

          allowNull: true,

          references: {

            model: "maturation_model_calibrations",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "SET NULL"

        },

        targetCalibrationId: {

          type: Sequelize.INTEGER,

          allowNull: true,

          references: {

            model: "maturation_model_calibrations",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "SET NULL"

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

    await queryInterface.addIndex(

      "maturation_alert_audit_logs",

      ["modelId", "createdAt"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "maturation_alert_audit_logs"

    );

  }

};
