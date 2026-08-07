const express =
    require("express");

const controller =
    require("../../controllers/api/ProductionMeasurementApiController");

const router =
    express.Router();

router.put("/:id", controller.update);

router.delete("/:id", controller.delete);

module.exports =
    router;
