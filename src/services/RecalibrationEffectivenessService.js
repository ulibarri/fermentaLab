const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const RecalibrationEffectivenessEvaluationRepository =
    require("../repositories/RecalibrationEffectivenessEvaluationRepository");

const CalibrationEffectivenessService =
    require("./CalibrationEffectivenessService");

const RecalibrationEffectiveness =
    require("../utils/RecalibrationEffectiveness");

function toNumberOrNull(value) {

    return value === null || value === undefined ? null : Number(value);

}

/*
 * Efectividad real de las recalibraciones (Entrega 2.6.1.32). Conecta
 * finalmente lo que una propuesta PROMETÍA (2.6.1.24, simulación) con
 * lo que realmente CONSIGUIÓ una vez activada (2.6.1.27, desempeño
 * post-activación): "¿la mejora esperada realmente ocurrió?"
 *
 * Decisión de arquitectura central de esta entrega -- EN VIVO vs.
 * persistido: se sigue el MISMO patrón dual que
 * `CalibrationEffectivenessService` estableció desde 2.6.1.17/18
 * (`getHealth()`/`evaluate()` en vivo, siempre frescos, vs.
 * `evaluateAndStore()` explícito y persistido) en vez del patrón
 * puramente explícito de `RecalibrationProposalService.evaluate()`
 * (2.6.1.30, nunca se recalcula solo). Razón: la sección 8/9 de ESTA
 * entrega describe la efectividad como algo que evoluciona con cada
 * predicción nueva que se evalúa ("n=4 -> PRELIMINAR", "n=10 ->
 * VÁLIDA", más adelante "v5 -> v6") -- si `evaluate()` solo calculara
 * al pedirlo explícitamente y solo `evaluateAndStore()` persistiera,
 * la columna "Efectividad" de la sección 11 (que vive en la tabla YA
 * existente de `/maturation/model-history`, 2.6.1.31) se quedaría
 * congelada en el último click manual en vez de reflejar la evidencia
 * más fresca cada vez que alguien mira la tabla. `evaluate()` de este
 * servicio es por tanto EN VIVO (nunca escribe nada) y es lo que
 * alimenta tanto la sección 10 (tarjeta de detalle) como la sección 11
 * (columna del historial); `evaluateAndStore()` es la acción EXPLÍCITA
 * que congela un snapshot inmutable para la sección 14/17
 * ("queda almacenada... no cambia retroactivamente... se puede
 * consultar el detalle de cada evaluación").
 *
 * Sección 6, regla NUNCA relajada: la muestra de SIMULACIÓN (ventana
 * reciente de la calibración padre, `simulateProposedOffsetWithPairs(
 * ..., {windowed:true})`, igual que 2.6.1.24) y la muestra de
 * RESULTADO REAL (post-activación, vía
 * `CalibrationEffectivenessService.getPostActivationEvaluation()`,
 * 2.6.1.27) se calculan por separado y NUNCA se combinan en un solo
 * conjunto de predicciones -- ver `evaluate()` abajo, donde cada una
 * viene de una llamada completamente independiente.
 */
class RecalibrationEffectivenessService {

    constructor() {

        this.calibrationRepository =
            new MaturationModelCalibrationRepository();

        this.effectivenessService =
            new CalibrationEffectivenessService();

        this.evaluationRepository =
            new RecalibrationEffectivenessEvaluationRepository();

    }

    async _requireCalibration(calibrationId) {

        const calibration =
            await this.calibrationRepository.findById(calibrationId);

        if (!calibration) {

            throw new Error("Calibration not found");

        }

        return calibration;

    }

    _buildNotApplicable(calibration, reason) {

        return {

            calibrationId: calibration.id,

            parentCalibrationId: calibration.parentCalibrationId ?? null,

            applicable: false,

            reason: reason || "NO_PARENT",

            status: "NOT_APPLICABLE",

            isRegression: false,

            sampleSize: 0,

            minimumSampleSize: RecalibrationEffectiveness.DEFAULT_MINIMUM_SAMPLE_SIZE,

            simulationBaseline: null,

            simulated: null,

            realBaseline: null,

            real: null,

            expected: null,

            actual: null,

            effectivenessScore: null,

            effectivenessReason: null,

            tier: null,

            checks: null

        };

    }

    /*
     * Sección 1-10 -- EN VIVO, nunca persiste (ver comentario de la
     * clase). Reutiliza dos mecanismos YA construidos, cada uno con su
     * propia muestra, nunca mezclados (sección 6):
     *
     *   - "esperado": `simulateProposedOffsetWithPairs(parentId,
     *     offsetHours, {windowed:true})` (2.6.1.24/2.6.1.30) -- la
     *     MISMA ventana reciente de la calibración PADRE, evaluada con
     *     su propio offset (`actual`) y con el offset propuesto
     *     (`simulated`).
     *   - "real": `getPostActivationEvaluation(calibrationId)`
     *     (2.6.1.27) -- desempeño REAL post-activación de esta
     *     calibración (`actual`) y de la calibración padre
     *     (`previousCalibration.actual`), ambos calculados sobre TODA
     *     la evidencia real disponible de cada una, nunca sobre la
     *     ventana reciente.
     */
    async evaluate(calibrationId) {

        const calibration =
            await this._requireCalibration(calibrationId);

        if (!calibration.parentCalibrationId) {

            return this._buildNotApplicable(calibration, "NO_PARENT");

        }

        const postActivation =
            await this.effectivenessService.getPostActivationEvaluation(calibrationId);

        if (!postActivation.previousCalibration) {

            return this._buildNotApplicable(calibration, "NO_PREVIOUS_DATA");

        }

        const windowedSimulation =
            await this.effectivenessService.simulateProposedOffsetWithPairs(

                calibration.parentCalibrationId,

                calibration.offsetHours,

                { windowed: true }

            );

        const simulationBaseline =
            windowedSimulation.actual;

        const simulated =
            windowedSimulation.simulated;

        const realBaseline =
            postActivation.previousCalibration.actual;

        const real =
            postActivation.actual;

        const analysis =
            RecalibrationEffectiveness.evaluate({

                simulationBaseline,

                simulated,

                realBaseline,

                real,

                minimumSampleSize: RecalibrationEffectiveness.DEFAULT_MINIMUM_SAMPLE_SIZE

            });

        return {

            calibrationId: calibration.id,

            parentCalibrationId: calibration.parentCalibrationId,

            applicable: true,

            reason: null,

            simulationBaseline,

            simulated,

            realBaseline,

            real,

            ...analysis

        };

    }

    /*
     * Sección 14/16/17 -- persiste un snapshot inmutable explícito.
     * Nunca activa/desactiva/modifica ninguna calibración (sección 16,
     * incluso ante una REGRESSION) -- este método SOLO hace un INSERT
     * en su propia tabla.
     */
    async evaluateAndStore(calibrationId) {

        const result =
            await this.evaluate(calibrationId);

        if (!result.applicable) {

            throw new Error(

                result.reason === "NO_PARENT"

                    ? "Esta calibración no reemplazó a ninguna otra -- no hay una mejora esperada contra la cual medir su efectividad."

                    : "No se encontró información de la calibración anterior para calcular la efectividad."

            );

        }

        const now =
            new Date();

        const stored =
            await this.evaluationRepository.create({

                calibrationId: result.calibrationId,

                parentCalibrationId: result.parentCalibrationId,

                status: result.status,

                sampleSize: result.sampleSize,

                minimumSampleSize: result.minimumSampleSize,

                simulationBaselineMaeHours: result.simulationBaseline.maeHours,

                simulatedMaeHours: result.simulated.maeHours,

                expectedMaeImprovementPercentage: result.expected.mae,

                simulationBaselineRmseHours: result.simulationBaseline.rmseHours,

                simulatedRmseHours: result.simulated.rmseHours,

                expectedRmseImprovementPercentage: result.expected.rmse,

                simulationBaselineBiasHours: result.simulationBaseline.biasHours,

                simulatedBiasHours: result.simulated.biasHours,

                expectedBiasImprovementPercentage: result.expected.bias,

                realBaselineMaeHours: result.realBaseline.maeHours,

                realMaeHours: result.real.maeHours,

                actualMaeImprovementPercentage: result.actual.mae,

                realBaselineRmseHours: result.realBaseline.rmseHours,

                realRmseHours: result.real.rmseHours,

                actualRmseImprovementPercentage: result.actual.rmse,

                realBaselineBiasHours: result.realBaseline.biasHours,

                realBiasHours: result.real.biasHours,

                actualBiasImprovementPercentage: result.actual.bias,

                effectivenessScore: result.effectivenessScore,

                isRegression: result.isRegression,

                maeCheck: result.checks ? result.checks.mae : null,

                rmseCheck: result.checks ? result.checks.rmse : null,

                biasCheck: result.checks ? result.checks.bias : null,

                evaluatedAt: now

            });

        return this._serialize(stored);

    }

    /*
     * Sección 17 -- "se puede consultar el detalle de cada
     * evaluación": historial completo de snapshots persistidos, más
     * reciente primero. Nunca recalcula -- lee tal cual lo que se
     * guardó (sección 17: "no cambia retroactivamente").
     */
    async getHistory(calibrationId) {

        await this._requireCalibration(calibrationId);

        const rows =
            await this.evaluationRepository.findByCalibration(calibrationId);

        return rows.map(record => this._serialize(record));

    }

    _serialize(record) {

        return {

            id: record.id,

            calibrationId: record.calibrationId,

            parentCalibrationId: record.parentCalibrationId,

            status: record.status,

            isRegression: Boolean(record.isRegression),

            sampleSize: record.sampleSize,

            minimumSampleSize: record.minimumSampleSize,

            expected: {

                mae: toNumberOrNull(record.expectedMaeImprovementPercentage),

                rmse: toNumberOrNull(record.expectedRmseImprovementPercentage),

                bias: toNumberOrNull(record.expectedBiasImprovementPercentage)

            },

            actual: {

                mae: toNumberOrNull(record.actualMaeImprovementPercentage),

                rmse: toNumberOrNull(record.actualRmseImprovementPercentage),

                bias: toNumberOrNull(record.actualBiasImprovementPercentage)

            },

            simulationBaseline: {

                maeHours: toNumberOrNull(record.simulationBaselineMaeHours),

                rmseHours: toNumberOrNull(record.simulationBaselineRmseHours),

                biasHours: toNumberOrNull(record.simulationBaselineBiasHours)

            },

            simulated: {

                maeHours: toNumberOrNull(record.simulatedMaeHours),

                rmseHours: toNumberOrNull(record.simulatedRmseHours),

                biasHours: toNumberOrNull(record.simulatedBiasHours)

            },

            realBaseline: {

                maeHours: toNumberOrNull(record.realBaselineMaeHours),

                rmseHours: toNumberOrNull(record.realBaselineRmseHours),

                biasHours: toNumberOrNull(record.realBaselineBiasHours)

            },

            real: {

                maeHours: toNumberOrNull(record.realMaeHours),

                rmseHours: toNumberOrNull(record.realRmseHours),

                biasHours: toNumberOrNull(record.realBiasHours)

            },

            effectivenessScore: toNumberOrNull(record.effectivenessScore),

            tier: RecalibrationEffectiveness.classifyEffectivenessTier(toNumberOrNull(record.effectivenessScore)),

            checks: (record.maeCheck === null && record.rmseCheck === null && record.biasCheck === null) ? null : {

                mae: record.maeCheck,

                rmse: record.rmseCheck,

                bias: record.biasCheck

            },

            evaluatedAt: record.evaluatedAt,

            createdAt: record.createdAt

        };

    }

}

module.exports =
    RecalibrationEffectivenessService;
