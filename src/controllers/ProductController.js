
const ProductService = require("../services/ProductService");

const service = new ProductService();

exports.index = async (req, res, next) => {

    try {

        const products = await service.getAll();

        // console.log(products);
        // console.log(products.length);

        res.render("products/index", {

            title: "Productos",

            page: "products",

            products

        });

    } catch (err) {

        next(err);

    }

};
