const ProductService = require("../../services/ProductService");

const service = new ProductService();

exports.index = async (req, res, next) => {

    try {

        const products = await service.getActive();
        res.json({

            success: true,

            data: products

        });

    } catch (err) {

        next(err);

    }

};

exports.show = async (req, res, next) => {

    console.log("ID recibido:", req.params.id);

    try {

        const product = await service.get(req.params.id);

        console.log("Producto encontrado:", product);

        if (!product) {

            return res.status(404).json({
                success: false,
                message: "Producto no encontrado."
            });

        }

        res.json({
            success: true,
            data: product
        });

    } catch (err) {
        next(err);
    }

};
exports.store = async (req, res, next) => {

    console.log("BODY:", req.body);

    try {

        const product = await service.create(req.body);

        res.status(201).json({
            success: true,
            message: "Producto creado correctamente.",
            data: product
        });

    } catch (err) {

        console.error(err);

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};
exports.update = async (req, res) => {

    try {

        const product = await service.update(

            req.params.id,

            req.body

        );

        res.json({

            success: true,

            message: "Producto actualizado correctamente.",

            data: product

        });

    }

    catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
exports.delete = async (req, res) => {

    try {

        const product = await service.delete(req.params.id);

        res.json({

            success: true,

            message: "Producto desactivado correctamente.",

            data: product

        });

    }

    catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};