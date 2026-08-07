
const express =
    require("express");

const controller =
    require("../../controllers/api/ProductionBatchApiController");

const router =
    express.Router();

router.get("/", controller.index);

router.get("/:id", controller.show);

router.post("/", controller.store);

router.put("/:id/start", controller.start);

router.put("/:id/complete", controller.complete);

router.delete("/:id", controller.cancel);

module.exports =
    router;