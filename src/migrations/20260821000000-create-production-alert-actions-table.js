"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "production_alert_actions",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        // Entrega 2.7.0.5, sección 7 -- "ProductionPredictionAlert
        // relacionada con Action" (1 a muchos: una alerta puede tener
        // varias acciones registradas, sección 7; también puede no tener
        // ninguna, sección 8). CASCADE: si alguna vez se elimina una
        // alerta (nunca ocurre hoy en la práctica -- las alertas nunca se
        // borran, solo se resuelven), sus acciones no deben quedar
        // huérfanas.
        alertId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "production_prediction_alerts",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE"

        },

        // Código del catálogo de la sección 3 (NO_INTERVENTION,
        // INSPECTION, TEMPERATURE_ADJUSTMENT, LOCATION_TRANSFER,
        // MEASUREMENT_REVIEW, ADDITIONAL_SAMPLE,
        // FERMENTATION_CONDITIONS_CHANGE, EARLY_TERMINATION, OTHER) --
        // ver src/utils/ProductionAlertActionCatalog.js, única fuente de
        // verdad de los códigos válidos.
        type: {

          type: Sequelize.STRING(40),

          allowNull: false

        },

        // Obligatoria solo cuando type = "OTHER" (sección 4) -- validado
        // en el servicio, no como restricción de base de datos (mismo
        // criterio que el resto de "obligatoriedad condicional" de este
        // proyecto, ej. PredictionRelevance/PredictionDeviation: la
        // lógica de negocio vive en la capa de servicio/utils, nunca en
        // constraints de columna).
        description: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        // "Resultado esperado" del mockup de la sección 2 -- campo
        // aditivo respecto al JSON conceptual de la sección 13 (que solo
        // lista type/description/notes); ver judgment call documentado
        // en ProductionAlertActionService.
        expectedResult: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        // "Observaciones" del operador (sección 5) -- texto histórico,
        // nunca una instrucción para el sistema (explícito en el spec).
        notes: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        // Sección 6 -- "createdBy". Texto libre opcional, mismo
        // mecanismo ya usado en RecalibrationProposalService/
        // MaturationModelCalibrationService (createdBy/approvedBy/
        // activatedBy) -- este proyecto no tiene todavía ningún sistema
        // de autenticación/sesión real (sin express-session wireado en
        // app.js pese a estar en package.json), así que "el mecanismo de
        // usuario que ya tenga FermentaLab" ES este campo de texto libre.
        createdBy: {

          type: Sequelize.STRING(120),

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

    // Consulta más frecuente: todas las acciones de UNA alerta,
    // cronológicamente (sección 12/18 -- "se pueden consultar todas las
    // acciones de una alerta").
    await queryInterface.addIndex(

      "production_alert_actions",

      ["alertId", "createdAt"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "production_alert_actions"

    );

  }

};
