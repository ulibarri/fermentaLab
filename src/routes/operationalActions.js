const express =
    require("express");

const router =
    express.Router();

const controller =
    require("../controllers/OperationalActionAnalyticsController");

// Entrega 2.7.0.7, Acción 11 -- "Análisis de acciones", conceptualmente
// "/operational-actions/analytics". Router propio (no bajo "/batches" ni
// "/maturation"), mismo criterio que fermentations.js (2.7.0.4): no es
// un recurso por-lote ni por-modelo, es la vista agregada de TODAS las
// acciones operativas registradas.
router.get("/analytics", controller.index);

module.exports =
    router;
