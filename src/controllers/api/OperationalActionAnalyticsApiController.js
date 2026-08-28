const OperationalActionAnalyticsService =
    require("../../services/OperationalActionAnalyticsService");

const service =
    new OperationalActionAnalyticsService();

/*
 * Entrega 2.7.0.7, Acción 9 -- "GET /api/operational-actions/analytics",
 * namespace literal propuesto por el spec. Mismo patrón try/catch ->
 * res.json({success,data}) / res.status(400).json({success:false,message})
 * que el resto de controllers de este módulo.
 */

// GET /api/operational-actions/analytics
exports.analytics = async (req, res) => {

    try {

        const data =
            await service.getAnalytics({

                from: req.query.from,

                to: req.query.to,

                actionType: req.query.actionType,

                effectivenessStatus: req.query.effectivenessStatus,

                alertSeverity: req.query.alertSeverity,

                productId: req.query.productId

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
