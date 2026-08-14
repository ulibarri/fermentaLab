const express =
    require("express");

const router =
    express.Router();

const controller =
    require("../controllers/MaturationStatisticsController");

const calibrationsController =
    require("../controllers/MaturationCalibrationsController");

const dashboardController =
    require("../controllers/MaturationDashboardController");

const alertCenterController =
    require("../controllers/MaturationAlertCenterController");

const recalibrationProposalsController =
    require("../controllers/MaturationRecalibrationProposalsController");

const modelHistoryController =
    require("../controllers/MaturationModelHistoryController");

router.get("/statistics", controller.index);

router.get("/calibrations", calibrationsController.index);

router.get("/dashboard", dashboardController.index);

router.get("/alerts", alertCenterController.index);

router.get("/recalibration-proposals", recalibrationProposalsController.index);

// Entrega 2.6.1.31, sección 11 -- "Predicción -> Evolución del modelo".
router.get("/model-history", modelHistoryController.index);

module.exports =
    router;
