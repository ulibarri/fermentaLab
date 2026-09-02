const express =
    require("express");

const router =
    express.Router();

const controller =
    require("../../controllers/api/OperationalReportApiController");

// Entrega 2.7.0.9, sección 11.
router.get("/operational-report", controller.report);

module.exports =
    router;
