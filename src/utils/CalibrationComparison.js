/*
 * Comparación entre dos versiones de calibración (Entrega 2.6.1.19,
 * sección 8-10). Módulo puro (sin Sequelize ni Express) -- recibe dos
 * objetos YA resumidos (sampleSize/maeHours/rmseHours/biasHours, la
 * misma forma que `ModelAccuracyMetrics.summarizeModelAccuracy()`
 * produce) y solo compara/clasifica/redacta, nunca vuelve a consultar
 * ni a calcular una evaluación desde cero -- mismo criterio de "aceptar
 * insumos ya resumidos" que `ModelCalibrationAnalysis.js` (2.6.1.15) y
 * `CalibrationEffectiveness.js` (2.6.1.17).
 */

// Sección 10: niveles de evidencia -- deliberadamente NO son una
// probabilidad estadística ("Esto no representa una probabilidad
// estadística"), solo un indicador de volumen de evidencia. Nunca se
// muestran como porcentaje.
const EVIDENCE_LOW_MAX = 10;

const EVIDENCE_MEDIUM_MAX = 20;

// Sección 9: cuándo dos tamaños de muestra son "muy diferentes" -- no
// numerado explícitamente en el spec, umbral provisional (mismo
// criterio de constante centralizada y exportada que el resto de este
// proyecto, p. ej. `SIMILARITY_THRESHOLD_RELATIVE` en
// `ModelComparison.js`): una muestra es al menos el doble que la otra.
const DISPARATE_SAMPLE_RATIO = 2;

class CalibrationComparison {

    /*
     * LOW (N < 10) / MEDIUM (10 <= N < 20) / HIGH (N >= 20) -- sección
     * 10, límites exactamente como los da el spec.
     */
    static classifyEvaluationConfidence(sampleSize) {

        const n =
            sampleSize || 0;

        if (n < EVIDENCE_LOW_MAX) {

            return "LOW";

        }

        if (n < EVIDENCE_MEDIUM_MAX) {

            return "MEDIUM";

        }

        return "HIGH";

    }

    /*
     * Sección 9: nunca comparar "50 lotes vs. 5 lotes" y concluir
     * silenciosamente que uno es mejor -- devuelve un arreglo de
     * advertencias en español, listas para mostrarse tal cual (nunca
     * fabricadas en el frontend). Puede haber 0, 1 o 2 advertencias
     * (evidencia baja en cada lado se evalúa independientemente).
     */
    static buildWarnings({ labelA, sampleSizeA, labelB, sampleSizeB }) {

        const warnings = [];

        if (this.classifyEvaluationConfidence(sampleSizeA) === "LOW") {

            warnings.push(`⚠ ${labelA} tiene solamente ${sampleSizeA || 0} evaluaciones. La comparación todavía no es concluyente.`);

        }

        if (this.classifyEvaluationConfidence(sampleSizeB) === "LOW") {

            warnings.push(`⚠ ${labelB} tiene solamente ${sampleSizeB || 0} evaluaciones. La comparación todavía no es concluyente.`);

        }

        const bothHaveSamples =
            (sampleSizeA || 0) > 0 && (sampleSizeB || 0) > 0;

        // Solo se agrega la advertencia de "tamaños muy distintos"
        // cuando NINGUNO de los dos ya disparó la advertencia de
        // evidencia baja de arriba -- evita repetir la misma idea dos
        // veces con dos redacciones distintas.
        if (bothHaveSamples && warnings.length === 0) {

            const larger =
                Math.max(sampleSizeA, sampleSizeB);

            const smaller =
                Math.min(sampleSizeA, sampleSizeB);

            if (larger >= smaller * DISPARATE_SAMPLE_RATIO) {

                warnings.push(`⚠ ${labelA} (N=${sampleSizeA}) y ${labelB} (N=${sampleSizeB}) tienen tamaños de muestra muy distintos. Interpreta la diferencia con cautela.`);

            }

        }

        return warnings;

    }

    /*
     * Sección 8: resumen en prosa generado server-side (mismo criterio
     * de centralización que `ModelRecommendation.js`/
     * `ModelAccuracyMetrics.buildInterpretation()`/
     * `ModelCalibrationAnalysis.buildInterpretation()`) -- reproduce
     * exactamente el ejemplo de la sección 8 cuando ambas métricas
     * mejoran ("presenta menor MAE y menor Bias"), y cubre además los
     * casos parciales/sin datos que el ejemplo no muestra.
     */
    static buildSummary({ labelA, maeHoursA, biasHoursA, labelB, maeHoursB, biasHoursB }) {

        if (maeHoursA === null || maeHoursA === undefined || maeHoursB === null || maeHoursB === undefined) {

            return `No hay suficientes evaluaciones para comparar ${labelA} y ${labelB} todavía.`;

        }

        const maeImproved =
            maeHoursB < maeHoursA;

        const biasImproved =
            biasHoursA !== null && biasHoursA !== undefined && biasHoursB !== null && biasHoursB !== undefined
                ? Math.abs(biasHoursB) < Math.abs(biasHoursA)
                : null;

        if (maeImproved && biasImproved === true) {

            return `${labelB} presenta menor MAE y menor Bias que ${labelA}.`;

        }

        if (maeImproved && biasImproved === false) {

            return `${labelB} presenta menor MAE que ${labelA}, pero un Bias mayor.`;

        }

        if (maeImproved && biasImproved === null) {

            return `${labelB} presenta menor MAE que ${labelA}.`;

        }

        if (!maeImproved && maeHoursB > maeHoursA) {

            return `${labelA} presenta menor MAE que ${labelB}.`;

        }

        return `${labelA} y ${labelB} presentan un desempeño similar.`;

    }

    /*
     * Punto de entrada principal -- arma la forma completa de la
     * sección 8/16 a partir de dos calibraciones ya resumidas.
     * `sampleSize`/`maeHours`/`rmseHours`/`biasHours` pueden venir en
     * `null` (calibración sin evaluaciones todavía, p. ej. recién
     * ACTIVE) -- nunca se fabrica un número en ese caso.
     */
    static buildComparison(calibrationA, calibrationB) {

        const labelA =
            `Calibration #${calibrationA.calibrationId}`;

        const labelB =
            `Calibration #${calibrationB.calibrationId}`;

        return {

            calibrations: [

                {

                    ...calibrationA,

                    evaluationConfidence: this.classifyEvaluationConfidence(calibrationA.sampleSize)

                },

                {

                    ...calibrationB,

                    evaluationConfidence: this.classifyEvaluationConfidence(calibrationB.sampleSize)

                }

            ],

            summary: this.buildSummary({

                labelA,

                maeHoursA: calibrationA.maeHours,

                biasHoursA: calibrationA.biasHours,

                labelB,

                maeHoursB: calibrationB.maeHours,

                biasHoursB: calibrationB.biasHours

            }),

            warnings: this.buildWarnings({

                labelA,

                sampleSizeA: calibrationA.sampleSize,

                labelB,

                sampleSizeB: calibrationB.sampleSize

            })

        };

    }

}

CalibrationComparison.EVIDENCE_LOW_MAX =
    EVIDENCE_LOW_MAX;

CalibrationComparison.EVIDENCE_MEDIUM_MAX =
    EVIDENCE_MEDIUM_MAX;

CalibrationComparison.DISPARATE_SAMPLE_RATIO =
    DISPARATE_SAMPLE_RATIO;

module.exports =
    CalibrationComparison;
