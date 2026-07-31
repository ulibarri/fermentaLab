const express = require("express");

const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const productRoutes = require("./products");

// Dashboard
router.get("/", dashboardController.index);

// Productos
router.use("/products", productRoutes);

module.exports = router;