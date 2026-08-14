"use strict";

/*
 * Entrega 2.6.1.30 — evaluación y priorización de propuestas de
 * recalibración.
 *
 * Cada fila es una fotografía INMUTABLE de una evaluación de una
 * propuesta concreta (sección 15: "los valores utilizados... deben
 * representar el estado de la propuesta en el momento de evaluarla" /
 * "si posteriormente queremos reevaluarla con datos nuevos, eso será
 * otra evaluación") -- mismo patrón que `maturation_calibration_evaluations`
 * (2.6.1.17, la tabla de historial de evaluaciones RAW-vs-CALIBRADO):
 * nunca se actualiza una fila existente, una reevaluación siempre
 * inserta una fila nueva. Se elige una tabla separada (en vez de
 * campos sobre `maturation_model_calibrations`) precisamente por esa
 * razón -- una propuesta puede tener VARIAS evaluaciones a lo largo
 * del tiempo, campos en la propia fila de la calibración solo podrían
 * conservar la última.
 *
 * `calibrationId` apunta a la fila de `maturation_model_calibrations`
 * que representa la PROPUESTA evaluada (la que tiene
 * `parentCalibrationId` no nulo, ver el comentario de
 * `RecalibrationProposalService`) -- no a la calibración de origen.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "recalibration_proposal_evaluations",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

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

        // Sección 14 -- snapshot de las métricas utilizadas.
        sampleSize: {

          type: Sequelize.INTEGER,

          allowNull: false

        },

        maeActualHours: { type: Sequelize.FLOAT, allowNull: true },

        maeProposedHours: { type: Sequelize.FLOAT, allowNull: true },

        rmseActualHours: { type: Sequelize.FLOAT, allowNull: true },

        rmseProposedHours: { type: Sequelize.FLOAT, allowNull: true },

        biasActualHours: { type: Sequelize.FLOAT, allowNull: true },

        biasProposedHours: { type: Sequelize.FLOAT, allowNull: true },

        // Aditivo más allá de la lista literal de la sección 14 (mismo
        // criterio que `alertId`/`finishedAt` en entregas anteriores):
        // los porcentajes ya calculados, para no tener que
        // recalcularlos desde los valores crudos en cada lectura.
        maeImprovementPercentage: { type: Sequelize.FLOAT, allowNull: true },

        rmseImprovementPercentage: { type: Sequelize.FLOAT, allowNull: true },

        biasImprovementPercentage: { type: Sequelize.FLOAT, allowNull: true },

        // Sección 8 -- consistencia.
        improvedCount: { type: Sequelize.INTEGER, allowNull: true },

        worsenedCount: { type: Sequelize.INTEGER, allowNull: true },

        unchangedCount: { type: Sequelize.INTEGER, allowNull: true },

        consistencyPercentage: { type: Sequelize.FLOAT, allowNull: true },

        // Sección 9 -- magnitud del ajuste propuesto.
        adjustmentMagnitudePercentage: { type: Sequelize.FLOAT, allowNull: true },

        // Sección 10 -- score compuesto 0-100.
        score: {

          type: Sequelize.INTEGER,

          allowNull: false

        },

        // "LOW" | "MEDIUM" | "HIGH" (sección 3).
        recommendation: {

          type: Sequelize.STRING(10),

          allowNull: false

        },

        // Secciones 11/12 -- {positives:[...], warnings:[...]}, en
        // JSON (mismo patrón que `MaturationModelAlert.details`,
        // 2.6.1.21, y `MaturationPrediction.inputData`, 2.6.1.12, para
        // datos estructurados de forma variable).
        explanation: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        evaluatedAt: {

          type: Sequelize.DATE,

          allowNull: false

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

    // Consulta más frecuente: la evaluación más reciente de una
    // propuesta (sección 16, "estado/score/recomendación" mostrados en
    // la página de propuestas).
    await queryInterface.addIndex(

      "recalibration_proposal_evaluations",

      ["calibrationId", "evaluatedAt"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "recalibration_proposal_evaluations"

    );

  }

};
