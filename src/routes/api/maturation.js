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

const degradationController =
    require("../../controllers/api/CalibrationDegradationApiController");

const calibrationHistoryController =
    require("../../controllers/api/CalibrationHistoryApiController");

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

// Entrega 2.7.0.1, secciones 1-6 -- capa OPERATIVA (distinta de la
// analítica de arriba): estado en vivo del lote frente a su ventana de
// confianza, y alerta de deriva entre sus dos predicciones vigentes más
// recientes. Mismo namespace "/batches/:batchId/..." que
// "prediction-analysis" -- ambas son vistas derivadas del historial de
// predicciones de un lote, solo que ésta responde "¿cómo va el lote
// AHORA MISMO?" en vez de "¿qué tan buena fue cada predicción?".
router.get("/batches/:batchId/operational-status", predictionController.operationalStatus);

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

// Entrega 2.6.1.31, sección 13 -- ruta LITERAL "/calibrations/history"
// declarada ANTES que "/calibrations/:id", mismo motivo de siempre en
// este router (ver "/calibrations/health" arriba): si fuera al revés,
// Express interpretaría "history" como el valor de :id y esta ruta
// nunca se alcanzaría. El spec de esta entrega nombra el endpoint como
// "/api/calibrations/history" (sin el prefijo "/maturation") -- se
// mantiene el namespace real de este router
// ("/api/maturation/calibrations/...", el mismo que usan los otros 20+
// endpoints de calibraciones desde 2.6.1.16) en vez de introducir un
// segundo router/prefijo solo para esta ruta, mismo criterio que la
// inconsistencia de rutas ya resuelta en 2.6.1.25 (sección 11 explícita
// gana sobre un path literal de una sección distinta del mismo
// documento).
router.get("/calibrations/history", calibrationHistoryController.history);

// Entrega 2.6.1.33, sección 15 -- ruta LITERAL
// "/calibrations/effectiveness-summary" declarada ANTES que
// "/calibrations/:id", mismo motivo de siempre en este router (ver
// "/calibrations/health" y "/calibrations/history" arriba): si fuera al
// revés, Express interpretaría "effectiveness-summary" como el valor de
// :id y esta ruta nunca se alcanzaría.
router.get("/calibrations/effectiveness-summary", calibrationController.effectivenessSummary);

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

// Entrega 2.6.1.32 -- efectividad real de las recalibraciones (secciones
// 1-10/14). Más segmentos que "/calibrations/:id", mismo criterio de
// siempre: nunca compite con ninguna ruta anterior.
router.get("/calibrations/:id/effectiveness", calibrationController.effectiveness);

router.post("/calibrations/:id/effectiveness/evaluate", calibrationController.evaluateEffectiveness);

router.get("/calibrations/:id/effectiveness/history", calibrationController.effectivenessHistory);

// Entrega 2.6.1.28 -- detección automática de degradación (sección 14).
// La lectura vive bajo "/calibrations/:id/..." (mismo criterio que
// health/post-activation-evaluation de arriba); las acciones
// (acknowledge/resolve) son su propio recurso de nivel superior, mismo
// patrón que "/alerts/:id/acknowledge" (2.6.1.21) -- un evento de
// degradación tiene identidad propia, independiente de la calibración.
router.get("/calibrations/:id/degradation", degradationController.status);

router.post("/degradation-events/:id/acknowledge", degradationController.acknowledge);

router.post("/degradation-events/:id/resolve", degradationController.resolve);

// Entrega 2.6.1.29, sección 12 -- ruta LITERAL pedida por el spec:
// "POST /api/maturation/degradation-alerts/:id/proposal", bajo un
// namespace propio ("degradation-alerts") distinto del
// "degradation-events" que ya usan acknowledge/resolve arriba (nombre
// elegido por esta implementación en 2.6.1.28, que no dictaba un path
// exacto). Se deja esta inconsistencia de nombres en vez de renombrar
// endpoints ya probados en producción sin que el spec lo pida -- ver
// el resumen final de esta entrega.
router.post("/degradation-alerts/:id/proposal", degradationController.generateProposal);

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

// Entrega 2.6.1.30, sección 17 -- evaluación y priorización, mismo
// namespace de propuestas de siempre.
router.post("/recalibration-proposals/:id/evaluate", recalibrationProposalController.evaluate);

router.get("/recalibration-proposals/:id/evaluations", recalibrationProposalController.evaluationHistory);

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
