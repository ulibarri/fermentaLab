const express = require("express");

const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const productRoutes = require("./products");
const batchRoutes = require("./batches");
const maturationRoutes = require("./maturation");

// Dashboard
router.get("/", dashboardController.index);

// Productos
router.use("/products", productRoutes);

// Lotes
router.use("/batches", batchRoutes);

// Maduración
router.use("/maturation", maturationRoutes);

module.exports = router;