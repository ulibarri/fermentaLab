const RecipeVersionService =
    require("../services/RecipeVersionService");

const ProductService =
    require("../services/ProductService");

const recipeVersionService =
    new RecipeVersionService();

const productService =
    new ProductService();

/*
 * Entrega 2.6.1.22 -- controlador de página del centro de alertas.
 * Mismo patrón que MaturationDashboardController/
 * MaturationStatisticsController: solo carga los catálogos para los
 * selectores de filtro iniciales (Producto, Receta) -- el resto
 * (resumen, tabla, filtro de Modelo derivado de los propios resultados,
 * detalle) se resuelve en el cliente vía la API.
 */
exports.index = async (req, res, next) => {

    try {

        const [recipeVersions, products] = await Promise.all([

            recipeVersionService.getAll(),

            productService.getActive()

        ]);

        res.render("maturation/alertCenter", {

            title: "Centro de alertas",

            page: "maturation",

            recipeVersions,

            products

        });

    } catch (err) {

        next(err);

    }

};
