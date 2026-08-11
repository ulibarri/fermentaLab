const RecipeVersionService =
    require("../services/RecipeVersionService");

const recipeVersionService =
    new RecipeVersionService();

exports.index = async (req, res, next) => {

    try {

        const recipeVersions =
            await recipeVersionService.getAll();

        res.render("maturation/calibrations", {

            title: "Calibraciones de modelos de maduración",

            page: "maturation",

            recipeVersions

        });

    } catch (err) {

        next(err);

    }

};
