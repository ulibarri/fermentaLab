"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    // --- Entrega 2.7.0.6, sección 3 -- "fotografía" del estado del
    // lote al momento de registrar la acción. Nunca se recalcula
    // retroactivamente (sección 11): estos valores quedan fijos aunque
    // la predicción cambie o la alerta se resuelva después.

    await queryInterface.addColumn(

      "production_alert_actions",

      "productionBatchId",

      {

        // Denormalizado desde `alert.productionBatchId` -- sección 18
        // pide poder consultar "todas las acciones pendientes de UN
        // lote" (para disparar la evaluación automática, sección 4) sin
        // depender de un JOIN contra production_prediction_alerts en
        // cada medición nueva. Nunca cambia tras crearse la fila.
        type: Sequelize.INTEGER,

        allowNull: true,

        references: {

          model: "production_batches",

          key: "id"

        },

        onUpdate: "CASCADE",

        onDelete: "CASCADE"

      }

    );

    await queryInterface.addColumn(

      "production_alert_actions",

      "alertSeverityAtAction",

      {

        type: Sequelize.STRING(20),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_alert_actions",

      "deviationMinutesAtAction",

      {

        type: Sequelize.FLOAT,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_alert_actions",

      "predictionIdAtAction",

      {

        type: Sequelize.INTEGER,

        allowNull: true,

        references: {

          model: "maturation_predictions",

          key: "id"

        },

        onUpdate: "CASCADE",

        onDelete: "SET NULL"

      }

    );

    // "Si existe información disponible" (sección 3) -- nullable a
    // propósito, a diferencia de los tres campos de arriba (que siempre
    // están presentes porque provienen de columnas NOT NULL de
    // ProductionPredictionAlert).
    await queryInterface.addColumn(

      "production_alert_actions",

      "predictedFinishAtAction",

      {

        type: Sequelize.DATE,

        allowNull: true

      }

    );

    // --- Sección 11 -- resultado de la evaluación posterior. Un único
    // resultado persistido por acción (sección 12: "para esta entrega
    // propongo mantener un único resultado... effectivenessHistory
    // queda para una entrega futura").

    await queryInterface.addColumn(

      "production_alert_actions",

      "effectivenessStatus",

      {

        type: Sequelize.STRING(20),

        allowNull: false,

        defaultValue: "PENDING"

      }

    );

    await queryInterface.addColumn(

      "production_alert_actions",

      "effectivenessEvaluatedAt",

      {

        type: Sequelize.DATE,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_alert_actions",

      "deviationMinutesAfter",

      {

        type: Sequelize.FLOAT,

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_alert_actions",

      "severityAfter",

      {

        type: Sequelize.STRING(20),

        allowNull: true

      }

    );

    await queryInterface.addColumn(

      "production_alert_actions",

      "predictionIdAfter",

      {

        type: Sequelize.INTEGER,

        allowNull: true,

        references: {

          model: "maturation_predictions",

          key: "id"

        },

        onUpdate: "CASCADE",

        onDelete: "SET NULL"

      }

    );

    // Consulta más frecuente de esta entrega (sección 4): "todas las
    // acciones PENDING de UN lote", disparada cada vez que llega una
    // predicción nueva.
    await queryInterface.addIndex(

      "production_alert_actions",

      ["productionBatchId", "effectivenessStatus"]

    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn("production_alert_actions", "predictionIdAfter");
    await queryInterface.removeColumn("production_alert_actions", "severityAfter");
    await queryInterface.removeColumn("production_alert_actions", "deviationMinutesAfter");
    await queryInterface.removeColumn("production_alert_actions", "effectivenessEvaluatedAt");
    await queryInterface.removeColumn("production_alert_actions", "effectivenessStatus");
    await queryInterface.removeColumn("production_alert_actions", "predictedFinishAtAction");
    await queryInterface.removeColumn("production_alert_actions", "predictionIdAtAction");
    await queryInterface.removeColumn("production_alert_actions", "deviationMinutesAtAction");
    await queryInterface.removeColumn("production_alert_actions", "alertSeverityAtAction");
    await queryInterface.removeColumn("production_alert_actions", "productionBatchId");

  }

};
