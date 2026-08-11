/*
 * Evaluación de efectividad de la calibración (Entrega 2.6.1.17).
 *
 * Módulo puro (sin Sequelize ni Express). No decide QUÉ predicciones
 * comparar ni cómo excluir contaminación de datos (sección 2/16 -- eso
 * es responsabilidad de CalibrationEffectivenessService, que arma dos
 * conjuntos de evaluaciones {errorHours,direction} -- escenario RAW
 * (contra `rawPredictedMaturationAt`) y escenario CALIBRATED (contra
 * `predictedMaturationAt`) -- sobre EXACTAMENTE los mismos lotes
 * post-calibración, y ya resumidos vía
 * `ModelAccuracyMetrics.summarizeModelAccuracy()` (2.6.1.14, nunca
 * reimplementado aquí). Este módulo solo compara esos dos resúmenes ya
 * calculados y decide IMPROVED/DEGRADED/NO_SIGNIFICANT_CHANGE/
 * INSUFFICIENT_DATA -- mismo patrón de composición que
 * `ModelCalibrationAnalysis.summarizeCalibration()` (2.6.1.15), que
 * tampoco recalcula MAE/RMSE/Bias desde cero.
 */

// Sección 8: criterio práctico inicial, "podremos convertirlo
// posteriormente en configuración" -- centralizado aquí, no disperso.
const MAE_IMPROVEMENT_THRESHOLD_PERCENTAGE = 5;

function round(value, decimals) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

class CalibrationEffectiveness {

    /*
     * Sección 7/18: mejora absoluta (horas) y porcentual del MAE.
     * `maeImprovementPercentage` es null cuando `maeRaw` es null/0 --
     * nunca se divide entre cero ni se fabrica un porcentaje desde una
     * base inexistente/perfecta (caso límite no cubierto explícitamente
     * por el spec, tratado defensivamente).
     */
    static computeImprovement(maeRaw, maeCalibrated) {

        if (maeRaw === null || maeRaw === undefined || maeCalibrated === null || maeCalibrated === undefined) {

            return { maeImprovementHours: null, maeImprovementPercentage: null };

        }

        const maeImprovementHours =
            round(maeRaw - maeCalibrated, 2);

        const maeImprovementPercentage =
            maeRaw > 0
                ? round(((maeRaw - maeCalibrated) / maeRaw) * 100, 2)
                : null;

        return { maeImprovementHours, maeImprovementPercentage };

    }

    /*
     * Sección 8: reglas de clasificación.
     *   sampleSize === 0                                -> INSUFFICIENT_DATA
     *   maeImprovementPercentage > +5%                   -> IMPROVED
     *   maeImprovementPercentage < -5%                    -> DEGRADED
     *   en cualquier otro caso (incluye exactamente ±5%,
     *   y el caso límite maeRaw=0 sin porcentaje calculable) -> NO_SIGNIFICANT_CHANGE
     */
    static classifyResult(sampleSize, maeImprovementPercentage) {

        if (!sampleSize || sampleSize <= 0) {

            return "INSUFFICIENT_DATA";

        }

        if (maeImprovementPercentage === null || maeImprovementPercentage === undefined) {

            return "NO_SIGNIFICANT_CHANGE";

        }

        if (maeImprovementPercentage > MAE_IMPROVEMENT_THRESHOLD_PERCENTAGE) {

            return "IMPROVED";

        }

        if (maeImprovementPercentage < -MAE_IMPROVEMENT_THRESHOLD_PERCENTAGE) {

            return "DEGRADED";

        }

        return "NO_SIGNIFICANT_CHANGE";

    }

    /*
     * Punto de entrada principal: recibe los resúmenes YA calculados
     * (`ModelAccuracyMetrics.summarizeModelAccuracy()`) de ambos
     * escenarios sobre el MISMO conjunto de lotes, y regresa exactamente
     * la forma del ejemplo JSON de la sección 10. `raw`/`calibrated`
     * pueden venir con `sampleSize: 0` (ningún lote evaluable) -- en ese
     * caso ambos bloques de métricas quedan `null` en vez de un objeto
     * con puros ceros/null sueltos, sección 16: "sampleSize = 0 ->
     * INSUFFICIENT_DATA".
     */
    static buildEvaluation({ calibrationId, modelType, recipeVersionId, raw, calibrated }) {

        const sampleSize =
            (raw && raw.sampleSize) || 0;

        if (sampleSize === 0) {

            return {

                calibrationId,

                modelType,

                recipeVersionId,

                evaluationSampleSize: 0,

                raw: null,

                calibrated: null,

                maeImprovementHours: null,

                maeImprovementPercentage: null,

                result: "INSUFFICIENT_DATA"

            };

        }

        const { maeImprovementHours, maeImprovementPercentage } =
            this.computeImprovement(raw.maeHours, calibrated.maeHours);

        const result =
            this.classifyResult(sampleSize, maeImprovementPercentage);

        const scenarioBlock = summary => ({

            maeHours: summary.maeHours,

            rmseHours: summary.rmseHours,

            biasHours: summary.biasHours,

            earlyPercentage: summary.earlyPercentage,

            latePercentage: summary.latePercentage,

            exactPercentage: summary.exactPercentage

        });

        return {

            calibrationId,

            modelType,

            recipeVersionId,

            evaluationSampleSize: sampleSize,

            raw: scenarioBlock(raw),

            calibrated: scenarioBlock(calibrated),

            maeImprovementHours,

            maeImprovementPercentage,

            result

        };

    }

}

CalibrationEffectiveness.MAE_IMPROVEMENT_THRESHOLD_PERCENTAGE =
    MAE_IMPROVEMENT_THRESHOLD_PERCENTAGE;

module.exports =
    CalibrationEffectiveness;
