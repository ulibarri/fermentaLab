const PredictionAlertTrendService =
    require("../../services/PredictionAlertTrendService");

const service =
    new PredictionAlertTrendService();

/*
 * Entrega 2.7.0.8, Acción 15 -- "GET /api/prediction-alerts/analytics",
 * namespace literal propuesto por el spec, bajo el mismo router que las
 * rutas de acciones por alerta (2.7.0.5) -- ambas cuelgan de
 * "/api/prediction-alerts". Mismo patrón try/catch ->
 * res.json({success,data}) / res.status(400).json({success:false,message})
 * que el resto de controllers de este módulo.
 */

// GET /api/prediction-alerts/analytics
exports.analytics = async (req, res) => {

    try {

        const data =
            await service.getTrends({

                from: req.query.from,

                to: req.query.to,

                severity: req.query.severity,

                status: req.query.status,

                productId: req.query.productId,

                phase: req.query.phase,

                groupBy: req.query.groupBy

            });

        res.json({

            success: true,

            data

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
