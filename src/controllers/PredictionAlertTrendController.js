const ProductService =
    require("../services/ProductService");

const productService =
    new ProductService();

/*
 * Entrega 2.7.0.8, Acción 2 -- controlador de página "Tendencias de
 * alertas". Mismo patrón que OperationalActionAnalyticsController
 * (2.7.0.7) y FermentationDashboardController (2.7.0.4): solo carga el
 * catálogo necesario para poblar el <select> de filtro "Producto /
 * receta" -- el resto (resumen, evolución temporal, severidad,
 * duración, alertas más antiguas, por producto) se resuelve en el
 * cliente contra GET /api/prediction-alerts/analytics.
 */
exports.index = async (req, res, next) => {

    try {

        const products =
            await productService.getActive();

        res.render("predictionAlerts/trends", {

            title: "Tendencias de alertas",

            page: "prediction-alert-trends",

            products

        });

    } catch (err) {

        next(err);

    }

};
