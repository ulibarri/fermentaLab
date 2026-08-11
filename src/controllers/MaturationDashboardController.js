const RecipeVersionService =
    require("../services/RecipeVersionService");

const recipeVersionService =
    new RecipeVersionService();

/*
 * Entrega 2.6.1.20 -- controlador de página del dashboard de
 * desempeño. Mismo patrón que MaturationCalibrationsController: solo
 * carga la lista de recetas/versiones para el selector inicial
 * (Producto -> Receta v.N, sección 1); la cascada hacia "Modelo de
 * maduración" y todo el contenido del dashboard se resuelven en el
 * cliente vía la API (GET /api/maturation/models/status y
 * GET /api/maturation/models/:modelId/dashboard).
 */
exports.index = async (req, res, next) => {

    try {

        const recipeVersions =
            await recipeVersionService.getAll();

        res.render("maturation/dashboard", {

            title: "Dashboard de desempeño del modelo",

            page: "maturation",

            recipeVersions

        });

    } catch (err) {

        next(err);

    }

};
