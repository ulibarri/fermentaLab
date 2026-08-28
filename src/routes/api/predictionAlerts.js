const express =
    require("express");

const controller =
    require("../../controllers/api/ProductionAlertActionApiController");

const router =
    express.Router();

// Entrega 2.7.0.5, sección 13 -- router propio "/api/prediction-alerts",
// namespace literal del spec, distinto de "/api/batches/:id/
// prediction-alerts" (2.7.0.3, por-lote) porque estas rutas son
// por-ALERTA.

router.get("/:id/actions", controller.list);

router.post("/:id/actions", controller.create);

module.exports =
    router;
