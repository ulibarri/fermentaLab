const express =
    require("express");

const controller =
    require("../../controllers/api/UnitApiController");

const router =
    express.Router();

router.get(

    "/",

    controller.index

);

module.exports =
    router;