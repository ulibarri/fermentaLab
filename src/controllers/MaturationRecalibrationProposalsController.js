const ProductService =
    require("../services/ProductService");

const productService =
    new ProductService();

/*
 * Entrega 2.6.1.24 -- controlador de página "Propuestas de
 * recalibración". Solo carga el catálogo de Producto para el filtro
 * inicial (sección 3) -- "Modelo" es un catálogo cerrado de dos
 * valores (LINEAR/EXPONENTIAL, ver MaturationModelTypes) que se puede
 * renderizar directo en la vista sin consultar nada, y "Estado" es
 * igual de fijo (PROPOSED/APPROVED/REJECTED). El resto (tabla, detalle,
 * comparación, aprobar/rechazar) se resuelve en el cliente vía la API.
 */
exports.index = async (req, res, next) => {

    try {

        const products =
            await productService.getActive();

        res.render("maturation/recalibrationProposals", {

            title: "Propuestas de recalibración",

            page: "maturation",

            products

        });

    } catch (err) {

        next(err);

    }

};
