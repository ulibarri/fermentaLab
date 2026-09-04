const express =
    require("express");

const multer =
    require("multer");

const controller =
    require("../../controllers/api/HydrometerConversionApiController");

const tablesController =
    require("../../controllers/api/HydrometerConversionTableApiController");

const auditController =
    require("../../controllers/api/HydrometerAuditApiController");

const router =
    express.Router();

// Entrega 2.8.0.2, sección 16 -- `multer` ya estaba declarado como
// dependencia del proyecto (package.json) pero sin ningún uso hasta
// esta entrega (no había precedente de subida de archivos en todo el
// código). `memoryStorage()` porque el CSV se parsea en memoria
// (`HydrometerCsvParser`) y nunca se persiste el archivo en disco --
// solo sus filas, ya validadas, terminan en base de datos.
const upload =
    multer({ storage: multer.memoryStorage() });

router.post("/convert", controller.convert);

// Entrega 2.8.0.2, sección 15 -- administración de la tabla de
// conversión del fabricante.
router.get("/tables", tablesController.list);

router.get("/tables/:id", tablesController.getById);

router.post("/tables", tablesController.create);

router.post("/tables/import", upload.single("file"), tablesController.importCsv);

router.post("/tables/:id/validate", tablesController.validate);

router.post("/tables/:id/activate", tablesController.activate);

router.post("/tables/:id/simulate", tablesController.simulate);

// Entrega 2.8.0.5, sección 10 -- análisis histórico cross-batch (Brix
// derivado vs. BrixMate real). "/audit" no colisiona con ninguna ruta
// existente en este archivo ("/convert", "/tables*").
router.get("/audit", auditController.historicalAnalysis);

module.exports =
    router;
