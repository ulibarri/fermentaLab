const express = require("express");

const router = express.Router();

const controller = require("../../controllers/api/ProductApiController");
// const controller = require("../../controllers");

router.get("/", controller.index);

router.get("/:id", controller.show);
router.post("/", controller.store);
router.put("/:id", controller.update);
router.delete("/:id", controller.delete);
module.exports = router;