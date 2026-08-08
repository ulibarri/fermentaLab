
const express =
    require("express");

const controller =
    require("../../controllers/api/ProductionBatchApiController");

const measurementController =
    require("../../controllers/api/ProductionMeasurementApiController");

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

module.exports =
    router;