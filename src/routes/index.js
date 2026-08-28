const express = require("express");

const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const productRoutes = require("./products");
const batchRoutes = require("./batches");
const maturationRoutes = require("./maturation");
const fermentationRoutes = require("./fermentations");
const operationalActionRoutes = require("./operationalActions");

// Dashboard
router.get("/", dashboardController.index);

// Productos
router.use("/products", productRoutes);

// Lotes
router.use("/batches", batchRoutes);

// Maduración
router.use("/maturation", maturationRoutes);

// Entrega 2.7.0.4 -- panel operativo de monitoreo de fermentaciones.
router.use("/fermentations", fermentationRoutes);

// Entrega 2.7.0.7 -- desglose/análisis histórico de acciones operativas.
router.use("/operational-actions", operationalActionRoutes);

module.exports = router;