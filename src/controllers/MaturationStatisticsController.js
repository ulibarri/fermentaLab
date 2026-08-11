const ProductService =
    require("../services/ProductService");

const productService =
    new ProductService();

exports.index = async (req, res, next) => {

    try {

        const products =
            await productService.getActive();

        res.render("maturation/statistics", {

            title: "Precisión histórica de maduración",

            page: "maturation",

            products

        });

    } catch (err) {

        next(err);

    }

};
