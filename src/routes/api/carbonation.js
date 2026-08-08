const express =
    require("express");

const controller =
    require("../../controllers/api/CarbonationApiController");

const router =
    express.Router();

router.post("/estimate", controller.estimate);

module.exports =
    router;
