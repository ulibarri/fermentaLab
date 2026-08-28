const express =
    require("express");

const controller =
    require("../../controllers/api/OperationalActionAnalyticsApiController");

const router =
    express.Router();

// Entrega 2.7.0.7, Acción 9 -- router propio "/api/operational-actions",
// namespace literal del spec, distinto de "/api/prediction-alerts/:id/
// actions" (2.7.0.5, por-ALERTA) porque este endpoint es un análisis
// agregado a través de TODAS las acciones, nunca de una alerta concreta.
router.get("/analytics", controller.analytics);

module.exports =
    router;
