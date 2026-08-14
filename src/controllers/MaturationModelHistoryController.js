const RecipeVersionService =
    require("../services/RecipeVersionService");

const recipeVersionService =
    new RecipeVersionService();

/*
 * Entrega 2.6.1.31, sección 11 -- "Predicción -> Evolución del modelo".
 * Mismo patrón que MaturationCalibrationsController (2.6.1.16): solo
 * carga las recetas/versiones para poblar el filtro, el resto de los
 * datos los trae el propio JS de la página vía la API REST.
 */
exports.index = async (req, res, next) => {

    try {

        const recipeVersions =
            await recipeVersionService.getAll();

        res.render("maturation/modelHistory", {

            title: "Evolución del modelo de maduración",

            page: "maturation",

            recipeVersions

        });

    } catch (err) {

        next(err);

    }

};
