const express =
    require("express");

const controller =
    require("../../controllers/api/ProductionAlertActionApiController");

const trendController =
    require("../../controllers/api/PredictionAlertTrendApiController");

const router =
    express.Router();

// Entrega 2.7.0.5, sección 13 -- router propio "/api/prediction-alerts",
// namespace literal del spec, distinto de "/api/batches/:id/
// prediction-alerts" (2.7.0.3, por-lote) porque estas rutas son
// por-ALERTA.

// Entrega 2.7.0.8, Acción 15 -- "/analytics" no colisiona con
// "/:id/actions" (dos segmentos distintos bajo este mismo router), pero
// se registra primero de todos modos por legibilidad -- nunca se quiere
// que un id numérico futuro compita con esta ruta fija.
router.get("/analytics", trendController.analytics);

router.get("/:id/actions", controller.list);

router.post("/:id/actions", controller.create);

module.exports =
    router;
