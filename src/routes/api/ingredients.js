const express =
    require("express");

const controller =
    require("../../controllers/api/IngredientApiController");

const router =
    express.Router();

router.get(

    "/",

    controller.index

);

module.exports =
    router;