const MaturationStatisticsService =
    require("../../services/MaturationStatisticsService");

const TemperatureAnalysisService =
    require("../../services/TemperatureAnalysisService");

const VolumeAnalysisService =
    require("../../services/VolumeAnalysisService");

const MultivariableAnalysisService =
    require("../../services/MultivariableAnalysisService");

const ModelComparisonService =
    require("../../services/ModelComparisonService");

const TemporalValidationService =
    require("../../services/TemporalValidationService");

const ModelRecommendationService =
    require("../../services/ModelRecommendationService");

const ModelAccuracyMetricsService =
    require("../../services/ModelAccuracyMetricsService");

const ModelCalibrationAnalysisService =
    require("../../services/ModelCalibrationAnalysisService");

const service =
    new MaturationStatisticsService();

const temperatureAnalysisService =
    new TemperatureAnalysisService();

const volumeAnalysisService =
    new VolumeAnalysisService();

const multivariableAnalysisService =
    new MultivariableAnalysisService();

const modelComparisonService =
    new ModelComparisonService();

const temporalValidationService =
    new TemporalValidationService();

const modelRecommendationService =
    new ModelRecommendationService();

const modelAccuracyMetricsService =
    new ModelAccuracyMetricsService();

const modelCalibrationAnalysisService =
    new ModelCalibrationAnalysisService();

const parseProductId = req =>

    req.query.productId !== undefined && req.query.productId !== ""
        ? Number(req.query.productId)
        : null;

const parseOptionalId = (req, key) =>

    req.query[key] !== undefined && req.query[key] !== ""
        ? Number(req.query[key])
        : null;

exports.statistics = async (req, res) => {

    try {

        const statistics =
            await service.getStatistics({ productId: parseProductId(req) });

        res.json({

            success: true,

            data: statistics

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.temperatureAnalysis = async (req, res) => {

    try {

        const analysis =
            await temperatureAnalysisService.getAnalysis({ productId: parseProductId(req) });

        res.json({

            success: true,

            data: analysis

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.volumeAnalysis = async (req, res) => {

    try {

        const analysis =
            await volumeAnalysisService.getAnalysis({ productId: parseProductId(req) });

        res.json({

            success: true,

            data: analysis

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.multivariableAnalysis = async (req, res) => {

    try {

        const analysis =
            await multivariableAnalysisService.getAnalysis({

                productId: parseProductId(req),

                recipeId: parseOptionalId(req, "recipeId"),

                recipeVersionId: parseOptionalId(req, "recipeVersionId")

            });

        res.json({

            success: true,

            data: analysis

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.modelComparison = async (req, res) => {

    try {

        const analysis =
            await modelComparisonService.getAnalysis({

                productId: parseProductId(req),

                recipeId: parseOptionalId(req, "recipeId"),

                recipeVersionId: parseOptionalId(req, "recipeVersionId")

            });

        res.json({

            success: true,

            data: analysis

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.temporalValidation = async (req, res) => {

    try {

        const analysis =
            await temporalValidationService.getAnalysis({

                productId: parseProductId(req),

                recipeId: parseOptionalId(req, "recipeId"),

                recipeVersionId: parseOptionalId(req, "recipeVersionId")

            });

        res.json({

            success: true,

            data: analysis

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.modelRecommendation = async (req, res) => {

    try {

        const analysis =
            await modelRecommendationService.getAnalysis({

                productId: parseProductId(req),

                recipeId: parseOptionalId(req, "recipeId"),

                recipeVersionId: parseOptionalId(req, "recipeVersionId")

            });

        res.json({

            success: true,

            data: analysis

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.14: métricas agregadas de precisión por modelo,
 * calculadas a partir de evaluaciones reales ya existentes (2.6.1.13).
 * Filtros opcionales: productId, recipeId, recipeVersionId, from, to.
 */
exports.modelAccuracyMetrics = async (req, res) => {

    try {

        const metrics =
            await modelAccuracyMetricsService.getMetrics({

                productId: parseProductId(req),

                recipeId: parseOptionalId(req, "recipeId"),

                recipeVersionId: parseOptionalId(req, "recipeVersionId"),

                from: req.query.from || null,

                to: req.query.to || null

            });

        res.json({

            success: true,

            data: metrics

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.15: análisis de sesgo y calibración por modelo,
 * construido sobre las métricas agregadas de 2.6.1.14 (no las
 * duplica). Puramente analítico -- nunca aplica una calibración.
 * Filtros opcionales: productId, recipeId, recipeVersionId, from, to.
 */
exports.modelCalibrationAnalysis = async (req, res) => {

    try {

        const analysis =
            await modelCalibrationAnalysisService.getAnalysis({

                productId: parseProductId(req),

                recipeId: parseOptionalId(req, "recipeId"),

                recipeVersionId: parseOptionalId(req, "recipeVersionId"),

                from: req.query.from || null,

                to: req.query.to || null

            });

        res.json({

            success: true,

            data: analysis

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
