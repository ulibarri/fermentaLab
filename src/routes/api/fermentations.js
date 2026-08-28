const express =
    require("express");

const controller =
    require("../../controllers/api/FermentationDashboardApiController");

const router =
    express.Router();

// Entrega 2.7.0.4, sección 13 -- panel operativo de monitoreo. Router
// propio ("/api/fermentations", nunca reutiliza "/api/batches" ni
// "/api/maturation") porque esto no es un recurso por-lote ni
// por-modelo -- es una vista agregada de TODOS los lotes activos a la
// vez, un namespace conceptualmente distinto (mismo criterio que
// "/api/maturation" ya es distinto de "/api/batches").
router.get("/active", controller.active);

module.exports =
    router;
