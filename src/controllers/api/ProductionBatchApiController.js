const ProductionBatchService =
    require("../../services/ProductionBatchService");
const service =
    new ProductionBatchService();

exports.index = async (req, res, next) => {

    try {

        const batches = await service.getAll();

        res.json({
            success: true,
            data: batches
        });

    } catch (err) {

        next(err);

    }

};

exports.show = async (req, res, next) => {

    try {

        const batch = await service.get(req.params.id);

        if (!batch) {

            return res.status(404).json({
                success: false,
                message: "Lote no encontrado."
            });

        }

        res.json({
            success: true,
            data: batch
        });

    } catch (err) {

        next(err);

    }

};

exports.store = async (req, res) => {

    try {

        const batch = await service.create(req.body);

        res.status(201).json({
            success: true,
            message: "Lote creado correctamente.",
            data: batch
        });

    } catch (err) {

        console.error(err);

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};

exports.start = async (req, res) => {

    try {

        const batch = await service.start(req.params.id);

        res.json({
            success: true,
            message: "Lote iniciado correctamente.",
            data: batch
        });

    } catch (err) {

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};

exports.complete = async (req, res) => {

    try {

        const batch = await service.complete(
            req.params.id,
            req.body
        );

        res.json({
            success: true,
            message: "Lote completado correctamente.",
            data: batch
        });

    } catch (err) {

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};

exports.cancel = async (req, res) => {

    try {

        const batch = await service.cancel(
            req.params.id,
            req.body ? req.body.reason : null
        );

        res.json({
            success: true,
            message: "Lote cancelado correctamente.",
            data: batch
        });

    } catch (err) {

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};
