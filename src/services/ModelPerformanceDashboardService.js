const MaturationModelConfigurationRepository =
    require("../repositories/MaturationModelConfigurationRepository");

const RecipeVersionRepository =
    require("../repositories/RecipeVersionRepository");

const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const MaturationModelCalibrationService =
    require("./MaturationModelCalibrationService");

const CalibrationEffectivenessService =
    require("./CalibrationEffectivenessService");

const MaturationPredictionRepository =
    require("../repositories/MaturationPredictionRepository");

const PredictionEvaluation =
    require("../utils/PredictionEvaluation");

const ModelAccuracyMetrics =
    require("../utils/ModelAccuracyMetrics");

const CalibrationEffectiveness =
    require("../utils/CalibrationEffectiveness");

const ModelPerformanceIndicator =
    require("../utils/ModelPerformanceIndicator");

// Sección 9: "Últimos 7 días / 30 días / 90 días / Todo" -- catálogo
// cerrado, igual criterio que MaturationModelTypes.AVAILABLE_MODEL_TYPES
// (única fuente de verdad, nunca disperso entre frontend/backend).
const PERIOD_DAYS = {

    "7d": 7,

    "30d": 30,

    "90d": 90,

    "all": null

};

const DEFAULT_PERIOD = "all";

function toNumberOrNull(value) {

    return value === null || value === undefined ? null : Number(value);

}

/*
 * Dashboard de desempeño del modelo (Entrega 2.6.1.20).
 *
 * Puramente de LECTURA (sección 11, criterio de aceptación #23): no
 * modifica ninguna predicción, calibración, evaluación ni regla de
 * activación -- solo orquesta consultas y reutiliza módulos puros ya
 * existentes y probados (`PredictionEvaluation` 2.6.1.13,
 * `ModelAccuracyMetrics` 2.6.1.14, `CalibrationEffectiveness` 2.6.1.17,
 * `CalibrationHealth` 2.6.1.18 vía `CalibrationEffectivenessService`,
 * `MaturationModelCalibrationService.getVersionChain()` 2.6.1.19) --
 * nunca reimplementa ninguno de esos cálculos.
 *
 * Diferencia clave con `CalibrationEffectivenessService.evaluate()`
 * (2.6.1.17, escaneado a UNA calibración vía `calibrationId`): el
 * bloque `performance` de este dashboard es a nivel de MODELO
 * (`modelConfigurationId`), es decir, agrega TODAS las predicciones
 * vigentes de ese modelo+receta a lo largo del tiempo, sin importar
 * qué calibración (si alguna) tenía cada una aplicada en su momento
 * -- responde "¿cuánto ayuda calibrar, en general, a este modelo?",
 * no "¿cuánto ayudó esta versión de calibración en particular?" (esa
 * pregunta la sigue respondiendo `CalibrationEffectivenessService`
 * sin cambios). El bloque `calibrationHistory` sí usa `evaluate()`
 * por versión, para el detalle sección 7.
 */
class ModelPerformanceDashboardService {

    constructor() {

        this.modelConfigurationRepository =
            new MaturationModelConfigurationRepository();

        this.recipeVersionRepository =
            new RecipeVersionRepository();

        this.calibrationRepository =
            new MaturationModelCalibrationRepository();

        this.calibrationService =
            new MaturationModelCalibrationService();

        this.effectivenessService =
            new CalibrationEffectivenessService();

        this.predictionRepository =
            new MaturationPredictionRepository();

    }

    _resolvePeriodSince(period) {

        const key =
            PERIOD_DAYS[period] !== undefined ? period : DEFAULT_PERIOD;

        const days =
            PERIOD_DAYS[key];

        if (!days) {

            return null;

        }

        return new Date(Date.now() - days * 24 * 3600 * 1000);

    }

    _recipeVersionLabel(recipeVersion) {

        if (!recipeVersion) {

            return null;

        }

        const recipeName =
            recipeVersion.recipe ? recipeVersion.recipe.name : null;

        const productName =
            recipeVersion.recipe && recipeVersion.recipe.product
                ? recipeVersion.recipe.product.name
                : null;

        return {

            id: recipeVersion.id,

            version: recipeVersion.version,

            recipeName,

            productName

        };

    }

    async _requireModelConfiguration(modelId) {

        const modelConfig =
            await this.modelConfigurationRepository.findById(modelId);

        if (!modelConfig) {

            throw new Error("Model configuration not found");

        }

        return modelConfig;

    }

    /*
     * Sección 6/9 -- calibración objetivo del dashboard: si el filtro
     * `calibrationId` viene explícito (sección 9: "Calibración" es un
     * filtro más), se usa esa versión concreta (debe pertenecer al
     * mismo modelType+recipeVersionId, mismo criterio de sección 14 de
     * 2.6.1.19); si no, se usa la ACTIVE actual (o `null` si esta
     * combinación modelo/receta nunca tuvo ninguna calibración).
     */
    async _resolveTargetCalibration(modelConfig, calibrationId) {

        if (calibrationId) {

            const calibration =
                await this.calibrationRepository.findById(calibrationId);

            if (!calibration) {

                throw new Error("Calibration not found");

            }

            if (calibration.modelType !== modelConfig.modelType || Number(calibration.recipeVersionId) !== Number(modelConfig.recipeVersionId)) {

                throw new Error("La calibración seleccionada no pertenece a este modelo/receta.");

            }

            return calibration;

        }

        return await this.calibrationRepository.findActiveByModelAndRecipeVersion(

            modelConfig.modelType,

            modelConfig.recipeVersionId

        );

    }

    /*
     * Recorre las predicciones VIGENTES del modelo (sección 2/3),
     * filtra por periodo (sobre `actualMaturationAt`, mismo criterio
     * de "fecha de maduración real, no de generación de la predicción"
     * que `ModelAccuracyMetricsService`, 2.6.1.14), y arma en un solo
     * paso: las dos listas {errorHours,direction} para
     * `ModelAccuracyMetrics.summarizeModelAccuracy()` (raw y
     * calibrated) y el `predictionHistory` crudo para las
     * visualizaciones de evolución temporal / predicción-vs-real /
     * distribución del error (secciones 3/4/5) -- una sola consulta,
     * un solo recorrido.
     */
    _buildPredictionData(predictions, since) {

        const rawEvaluations = [];

        const calibratedEvaluations = [];

        const predictionHistory = [];

        for (const prediction of predictions) {

            const batch =
                prediction.productionBatch;

            const actualMaturationAt =
                batch ? (batch.finishedAt ?? null) : null;

            // Sección 6 (2.6.1.13): sin maduración real todavía, no
            // participa -- nunca se interpreta como error 0.
            if (!actualMaturationAt) {

                continue;

            }

            if (since && new Date(actualMaturationAt).getTime() < since.getTime()) {

                // Fuera del periodo solicitado -- no se cuenta.
                continue;

            }

            const rawEval =
                PredictionEvaluation.evaluatePrediction({

                    predictedMaturationAt: prediction.rawPredictedMaturationAt,

                    predictedDurationHours: null,

                    actualMaturationAt

                });

            const calibratedEval =
                PredictionEvaluation.evaluatePrediction({

                    predictedMaturationAt: prediction.predictedMaturationAt,

                    predictedDurationHours: null,

                    actualMaturationAt

                });

            if (rawEval.status !== "EVALUATED" || calibratedEval.status !== "EVALUATED") {

                continue;

            }

            rawEvaluations.push({ errorHours: rawEval.errorHours, direction: rawEval.direction });

            calibratedEvaluations.push({ errorHours: calibratedEval.errorHours, direction: calibratedEval.direction });

            predictionHistory.push({

                predictionId: prediction.id,

                batchId: batch ? batch.id : null,

                batchNumber: batch ? batch.batchNumber : null,

                predictedAt: prediction.predictedAt,

                actualMaturationAt,

                rawPredictedMaturationAt: prediction.rawPredictedMaturationAt,

                predictedMaturationAt: prediction.predictedMaturationAt,

                calibrationId: prediction.calibrationId ?? null,

                rawErrorHours: rawEval.errorHours,

                calibratedErrorHours: calibratedEval.errorHours,

                calibratedAbsoluteErrorHours: calibratedEval.absoluteErrorHours,

                direction: calibratedEval.direction

            });

        }

        return { rawEvaluations, calibratedEvaluations, predictionHistory };

    }

    /*
     * Sección 6/7: bloque de la calibración objetivo (salud EN VIVO,
     * reutilizando `getHealth()` de 2.6.1.18) + la cadena de versiones
     * completa (2.6.1.19) con las métricas propias de cada una
     * (reutilizando `evaluate()` de 2.6.1.17 por versión, nunca
     * recalculado aquí).
     */
    async _buildCalibrationSection(targetCalibration) {

        if (!targetCalibration) {

            return { calibrationBlock: null, trend: null, calibrationHistory: [] };

        }

        const health =
            await this.effectivenessService.getHealth(targetCalibration.id);

        const calibrationBlock = {

            id: targetCalibration.id,

            version: targetCalibration.version,

            status: targetCalibration.status,

            offsetHours: toNumberOrNull(targetCalibration.offsetHours),

            health: health.health,

            historical: health.historical,

            recent: health.recent,

            recommendRecalibration: health.recommendRecalibration

        };

        const chain =
            await this.calibrationService.getVersionChain(targetCalibration.id);

        const calibrationHistory =
            await Promise.all(chain.map(async c => {

                const evaluation =
                    await this.effectivenessService.evaluate(c.id);

                return {

                    id: c.id,

                    version: c.version,

                    status: c.status,

                    offsetHours: c.offsetHours,

                    activatedAt: c.activatedAt,

                    deactivatedAt: c.deactivatedAt,

                    sampleSize: evaluation.evaluationSampleSize,

                    maeHours: evaluation.calibrated ? evaluation.calibrated.maeHours : null,

                    rmseHours: evaluation.calibrated ? evaluation.calibrated.rmseHours : null,

                    biasHours: evaluation.calibrated ? evaluation.calibrated.biasHours : null

                };

            }));

        return { calibrationBlock, trend: health.trend, calibrationHistory };

    }

    /*
     * Punto de entrada principal -- GET /api/maturation/models/:modelId/dashboard
     * (sección 10). `modelId` es el id de una fila de
     * MaturationModelConfiguration (2.6.1.11) -- así el dashboard
     * también puede abrirse sobre una configuración de modelo HISTÓRICA
     * (INACTIVE), no solo la vigente, para revisar cómo se desempeñó en
     * su momento.
     */
    async getDashboard(modelId, filters = {}) {

        const modelConfig =
            await this._requireModelConfiguration(modelId);

        const recipeVersion =
            await this.recipeVersionRepository.findById(modelConfig.recipeVersionId);

        const since =
            this._resolvePeriodSince(filters.period);

        const predictions =
            await this.predictionRepository.findByModelConfiguration(modelConfig.id);

        const { rawEvaluations, calibratedEvaluations, predictionHistory } =
            this._buildPredictionData(predictions, since);

        const rawSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy(modelConfig.modelType, rawEvaluations);

        const calibratedSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy(modelConfig.modelType, calibratedEvaluations);

        const targetCalibration =
            await this._resolveTargetCalibration(modelConfig, filters.calibrationId);

        const { calibrationBlock, trend, calibrationHistory } =
            await this._buildCalibrationSection(targetCalibration);

        const performance =
            CalibrationEffectiveness.buildEvaluation({

                calibrationId: targetCalibration ? targetCalibration.id : null,

                modelType: modelConfig.modelType,

                recipeVersionId: modelConfig.recipeVersionId,

                raw: rawSummary,

                calibrated: calibratedSummary

            });

        const indicator =
            ModelPerformanceIndicator.classifyIndicator({

                sampleSize: performance.evaluationSampleSize,

                maeRaw: performance.raw ? performance.raw.maeHours : null,

                maeCalibrated: performance.calibrated ? performance.calibrated.maeHours : null,

                calibrationHealth: calibrationBlock ? calibrationBlock.health : null

            });

        return {

            model: {

                id: modelConfig.id,

                type: modelConfig.modelType,

                recipeVersionId: modelConfig.recipeVersionId,

                recipeVersion: this._recipeVersionLabel(recipeVersion),

                status: modelConfig.status

            },

            filters: {

                period: PERIOD_DAYS[filters.period] !== undefined ? filters.period : DEFAULT_PERIOD,

                calibrationId: filters.calibrationId ? Number(filters.calibrationId) : null

            },

            performance: {

                sampleSize: performance.evaluationSampleSize,

                raw: performance.raw,

                calibrated: performance.calibrated,

                maeImprovementHours: performance.maeImprovementHours,

                maeImprovementPercentage: performance.maeImprovementPercentage,

                result: performance.result

            },

            calibration: calibrationBlock,

            trend,

            indicator,

            predictionHistory,

            calibrationHistory

        };

    }

}

module.exports =
    ModelPerformanceDashboardService;
