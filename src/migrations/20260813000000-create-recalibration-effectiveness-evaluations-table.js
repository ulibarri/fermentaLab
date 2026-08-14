"use strict";

/*
 * Entrega 2.6.1.32 — efectividad real de las recalibraciones.
 *
 * Cada fila es una fotografía INMUTABLE de "¿la mejora que prometía la
 * simulación de esta calibración realmente ocurrió después de
 * activarla?" -- mismo patrón que `recalibration_proposal_evaluations`
 * (2.6.1.30, sección 15 de esa entrega) y
 * `maturation_calibration_evaluations` (2.6.1.17): nunca se actualiza
 * una fila existente (sección 17, "no cambia retroactivamente"); una
 * reevaluación posterior (con más predicciones ya evaluadas, sección 9)
 * siempre inserta una fila nueva.
 *
 * `calibrationId` es la calibración ACTIVADA que se está midiendo (p.
 * ej. v5); `parentCalibrationId` es la calibración que reemplazó (p.
 * ej. v4) -- se guarda por conveniencia aunque sea derivable de
 * `maturation_model_calibrations.parentCalibrationId`, para que cada
 * snapshot sea autocontenido (sección 6: nunca mezclar la muestra de
 * simulación con la muestra real -- ambos "lados" de la comparación
 * quedan congelados aquí exactamente como se calcularon en su momento).
 *
 * Sección 6 -- SIEMPRE se guardan DOS pares baseline/valor por métrica,
 * nunca uno solo: el par de SIMULACIÓN (`simulationBaseline*`/
 * `simulated*`, misma muestra -- ventana reciente de la calibración
 * padre) y el par de RESULTADO REAL (`real*Baseline*`/`real*`, datos
 * reales posteriores a la activación) -- coincidieron en el ejemplo de
 * la sección 1 (2.40h en ambos lados) pero no tienen por qué coincidir
 * siempre (una usa la ventana reciente, la otra usa toda la evidencia
 * real acumulada), así que se guardan como dos números distintos y
 * nunca se asume que son el mismo valor.
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "recalibration_effectiveness_evaluations",

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

        parentCalibrationId: {

          type: Sequelize.INTEGER,

          allowNull: true,

          references: {

            model: "maturation_model_calibrations",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "SET NULL"

        },

        // Secciones 7/9/15 -- "PENDING" | "PRELIMINARY" | "VALID" |
        // "REGRESSION".
        status: {

          type: Sequelize.STRING(20),

          allowNull: false

        },

        sampleSize: { type: Sequelize.INTEGER, allowNull: false },

        minimumSampleSize: { type: Sequelize.INTEGER, allowNull: false },

        // Sección 6 -- lado SIMULACIÓN (misma muestra, ventana reciente
        // de la calibración padre).
        simulationBaselineMaeHours: { type: Sequelize.FLOAT, allowNull: true },
        simulatedMaeHours: { type: Sequelize.FLOAT, allowNull: true },
        expectedMaeImprovementPercentage: { type: Sequelize.FLOAT, allowNull: true },

        simulationBaselineRmseHours: { type: Sequelize.FLOAT, allowNull: true },
        simulatedRmseHours: { type: Sequelize.FLOAT, allowNull: true },
        expectedRmseImprovementPercentage: { type: Sequelize.FLOAT, allowNull: true },

        simulationBaselineBiasHours: { type: Sequelize.FLOAT, allowNull: true },
        simulatedBiasHours: { type: Sequelize.FLOAT, allowNull: true },
        expectedBiasImprovementPercentage: { type: Sequelize.FLOAT, allowNull: true },

        // Sección 6 -- lado RESULTADO REAL (datos reales posteriores a
        // la activación, calibración anterior vs. activada).
        realBaselineMaeHours: { type: Sequelize.FLOAT, allowNull: true },
        realMaeHours: { type: Sequelize.FLOAT, allowNull: true },
        actualMaeImprovementPercentage: { type: Sequelize.FLOAT, allowNull: true },

        realBaselineRmseHours: { type: Sequelize.FLOAT, allowNull: true },
        realRmseHours: { type: Sequelize.FLOAT, allowNull: true },
        actualRmseImprovementPercentage: { type: Sequelize.FLOAT, allowNull: true },

        realBaselineBiasHours: { type: Sequelize.FLOAT, allowNull: true },
        realBiasHours: { type: Sequelize.FLOAT, allowNull: true },
        actualBiasImprovementPercentage: { type: Sequelize.FLOAT, allowNull: true },

        // Sección 2 -- efectividad global, basada en MAE. null cuando
        // status es PENDING/PRELIMINARY (sin conclusión definitiva
        // todavía, sección 9) o REGRESSION (sección 3 -- nunca se
        // fabrica un porcentaje para un resultado negativo).
        effectivenessScore: { type: Sequelize.FLOAT, allowNull: true },

        isRegression: {

          type: Sequelize.BOOLEAN,

          allowNull: false,

          defaultValue: false

        },

        // Sección 10 -- checkmarks ✓/✗ por métrica. null junto con
        // effectivenessScore cuando la evidencia todavía es
        // insuficiente.
        maeCheck: { type: Sequelize.BOOLEAN, allowNull: true },
        rmseCheck: { type: Sequelize.BOOLEAN, allowNull: true },
        biasCheck: { type: Sequelize.BOOLEAN, allowNull: true },

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
    // calibración (detalle de calibración, sección 10; columna del
    // historial, sección 11).
    await queryInterface.addIndex(

      "recalibration_effectiveness_evaluations",

      ["calibrationId", "evaluatedAt"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "recalibration_effectiveness_evaluations"

    );

  }

};
