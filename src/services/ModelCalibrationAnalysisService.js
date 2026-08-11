const ModelAccuracyMetricsService =
    require("./ModelAccuracyMetricsService");

const ModelCalibrationAnalysis =
    require("../utils/ModelCalibrationAnalysis");

/*
 * Orquesta la Entrega 2.6.1.15: envuelve ModelAccuracyMetricsService
 * (2.6.1.14) SIN reimplementar la recolección de lotes/predicciones/
 * evaluaciones -- sección 8, criterio de aceptación #2: "se reutilicen
 * las evaluaciones reales existentes". Esta clase solo extiende cada
 * resumen por modelo con la capa de sesgo/calibración
 * (ModelCalibrationAnalysis.summarizeCalibration).
 *
 * Puramente analítica y de solo lectura -- igual que
 * ModelAccuracyMetricsService, nunca escribe una predicción, una
 * evaluación, un lote, ni un modelo activo (sección 7/11/13: "no
 * aplicar la calibración automáticamente").
 */
class ModelCalibrationAnalysisService {

    constructor() {

        this.metricsService =
            new ModelAccuracyMetricsService();

    }

    async getAnalysis(filters = {}) {

        const metrics =
            await this.metricsService.getMetrics(filters);

        const models =
            (metrics.models || []).map(model =>

                ModelCalibrationAnalysis.summarizeCalibration(model)

            );

        return {

            ...metrics,

            models,

            note: "Este análisis es una recomendación analítica: no cambia automáticamente el modelo activo ni las predicciones. Requiere aprobación explícita del usuario en una entrega futura."

        };

    }

}

module.exports =
    ModelCalibrationAnalysisService;
