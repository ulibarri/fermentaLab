const express = require("express");

const router = express.Router();

const controller =
    require("../controllers/BatchController");

router.get("/", controller.index);

router.get("/:id/measurements", controller.measurements);

module.exports = router;
