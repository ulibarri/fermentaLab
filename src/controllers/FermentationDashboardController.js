const ProductService =
    require("../services/ProductService");

const productService =
    new ProductService();

/*
 * Entrega 2.7.0.4 -- controlador de página del panel operativo.
 * Mismo patrón que MaturationAlertCenterController (2.6.1.22): solo
 * carga el catálogo necesario para el selector de filtro "Producto/
 * receta" inicial (sección 7, "si la arquitectura actual ya permite
 * identificarlo fácilmente" -- Product ya lo permite, vía
 * ProductService.getActive()). El resto (resumen, tabla, filtros de
 * fase/estado/alertas, auto-refresh) se resuelve en el cliente contra
 * GET /api/fermentations/active.
 */
exports.index = async (req, res, next) => {

    try {

        const products =
            await productService.getActive();

        res.render("fermentations/index", {

            title: "Panel operativo de fermentaciones",

            page: "fermentations",

            products

        });

    } catch (err) {

        next(err);

    }

};
