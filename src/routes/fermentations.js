const express =
    require("express");

const router =
    express.Router();

const controller =
    require("../controllers/FermentationDashboardController");

// Entrega 2.7.0.4, sección 1 -- panel operativo de monitoreo,
// conceptualmente "/fermentations" tal como lo nombra el spec. Router
// propio (no bajo "/batches" ni "/maturation") porque no es un recurso
// por-lote ni por-modelo: es la vista agregada de todos los lotes
// activos a la vez.
router.get("/", controller.index);

module.exports =
    router;
