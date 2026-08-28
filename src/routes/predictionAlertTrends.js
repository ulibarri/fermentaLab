const express =
    require("express");

const router =
    express.Router();

const controller =
    require("../controllers/PredictionAlertTrendController");

// Entrega 2.7.0.8, Acción 2 -- "Tendencias de alertas", conceptualmente
// "/prediction-alerts/trends". Router propio (mismo criterio que
// fermentations.js/operationalActions.js): no es un recurso por-lote ni
// por-alerta individual, es la vista agregada de TODO el historial de
// alertas.
router.get("/", controller.index);

module.exports =
    router;
