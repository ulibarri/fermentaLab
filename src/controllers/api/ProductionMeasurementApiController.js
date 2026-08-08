const ProductionMeasurementService =
    require("../../services/ProductionMeasurementService");

const service =
    new ProductionMeasurementService();

exports.indexByBatch = async (req, res) => {

    try {

        const measurements =
            await service.findByBatch(req.params.id);

        res.json({
            success: true,
            data: measurements
        });

    } catch (err) {

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};

exports.storeForBatch = async (req, res) => {

    try {

        const measurement =
            await service.createForBatch(
                req.params.id,
                req.body
            );

        res.status(201).json({
            success: true,
            message: "Medición registrada correctamente.",
            data: measurement
        });

    } catch (err) {

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};

exports.maturation = async (req, res) => {

    try {

        const prediction =
            await service.getMaturationPrediction(req.params.id);

        res.json({
            success: true,
            data: prediction
        });

    } catch (err) {

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};

exports.update = async (req, res) => {

    try {

        const measurement =
            await service.update(
                req.params.id,
                req.body
            );

        res.json({
            success: true,
            message: "Medición actualizada correctamente.",
            data: measurement
        });

    } catch (err) {

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};

exports.delete = async (req, res) => {

    try {

        await service.delete(req.params.id);

        res.json({
            success: true,
            message: "Medición eliminada correctamente."
        });

    } catch (err) {

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};
