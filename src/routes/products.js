const express = require("express");

const router = express.Router();

const controller =
    require("../controllers/ProductController");

router.get("/", controller.index);

module.exports = router;