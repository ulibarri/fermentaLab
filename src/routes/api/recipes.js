const express =
    require("express");

const controller =
    require("../../controllers/api/RecipeApiController");

const router =
    express.Router();

router.get(

    "/",

    controller.index

);

module.exports =
    router;