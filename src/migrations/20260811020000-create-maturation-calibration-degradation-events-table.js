"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "maturation_calibration_degradation_events",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        // La calibración ACTIVE cuya degradación se detectó (sección 12:
        // "DegradationEvent -> calibrationId"). A diferencia de
        // maturation_model_alerts.calibrationId (nullable, porque una
        // alerta puede existir sin ninguna calibración activa),
        // aquí SIEMPRE hay una calibración concreta -- la detección
        // nunca corre sin una (sección 14: "se evalúan únicamente
        // calibraciones ACTIVE").
        calibrationId: {

          type: Sequelize.INTEGER,

          allowNull: false,

          references: {

            model: "maturation_model_calibrations",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE"

        },

        // Momento de la PRIMERA detección -- nunca se actualiza en
        // refrescos posteriores de la misma degradación activa (a
        // diferencia de las métricas de abajo, que sí se refrescan en
        // el lugar, sección 8/9). createdAt/updatedAt (Sequelize)
        // cubren "cuándo se creó/tocó la fila"; detectedAt es
        // semántico: "cuándo empezó este episodio de degradación".
        detectedAt: {

          type: Sequelize.DATE,

          allowNull: false

        },

        // Sección 6 -- snapshot completo de las métricas que originaron
        // (o siguen sosteniendo, tras un refresco) la detección.
        sampleSize: {

          type: Sequelize.INTEGER,

          allowNull: false

        },

        baselineMaeHours: {

          type: Sequelize.FLOAT,

          allowNull: true

        },

        currentMaeHours: {

          type: Sequelize.FLOAT,

          allowNull: true

        },

        baselineRmseHours: {

          type: Sequelize.FLOAT,

          allowNull: true

        },

        currentRmseHours: {

          type: Sequelize.FLOAT,

          allowNull: true

        },

        baselineBiasHours: {

          type: Sequelize.FLOAT,

          allowNull: true

        },

        currentBiasHours: {

          type: Sequelize.FLOAT,

          allowNull: true

        },

        degradationPercentage: {

          type: Sequelize.FLOAT,

          allowNull: true

        },

        // Sección 4 -- el umbral SE GUARDA junto con cada evento (no
        // solo vive en config), para que el registro sea reproducible
        // incluso si el valor configurable cambia después (sección 6:
        // "el objetivo es que la detección sea auditable y
        // reproducible").
        thresholdPercentage: {

          type: Sequelize.FLOAT,

          allowNull: false

        },

        // "DETECTED" | "ACKNOWLEDGED" | "RESOLVED" (sección 7). Mismo
        // criterio dual status+timestamps que maturation_model_alerts
        // (2.6.1.21).
        status: {

          type: Sequelize.STRING(20),

          allowNull: false,

          defaultValue: "DETECTED"

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

    // Consulta más frecuente: el evento DETECTED/ACKNOWLEDGED (sin
    // resolver) vigente de una calibración -- sección 8, "una única
    // degradación activa para una determinada calibración".
    await queryInterface.addIndex(

      "maturation_calibration_degradation_events",

      ["calibrationId", "status"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "maturation_calibration_degradation_events"

    );

  }

};
