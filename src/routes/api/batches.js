
const express =
    require("express");

const controller =
    require("../../controllers/api/ProductionBatchApiController");

const measurementController =
    require("../../controllers/api/ProductionMeasurementApiController");

const predictionController =
    require("../../controllers/api/MaturationPredictionApiController");

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

module.exports =
    router;