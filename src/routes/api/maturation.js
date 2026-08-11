const express =
    require("express");

const controller =
    require("../../controllers/api/MaturationApiController");

const modelConfigurationController =
    require("../../controllers/api/MaturationModelConfigurationApiController");

const predictionController =
    require("../../controllers/api/MaturationPredictionApiController");

const calibrationController =
    require("../../controllers/api/MaturationModelCalibrationApiController");

const dashboardController =
    require("../../controllers/api/ModelPerformanceDashboardApiController");

const alertController =
    require("../../controllers/api/ModelAlertApiController");

const recalibrationProposalController =
    require("../../controllers/api/RecalibrationProposalApiController");

const router =
    express.Router();

router.get("/statistics", controller.statistics);

router.get("/analysis/temperature", controller.temperatureAnalysis);

router.get("/analysis/volume", controller.volumeAnalysis);

router.get("/analysis/multivariable", controller.multivariableAnalysis);

router.get("/analysis/models", controller.modelComparison);

router.get("/analysis/temporal-validation", controller.temporalValidation);

router.get("/analysis/model-recommendation", controller.modelRecommendation);

router.get("/models/metrics", controller.modelAccuracyMetrics);

router.get("/models/calibration-analysis", controller.modelCalibrationAnalysis);

router.get("/models/status", modelConfigurationController.status);

router.post("/models/activate", modelConfigurationController.activate);

router.post("/models/activate-recommendation", modelConfigurationController.activateRecommendation);

// Entrega 2.6.1.20 -- dashboard de desempeño (sección 10). Dos
// segmentos después de "/models/" (:modelId + "dashboard"), así que
// nunca compite con las rutas literales de un solo segmento de arriba
// ("/models/metrics", "/models/calibration-analysis", "/models/status")
// sin importar el orden de declaración.
router.get("/models/:modelId/dashboard", dashboardController.dashboard);

// Entrega 2.6.1.21 -- alertas y recomendaciones de recalibración
// (sección 12). "/models/:modelId/alerts" y
// "/models/:modelId/recalibration-proposal" tienen dos segmentos
// después de "/models/", igual que "/models/:modelId/dashboard" de
// arriba -- nunca compiten con las rutas literales de un solo
// segmento ("/models/status", "/models/metrics", etc.).
router.get("/models/:modelId/alerts", alertController.list);

router.post("/models/:modelId/recalibration-proposal", alertController.recalibrationProposal);

// Entrega 2.6.1.22 -- centro de alertas (sección 10/11). "GET
// /alerts/summary" (ruta literal) se declara ANTES que "GET
// /alerts/:id", mismo motivo que "/calibrations/health" en 2.6.1.18:
// si fuera al revés, Express interpretaría "summary" como el valor de
// :id y esa ruta nunca se alcanzaría.
router.get("/alerts", alertController.globalList);

router.get("/alerts/summary", alertController.summary);

router.get("/alerts/:id", alertController.detail);

router.post("/alerts/:id/acknowledge", alertController.acknowledge);

router.post("/alerts/:id/resolve", alertController.resolve);

router.get("/predictions/batch/:batchId", predictionController.history);

router.get("/predictions/:id/evaluation", predictionController.evaluation);

router.get("/predictions/:id", predictionController.detail);

router.get("/batches/:batchId/prediction-analysis", predictionController.batchAnalysis);

// Entrega 2.6.1.16 -- gestión y activación de calibraciones (sección 12,
// 7 endpoints). Las rutas de acción (:id/approve, :id/activate, ...) se
// declaran antes de "/:id" a secas -- mismo criterio de siempre en este
// router para evitar ambigüedad de segmentos.
router.get("/calibrations", calibrationController.list);

router.post("/calibrations", calibrationController.create);

// Entrega 2.6.1.18 -- ruta LITERAL "/calibrations/health" declarada
// ANTES que "/calibrations/:id": si fuera al revés, Express
// interpretaría "health" como el valor de :id y esta ruta nunca se
// alcanzaría.
router.get("/calibrations/health", calibrationController.healthAll);

router.get("/calibrations/:id", calibrationController.detail);

router.put("/calibrations/:id", calibrationController.update);

router.post("/calibrations/:id/approve", calibrationController.approve);

router.post("/calibrations/:id/activate", calibrationController.activate);

router.post("/calibrations/:id/deactivate", calibrationController.deactivate);

router.post("/calibrations/:id/reject", calibrationController.reject);

// Entrega 2.6.1.17 -- evaluación de efectividad de la calibración
// (sección 15, 3 endpoints).
router.get("/calibrations/:id/evaluation", calibrationController.evaluation);

router.get("/calibrations/:id/evaluations", calibrationController.evaluations);

router.post("/calibrations/:id/evaluate", calibrationController.evaluate);

// Entrega 2.6.1.18 -- salud individual (por :id, sección 16).
router.get("/calibrations/:id/health", calibrationController.health);

// Entrega 2.6.1.27 -- evaluación post-activación (secciones 1-9). Más
// segmentos que "/calibrations/:id", mismo criterio de siempre: nunca
// compite con ninguna ruta anterior.
router.get("/calibrations/:id/post-activation-evaluation", calibrationController.postActivationEvaluation);

// Entrega 2.6.1.19 -- versionado y reemplazo controlado (sección 13).
// Los tres tienen más segmentos que "/calibrations/:id" (o son POST,
// no GET), así que no compiten con ninguna ruta anterior -- no hace
// falta el mismo cuidado de orden que "/calibrations/health".
router.get("/calibrations/:id/versions", calibrationController.versions);

router.get("/calibrations/:id/comparison/:otherId", calibrationController.comparison);

router.post("/calibrations/:id/create-replacement", calibrationController.createReplacement);

// Entrega 2.6.1.24 -- gestión y aprobación de propuestas de
// recalibración (sección 11, 4 endpoints). No hay riesgo de colisión
// de rutas aquí: "/recalibration-proposals" (sin :id) y
// "/recalibration-proposals/:id" son dos declaraciones separadas, a
// diferencia de "/alerts/summary" vs. "/alerts/:id" (que sí competían
// porque "summary" caería dentro de ":id" si el orden fuera al revés).
router.get("/recalibration-proposals", recalibrationProposalController.list);

router.get("/recalibration-proposals/:id", recalibrationProposalController.detail);

router.post("/recalibration-proposals/:id/approve", recalibrationProposalController.approve);

router.post("/recalibration-proposals/:id/reject", recalibrationProposalController.reject);

// Entrega 2.6.1.25, sección 11 -- "no reutilizar el endpoint genérico"
// de calibraciones (que sigue existiendo sin cambios en
// "/calibrations/:id/activate", 2.6.1.16, usado por
// /maturation/calibrations). El spec de esta entrega, en su propia
// sección 10, nombra por error ese mismo path genérico como si fuera
// nuevo -- una inconsistencia entre secciones del propio documento,
// resuelta a favor de la instrucción explícita y enfática de la
// sección 11 ("Importante"): esta es una ruta nueva, propia del
// namespace de propuestas.
router.post("/recalibration-proposals/:id/activate", recalibrationProposalController.activate);

module.exports =
    router;
