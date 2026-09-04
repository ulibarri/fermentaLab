
const express =
    require("express");

const controller =
    require("../../controllers/api/ProductionBatchApiController");

const measurementController =
    require("../../controllers/api/ProductionMeasurementApiController");

const predictionController =
    require("../../controllers/api/MaturationPredictionApiController");

const predictionAlertController =
    require("../../controllers/api/ProductionPredictionAlertApiController");

const hydrometerAuditController =
    require("../../controllers/api/HydrometerAuditApiController");

const router =
    express.Router();

router.get("/", controller.index);

router.get("/:id", controller.show);

router.post("/", controller.store);

router.put("/:id", controller.update);

router.put("/:id/start", controller.start);

router.put("/:id/complete", controller.complete);

router.put("/:id/second-fermentation/start", controller.startSecondFermentation);

router.put("/:id/second-fermentation/finish", controller.finishSecondFermentation);

router.delete("/:id", controller.cancel);

router.get("/:id/measurements", measurementController.indexByBatch);

router.post("/:id/measurements", measurementController.storeForBatch);

router.get("/:id/maturation", measurementController.maturation);

router.get("/:id/maturation/evaluation", measurementController.maturationEvaluation);

// Entrega 2.7.0.2, sección 11 -- "/predictions/current" tiene un
// segmento literal más que "/predictions" a secas, así que no compite
// con ella sin importar el orden de declaración (Express distingue
// ambos patrones por su propia estructura, mismo razonamiento que ya
// documentan varias rutas de routes/api/maturation.js).
router.get("/:id/predictions", predictionController.predictionsForBatch);

router.get("/:id/predictions/current", predictionController.currentPredictionForBatch);

// Entrega 2.7.0.3, sección 13 -- mismo criterio de orden que
// "/predictions"/"/predictions/current" arriba: "/prediction-alerts/active"
// tiene un segmento literal más, así que nunca compite con
// "/prediction-alerts" a secas.
router.get("/:id/prediction-alerts", predictionAlertController.history);

router.get("/:id/prediction-alerts/active", predictionAlertController.active);

// Entrega 2.8.0.4, sección 7 -- auditoría de hidrómetro por lote
// (Brix derivado vía tabla del fabricante vs. Brix real de BrixMate).
// Namespace de lote (no de tabla) -- mismo criterio que
// "/:id/maturation"/"/:id/predictions" arriba: la lógica real vive en
// HydrometerAuditService, este controller solo delega.
router.get("/:id/hydrometer/audit", hydrometerAuditController.auditForBatch);

module.exports =
    router;