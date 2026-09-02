const ProductService =
    require("../services/ProductService");

const productService =
    new ProductService();

/*
 * Entrega 2.7.0.9 -- página "Reporte consolidado". Carga liviana (solo
 * productos activos para el `<select>` de filtro), mismo criterio que
 * `PredictionAlertTrendController`/`OperationalActionAnalyticsController`
 * (2.7.0.7/2.7.0.8) -- toda la agregación real ocurre del lado del API.
 */
exports.index = async (req, res, next) => {

    try {

        const products =
            await productService.getActive();

        res.render("operationalReport/index", {

            title: "Reporte consolidado",

            page: "operational-report",

            products

        });

    } catch (err) {

        next(err);

    }

};
