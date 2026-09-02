const HydrometerConversionService =
    require("../../services/HydrometerConversionService");

const service =
    new HydrometerConversionService();

/*
 * Entrega 2.8.0.1, sección 14 -- POST /api/hydrometer/convert.
 */
exports.convert = async (req, res) => {

    try {

        const body =
            req.body || {};

        const data =
            await service.convert({

                scale: body.scale,

                value: body.value

            });

        res.json({ success: true, data });

    } catch (err) {

        res.status(400).json({ success: false, message: err.message });

    }

};
