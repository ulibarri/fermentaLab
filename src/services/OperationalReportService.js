const ModelAccuracyMetricsService =
    require("./ModelAccuracyMetricsService");

const CalibrationEffectivenessService =
    require("./CalibrationEffectivenessService");

const ModelAlertService =
    require("./ModelAlertService");

const RecalibrationProposalService =
    require("./RecalibrationProposalService");

const PredictionAlertTrendService =
    require("./PredictionAlertTrendService");

const OperationalActionAnalyticsService =
    require("./OperationalActionAnalyticsService");

const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const OperationalReport =
    require("../utils/OperationalReport");

const DATE_ONLY_PATTERN =
    /^\d{4}-\d{2}-\d{2}$/;

// Sección 2 -- "el reporte debe trabajar con un período explícito." El
// spec no obliga un default cuando el usuario no elige ninguno de los
// presets ni un rango personalizado (la vista siempre debería mandar
// from/to, ver report.js) -- se usa 30 días como red de seguridad para
// que el endpoint nunca falle por falta de período. Judgment call,
// flagged.
const DEFAULT_PERIOD_DAYS = 30;

/*
 * Entrega 2.7.0.9 -- orquesta el reporte consolidado. Puramente un
 * ORQUESTADOR (mismo criterio que ModelAlertService/
 * RecalibrationProposalService, 2.6.1.21/24): llama a los CUATRO
 * servicios de analítica ya existentes con el MISMO período/filtros
 * (sección 2: "todos los módulos del reporte deberán utilizar el mismo
 * período") y delega el 100% de la consolidación en el módulo puro
 * `OperationalReport.js` -- nunca calcula una métrica por su cuenta.
 *
 * Sección 14 -- "cada bloque debe funcionar independientemente... no
 * debe fallar el reporte completo": cada llamada a un servicio fuente
 * vive en su propio try/catch; un bloque que falla se reporta como
 * `null` (el módulo puro y la vista ya saben mostrar el estado vacío
 * correspondiente) sin tumbar los demás bloques.
 */
class OperationalReportService {

    constructor() {

        this.modelAccuracyMetricsService =
            new ModelAccuracyMetricsService();

        this.calibrationEffectivenessService =
            new CalibrationEffectivenessService();

        this.modelAlertService =
            new ModelAlertService();

        this.recalibrationProposalService =
            new RecalibrationProposalService();

        this.predictionAlertTrendService =
            new PredictionAlertTrendService();

        this.operationalActionAnalyticsService =
            new OperationalActionAnalyticsService();

        this.calibrationRepository =
            new MaturationModelCalibrationRepository();

    }

    _resolvePeriod({ from, to }) {

        if (from && to) {

            return { from, to };

        }

        const now =
            new Date();

        const defaultTo =
            to || now.toISOString().slice(0, 10);

        const defaultFromDate =
            new Date(now.getTime() - (DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000));

        const defaultFrom =
            from || defaultFromDate.toISOString().slice(0, 10);

        return { from: defaultFrom, to: defaultTo };

    }

    /*
     * Sección 4 -- bloque de calibraciones. Fusiona DOS fuentes ya
     * existentes por `calibrationId` (nunca recalcula ninguna de las
     * dos):
     *   - CalibrationEffectivenessService.getAllActiveHealth() (2.6.1.18):
     *     health/recentSampleSize/recentMaeHours/recommendRecalibration,
     *     EN VIVO (sin filtro de período, sección 14: "estado puede
     *     calcularse bajo demanda").
     *   - MaturationModelCalibrationRepository.findAll({status:"ACTIVE"})
     *     (2.6.1.16): version/activatedAt/producto/receta, para dar
     *     contexto legible ("CAL-2026-08-15" del mockup se traduce aquí
     *     como versión + fecha de activación, ya que este proyecto no
     *     tiene un identificador de calibración con ese formato --
     *     judgment call, flagged).
     * `productId` filtra en memoria sobre el include ya cargado (recipe.
     * productId) -- ninguna de las dos fuentes acepta ese filtro
     * nativamente para esta consulta en particular.
     */
    async _getCalibrationBlock({ productId, modelId, from, to }) {

        const [health, activeRows, alertsSummary, proposals] =
            await Promise.all([

                this.calibrationEffectivenessService.getAllActiveHealth(),

                this.calibrationRepository.findAll({ status: "ACTIVE" }),

                this.modelAlertService.getSummary({ productId, modelId, from, to }),

                this.recalibrationProposalService.list({ productId, status: "PROPOSED", from, to })

            ]);

        const healthByCalibrationId =
            new Map(health.calibrations.map(row => [Number(row.calibrationId), row]));

        const calibrations =
            activeRows

                .filter(row => {

                    if (!productId) {

                        return true;

                    }

                    const rowProductId =
                        row.recipeVersion && row.recipeVersion.recipe && row.recipeVersion.recipe.product
                            ? row.recipeVersion.recipe.product.id
                            : null;

                    return Number(rowProductId) === Number(productId);

                })

                .map(row => {

                    const healthRow =
                        healthByCalibrationId.get(row.id) || null;

                    const recipe =
                        row.recipeVersion ? row.recipeVersion.recipe : null;

                    const product =
                        recipe ? recipe.product : null;

                    return {

                        calibrationId: row.id,

                        modelType: row.modelType,

                        recipeVersionId: row.recipeVersionId,

                        version: row.version,

                        product: product ? { id: product.id, name: product.name } : null,

                        recipe: recipe ? { id: recipe.id, name: recipe.name } : null,

                        status: row.status,

                        activatedAt: row.activatedAt,

                        health: healthRow ? healthRow.health : "INSUFFICIENT_DATA",

                        recentSampleSize: healthRow ? healthRow.recentSampleSize : 0,

                        recentMaeHours: healthRow ? healthRow.recentMaeHours : null,

                        recommendRecalibration: healthRow ? healthRow.recommendRecalibration : false

                    };

                });

        return {

            calibrations,

            alertsSummary,

            pendingProposalsCount: proposals.length,

            note: "El estado de calibración (salud/tendencia) se calcula en vivo y no se filtra por el período del reporte -- refleja la condición actual de cada calibración activa."

        };

    }

    async getReport({ from, to, productId, recipeId, modelId } = {}) {

        const period =
            this._resolvePeriod({ from, to });

        const results =
            await Promise.allSettled([

                this.modelAccuracyMetricsService.getMetrics({ productId, recipeId, from: period.from, to: period.to }),

                this._getCalibrationBlock({ productId, modelId, from: period.from, to: period.to }),

                this.predictionAlertTrendService.getTrends({ from: period.from, to: period.to, productId }),

                this.operationalActionAnalyticsService.getAnalytics({ from: period.from, to: period.to, productId })

            ]);

        const [predictionPerformanceResult, calibrationResult, alertTrendsResult, actionAnalyticsResult] =
            results;

        const blockErrors =
            {};

        const predictionPerformance =
            predictionPerformanceResult.status === "fulfilled" ? predictionPerformanceResult.value : null;

        if (predictionPerformanceResult.status === "rejected") {

            blockErrors.predictionPerformance = predictionPerformanceResult.reason.message;

        }

        const calibration =
            calibrationResult.status === "fulfilled" ? calibrationResult.value : null;

        if (calibrationResult.status === "rejected") {

            blockErrors.calibration = calibrationResult.reason.message;

        }

        const alertTrends =
            alertTrendsResult.status === "fulfilled" ? alertTrendsResult.value : null;

        if (alertTrendsResult.status === "rejected") {

            blockErrors.alerts = alertTrendsResult.reason.message;

        }

        const actionAnalytics =
            actionAnalyticsResult.status === "fulfilled" ? actionAnalyticsResult.value : null;

        if (actionAnalyticsResult.status === "rejected") {

            blockErrors.actions = actionAnalyticsResult.reason.message;

        }

        const dto =
            OperationalReport.buildOperationalReportDTO({

                period,

                predictionPerformance,

                calibration,

                alertTrends,

                actionAnalytics

            });

        return {

            ...dto,

            blockErrors: Object.keys(blockErrors).length > 0 ? blockErrors : null

        };

    }

}

module.exports =
    OperationalReportService;
