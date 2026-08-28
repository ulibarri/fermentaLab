const ProductService =
    require("../services/ProductService");

const ProductionAlertActionCatalog =
    require("../utils/ProductionAlertActionCatalog");

const productService =
    new ProductService();

/*
 * Entrega 2.7.0.7, Acción 11 -- controlador de página "Análisis de
 * acciones". Mismo patrón que FermentationDashboardController (2.7.0.4)
 * y RecalibrationEffectivenessSummaryController-equivalente (2.6.1.33):
 * solo carga el catálogo necesario para poblar los <select> de filtro
 * (tipo de acción, producto) -- el resto (resumen, tabla por tipo, tabla
 * por severidad) se resuelve en el cliente contra
 * GET /api/operational-actions/analytics.
 */
exports.index = async (req, res, next) => {

    try {

        const products =
            await productService.getActive();

        res.render("operationalActions/analytics", {

            title: "Análisis de acciones operativas",

            page: "operational-actions-analytics",

            products,

            actionTypes: ProductionAlertActionCatalog.ACTION_TYPES

        });

    } catch (err) {

        next(err);

    }

};
