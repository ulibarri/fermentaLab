/*
 * Análisis global de la efectividad del proceso de recalibración
 * (Entrega 2.6.1.33) -- cierre del bloque 2.6.1.x.
 *
 * La 2.6.1.32 respondía, POR CALIBRACIÓN: "¿esta recalibración
 * funcionó como esperábamos?" (`RecalibrationEffectiveness.evaluate()`).
 * Esta entrega deja de mirar una propuesta individual y responde, sobre
 * TODAS las recalibraciones con evidencia suficiente: "¿el mecanismo de
 * recalibración de FermentaLab está funcionando bien como proceso?"
 *
 * Módulo puro (sin Sequelize ni Express), mismo estilo que
 * RecalibrationEffectiveness.js (2.6.1.32) / CalibrationHistoryAnalysis.js
 * (2.6.1.31): recibe un array de resultados YA calculados por
 * `RecalibrationEffectiveness.evaluate()` (uno por calibración, con su
 * `calibrationId`/`modelType`/`version`/`activatedAt` añadidos por el
 * servicio que orquesta la consulta) y produce únicamente ESTADÍSTICAS
 * AGREGADAS -- nunca vuelve a calcular una efectividad individual desde
 * cero (sección 16, "la fuente de verdad será RecalibrationEffectiveness
 * -> aggregation -> dashboard").
 *
 * Sección 13, regla obligatoria repetida en todo este módulo: una
 * evaluación `PENDING` o `PRELIMINARY` NUNCA participa en ningún
 * indicador global de efectividad -- solo las que alcanzaron `VALID`
 * (incluye `REGRESSION`, que por definición en RecalibrationEffectiveness
 * SOLO ocurre una vez alcanzado el mínimo de muestra, ver 2.6.1.32) se
 * usan para calcular tasas, promedios, mediana, distribución, etc. Una
 * calibración `NOT_APPLICABLE` (sin padre -- nunca fue una
 * recalibración) tampoco cuenta en ningún lado; se reporta aparte solo
 * para que la vista pueda explicar por qué el total de "candidatas"
 * examinadas es mayor que el total "evaluadas".
 */

const RecalibrationEffectiveness =
    require("./RecalibrationEffectiveness");

const PostActivationEvaluation =
    require("./PostActivationEvaluation");

// Sección 4/5 -- ¿cuánto de diferencia entre "esperado" y "real" ya
// cuenta como sesgo real de estimación, en vez de ruido? Reutiliza el
// mismo umbral de "cambio no ruidoso" (5 puntos porcentuales) que
// gobierna IMPROVED/DEGRADED en todo el proyecto desde 2.6.1.17, en vez
// de inventar un número nuevo.
const ESTIMATION_BIAS_NOISE_THRESHOLD_PERCENTAGE =
    PostActivationEvaluation.IMPROVEMENT_THRESHOLD_PERCENTAGE;

// Sección 3 -- "si ambas [media y mediana] son muy diferentes, la
// interfaz deberá señalarlo como una posible dispersión importante".
// El spec no da un número -- 15 puntos porcentuales de diferencia entre
// media y mediana se elige como umbral razonable (más del triple del
// umbral de ruido de arriba), documentado como judgment call en el
// resumen de la entrega.
const DISPERSION_WARNING_THRESHOLD_POINTS = 15;

// Sección 11 -- cortes del indicador resumido "RECALIBRATION PROCESS
// HEALTH" (0-100). El ejemplo del spec (88 -> 🟢 BUENO) fija el corte
// de BUENO en <= 88, así que se elige 75 como mínimo de "BUENO" (deja
// margen) y 90 como mínimo de "EXCELENTE" -- mismos cortes 90/70(75)/30(50)
// en espíritu que el resto del proyecto, pero un poco más generosos
// porque este es un indicador COMPUESTO (promedio de 4 componentes, no
// una sola métrica), documentado como judgment call.
const HEALTH_EXCELLENT_MIN_SCORE = 90;

const HEALTH_GOOD_MIN_SCORE = 75;

const HEALTH_FAIR_MIN_SCORE = 50;

// Sección 6 -- las 5 bandas EXPLÍCITAS de la distribución, deliberadamente
// MÁS FINAS que los 4 niveles de `RecalibrationEffectiveness.classifyEffectivenessTier()`
// (que no distingue 90-110% de >110%) -- esta partición en 5 es propia y
// exclusiva de esta entrega, para poder señalar visualmente cuándo el
// mecanismo está siendo sistemáticamente MÁS efectivo de lo esperado
// (>110%), no solo cuándo es insuficiente.
const DISTRIBUTION_BAND_DEFINITIONS = [

    { code: "BELOW_30", label: "<30%", test: score => score < 30 },

    { code: "RANGE_30_69", label: "30-69%", test: score => score >= 30 && score < 70 },

    { code: "RANGE_70_89", label: "70-89%", test: score => score >= 70 && score < 90 },

    { code: "RANGE_90_110", label: "90-110%", test: score => score >= 90 && score <= 110 },

    { code: "ABOVE_110", label: ">110%", test: score => score > 110 }

];

function round(value, decimals = 1) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

function mean(values) {

    if (!values || values.length === 0) {

        return null;

    }

    const sum =
        values.reduce((total, value) => total + value, 0);

    return round(sum / values.length, 1);

}

function median(values) {

    if (!values || values.length === 0) {

        return null;

    }

    const sorted =
        values.slice().sort((a, b) => a - b);

    const mid =
        Math.floor(sorted.length / 2);

    const value =
        sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    return round(value, 1);

}

function meanOfField(rows, getter) {

    const values =
        rows.map(getter).filter(value => value !== null && value !== undefined);

    return mean(values);

}

class RecalibrationProcessAnalysis {

    /*
     * Sección 6 -- una de las 5 bandas de distribución para un score YA
     * calculado (nunca null -- ver el filtro `scored` en `summarize()`).
     */
    static classifyDistributionBand(score) {

        for (const band of DISTRIBUTION_BAND_DEFINITIONS) {

            if (band.test(score)) {

                return { code: band.code, label: band.label };

            }

        }

        return null;

    }

    /*
     * Sección 11 -- semáforo del indicador compuesto 0-100.
     */
    static classifyHealthTier(score) {

        if (score === null || score === undefined) {

            return null;

        }

        if (score >= HEALTH_EXCELLENT_MIN_SCORE) {

            return { code: "EXCELLENT", label: "EXCELENTE", emoji: "🟢" };

        }

        if (score >= HEALTH_GOOD_MIN_SCORE) {

            return { code: "GOOD", label: "BUENO", emoji: "🟢" };

        }

        if (score >= HEALTH_FAIR_MIN_SCORE) {

            return { code: "FAIR", label: "REGULAR", emoji: "🟡" };

        }

        return { code: "CRITICAL", label: "REQUIERE ATENCIÓN", emoji: "🔴" };

    }

    /*
     * Sección 11 -- combina 4 componentes YA calculados (0-100 cada
     * uno) en un solo número resumen, SIN ocultar los componentes
     * (sección 11, explícito: "no debemos crear un número mágico que
     * oculte la información real" -- por eso `components` siempre viaja
     * junto al `score`).
     *
     * "Consistencia" reutiliza deliberadamente la MISMA señal de
     * dispersión de la sección 3 (diferencia entre media y mediana de
     * efectividad) en vez de inventar un eje nuevo -- ver
     * `dispersionWarning` en `summarize()`.
     */
    static computeProcessHealth({ successRate, effectivenessMean, effectivenessMedian, regressionRate }) {

        if (successRate === null && effectivenessMean === null && regressionRate === null) {

            return {

                score: null,

                tier: null,

                components: { success: null, effectiveness: null, regressions: null, consistency: null }

            };

        }

        // Sección 8 (2.6.1.32) -- una efectividad promedio > 100% es
        // válida y nunca se recorta para MOSTRARSE, pero SÍ se limita a
        // 100 únicamente al combinarla en este score compuesto 0-100 --
        // de lo contrario un proceso "demasiado bueno" empujaría el
        // health score por encima de 100 sin que eso tenga sentido como
        // "salud del proceso".
        const cappedEffectiveness =
            effectivenessMean === null ? null : Math.min(100, effectivenessMean);

        const consistency =
            (effectivenessMean === null || effectivenessMedian === null)
                ? null
                : round(Math.max(0, 100 - Math.abs(effectivenessMean - effectivenessMedian)), 1);

        const nonRegressionShare =
            regressionRate === null ? null : round(100 - regressionRate, 1);

        const scoringInputs =
            [successRate, cappedEffectiveness, nonRegressionShare, consistency]
                .filter(value => value !== null && value !== undefined);

        const score =
            scoringInputs.length > 0
                ? round(scoringInputs.reduce((total, value) => total + value, 0) / scoringInputs.length, 0)
                : null;

        return {

            score,

            tier: RecalibrationProcessAnalysis.classifyHealthTier(score),

            components: {

                success: successRate,

                effectiveness: effectivenessMean === null ? null : round(effectivenessMean, 1),

                regressions: regressionRate,

                consistency

            }

        };

    }

    /*
     * Orquestador principal -- `records` es un array de resultados YA
     * calculados por `RecalibrationEffectivenessService.evaluate()`
     * (uno por cada calibración candidata, con `calibrationId`/
     * `modelType`/`recipeVersionId`/`version`/`activatedAt` añadidos por
     * el servicio de resumen), ya filtrados por fecha/modelo por el
     * llamador -- este módulo nunca decide QUÉ calibraciones entran,
     * solo agrega las que recibe.
     */
    static summarize(records = [], { minimumSampleSize = RecalibrationEffectiveness.DEFAULT_MINIMUM_SAMPLE_SIZE } = {}) {

        const applicable =
            records.filter(record => record.applicable);

        // Sección 13 -- las tres categorías de evidencia. Solo
        // `evaluated` (VALID + REGRESSION) alimenta cualquier indicador
        // global de aquí en adelante.
        const pending =
            applicable.filter(record => record.status === "PENDING");

        const preliminary =
            applicable.filter(record => record.status === "PRELIMINARY");

        const evaluated =
            applicable.filter(record => record.status === "VALID" || record.status === "REGRESSION");

        const regressions =
            evaluated.filter(record => record.isRegression);

        const scored =
            evaluated.filter(record => !record.isRegression && record.effectivenessScore !== null && record.effectivenessScore !== undefined);

        const totalEvaluated =
            evaluated.length;

        // Sección 2 -- "recalibraciones con mejora real": el modelo
        // mejoró de verdad (más allá del ruido), sin importar si
        // alcanzó la mejora ESPERADA -- eso es un eje aparte (tasa de
        // efectividad alta, justo abajo). Reutiliza
        // `RecalibrationEffectiveness.isMetricImproved()` (2.6.1.32) en
        // vez de comparar contra cero directamente, mismo criterio de
        // "evitar ruido" que ya rige esa función.
        const successes =
            evaluated.filter(record => !record.isRegression && RecalibrationEffectiveness.isMetricImproved(record.actual.mae));

        const successRate =
            totalEvaluated > 0 ? round((successes.length / totalEvaluated) * 100, 1) : null;

        // Sección 2 -- "tasa de efectividad alta": consiguió AL MENOS
        // la mejora esperada (score >= 90).
        const highEffectiveness =
            scored.filter(record => record.effectivenessScore >= RecalibrationEffectiveness.HIGH_MIN_SCORE);

        const highEffectivenessRate =
            totalEvaluated > 0 ? round((highEffectiveness.length / totalEvaluated) * 100, 1) : null;

        const regressionRate =
            totalEvaluated > 0 ? round((regressions.length / totalEvaluated) * 100, 1) : null;

        // Sección 1 -- el mockup muestra EXACTAMENTE 3 categorías de
        // resultado (EXITOSAS/MODERADAS/INEFECTIVAS) más REGRESIONES
        // aparte -- una menos que los 4 niveles de
        // `classifyEffectivenessTier()` (HIGH/MODERATE/LOW/INEFFECTIVE).
        // Judgment call: para este resumen de alto nivel, LOW e
        // INEFFECTIVE se colapsan en una sola categoría "INEFECTIVAS"
        // (<70%) -- el detalle de cada calibración individual (2.6.1.32)
        // sigue distinguiendo 🟠 BAJA de 🔴 INEFECTIVA sin cambios; esta
        // vista global solo simplifica el resumen de 4 a 3 + regresión,
        // documentado en el resumen final de la entrega.
        const successful =
            scored.filter(record => record.effectivenessScore >= RecalibrationEffectiveness.HIGH_MIN_SCORE);

        const moderate =
            scored.filter(record => record.effectivenessScore >= RecalibrationEffectiveness.MODERATE_MIN_SCORE && record.effectivenessScore < RecalibrationEffectiveness.HIGH_MIN_SCORE);

        const ineffective =
            scored.filter(record => record.effectivenessScore < RecalibrationEffectiveness.MODERATE_MIN_SCORE);

        // Sección 1/3 -- media y mediana, SOLO sobre las que tienen un
        // score real (una REGRESSION no tiene score -- se cuenta en
        // "evaluadas" y en "regresiones", pero nunca en el promedio de
        // efectividad, mismo criterio que 2.6.1.32: "nunca fabricar un
        // número para una regresión").
        const effectivenessScores =
            scored.map(record => record.effectivenessScore);

        const effectivenessMean =
            mean(effectivenessScores);

        const effectivenessMedian =
            median(effectivenessScores);

        const dispersionWarning =
            (effectivenessMean !== null && effectivenessMedian !== null)
                ? Math.abs(effectivenessMean - effectivenessMedian) > DISPERSION_WARNING_THRESHOLD_POINTS
                : false;

        // Sección 4/5 -- "¿somos demasiado optimistas/conservadores?".
        // Promedios de mejora ESPERADA vs. REAL sobre TODAS las
        // evaluadas (incluye regresiones -- una regresión con mejora
        // real negativa SÍ debe jalar hacia abajo el promedio real, es
        // justamente la señal que estas dos secciones quieren exponer).
        const expectedMaeMean =
            meanOfField(evaluated, record => record.expected ? record.expected.mae : null);

        const actualMaeMean =
            meanOfField(evaluated, record => record.actual ? record.actual.mae : null);

        const estimationBias =
            (expectedMaeMean !== null && actualMaeMean !== null) ? round(expectedMaeMean - actualMaeMean, 1) : null;

        // "OPTIMISTIC" (sección 4, sobreestimamos) / "CONSERVATIVE"
        // (sección 5, subestimamos) / "ACCURATE" (dentro del umbral de
        // ruido) -- nunca una etiqueta ambigua para diferencias
        // pequeñas.
        let estimationBiasDirection =
            null;

        if (estimationBias !== null) {

            if (estimationBias > ESTIMATION_BIAS_NOISE_THRESHOLD_PERCENTAGE) {

                estimationBiasDirection = "OPTIMISTIC";

            } else if (estimationBias < -ESTIMATION_BIAS_NOISE_THRESHOLD_PERCENTAGE) {

                estimationBiasDirection = "CONSERVATIVE";

            } else {

                estimationBiasDirection = "ACCURATE";

            }

        }

        // Sección 6 -- distribución en las 5 bandas, solo sobre
        // `scored` (mismo motivo que media/mediana: una regresión no
        // tiene un score que ubicar en ninguna banda).
        const distribution =
            DISTRIBUTION_BAND_DEFINITIONS.map(definition => ({

                code: definition.code,

                label: definition.label,

                count: scored.filter(record => RecalibrationProcessAnalysis.classifyDistributionBand(record.effectivenessScore).code === definition.code).length

            }));

        // Sección 7 -- detalle de cada regresión, para la sección
        // dedicada "⚠ REGRESIONES" del mockup.
        const regressionDetails =
            regressions.map(record => ({

                calibrationId: record.calibrationId,

                version: record.version,

                modelType: record.modelType,

                expectedImprovementPercentage: record.expected ? record.expected.mae : null,

                actualImprovementPercentage: record.actual ? record.actual.mae : null,

                sampleSize: record.sampleSize

            }));

        // Sección 8 -- evolución temporal, ordenada por fecha de
        // activación (nunca por `version` a secas -- distintas cadenas
        // modelo+receta pueden mezclarse en un mismo resumen global sin
        // filtro, y solo `activatedAt` da un orden cronológico real
        // entre ellas).
        const timeline =
            evaluated
                .slice()
                .sort((a, b) => new Date(a.activatedAt) - new Date(b.activatedAt) || a.calibrationId - b.calibrationId)
                .map(record => ({

                    calibrationId: record.calibrationId,

                    version: record.version,

                    modelType: record.modelType,

                    label: `v${record.version}`,

                    effectivenessScore: record.effectivenessScore,

                    isRegression: record.isRegression,

                    status: record.status,

                    activatedAt: record.activatedAt

                }));

        // Sección 9 -- agrupado por modelo predictivo.
        const modelGroups =
            new Map();

        for (const record of evaluated) {

            const key =
                record.modelType || "UNKNOWN";

            if (!modelGroups.has(key)) {

                modelGroups.set(key, []);

            }

            modelGroups.get(key).push(record);

        }

        const byModel =
            Array.from(modelGroups.entries())
                .map(([modelType, rows]) => {

                    const modelScored =
                        rows.filter(record => !record.isRegression && record.effectivenessScore !== null && record.effectivenessScore !== undefined);

                    return {

                        modelType,

                        evaluatedCount: rows.length,

                        regressionCount: rows.filter(record => record.isRegression).length,

                        averageEffectiveness: mean(modelScored.map(record => record.effectivenessScore))

                    };

                })
                .sort((a, b) => (a.modelType < b.modelType ? -1 : 1));

        // Sección 10 -- evolución agregada de MAE/RMSE (esperado
        // promedio -> real promedio, en horas) y Bias (antes -> esperado
        // -> real, preservando el signo -- la DIRECCIÓN del sesgo
        // importa tanto como su magnitud).
        const maeAggregate = {

            expectedHours: meanOfField(evaluated, record => record.simulated ? record.simulated.maeHours : null),

            realHours: meanOfField(evaluated, record => record.real ? record.real.maeHours : null)

        };

        const rmseAggregate = {

            expectedHours: meanOfField(evaluated, record => record.simulated ? record.simulated.rmseHours : null),

            realHours: meanOfField(evaluated, record => record.real ? record.real.rmseHours : null)

        };

        const biasAggregate = {

            beforeHours: meanOfField(evaluated, record => record.realBaseline ? record.realBaseline.biasHours : null),

            expectedHours: meanOfField(evaluated, record => record.simulated ? record.simulated.biasHours : null),

            realHours: meanOfField(evaluated, record => record.real ? record.real.biasHours : null)

        };

        const processHealth =
            RecalibrationProcessAnalysis.computeProcessHealth({

                successRate,

                effectivenessMean,

                effectivenessMedian,

                regressionRate

            });

        return {

            minimumSampleSize,

            evidence: {

                evaluated: totalEvaluated,

                preliminary: preliminary.length,

                pending: pending.length,

                notApplicable: records.length - applicable.length

            },

            counts: {

                successful: successful.length,

                moderate: moderate.length,

                ineffective: ineffective.length,

                regressions: regressions.length

            },

            rates: {

                success: successRate,

                highEffectiveness: highEffectivenessRate,

                regression: regressionRate

            },

            effectiveness: {

                mean: effectivenessMean,

                median: effectivenessMedian,

                dispersionWarning

            },

            improvement: {

                expectedMean: expectedMaeMean,

                actualMean: actualMaeMean,

                estimationBias,

                estimationBiasDirection

            },

            distribution,

            regressionDetails,

            timeline,

            byModel,

            metrics: {

                mae: maeAggregate,

                rmse: rmseAggregate,

                bias: biasAggregate

            },

            processHealth

        };

    }

}

RecalibrationProcessAnalysis.ESTIMATION_BIAS_NOISE_THRESHOLD_PERCENTAGE =
    ESTIMATION_BIAS_NOISE_THRESHOLD_PERCENTAGE;

RecalibrationProcessAnalysis.DISPERSION_WARNING_THRESHOLD_POINTS =
    DISPERSION_WARNING_THRESHOLD_POINTS;

RecalibrationProcessAnalysis.HEALTH_EXCELLENT_MIN_SCORE =
    HEALTH_EXCELLENT_MIN_SCORE;

RecalibrationProcessAnalysis.HEALTH_GOOD_MIN_SCORE =
    HEALTH_GOOD_MIN_SCORE;

RecalibrationProcessAnalysis.HEALTH_FAIR_MIN_SCORE =
    HEALTH_FAIR_MIN_SCORE;

module.exports =
    RecalibrationProcessAnalysis;
