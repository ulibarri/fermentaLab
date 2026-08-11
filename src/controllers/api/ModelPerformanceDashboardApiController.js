const ModelPerformanceDashboardService =
    require("../../services/ModelPerformanceDashboardService");

const service =
    new ModelPerformanceDashboardService();

/*
 * Entrega 2.6.1.20 -- dashboard de desempeño del modelo (sección 10).
 * Mismo patrón try/catch -> res.json({success,data}) /
 * res.status(400).json({success:false,message}) que el resto de
 * controllers de este módulo.
 */

// GET /api/maturation/models/:modelId/dashboard
exports.dashboard = async (req, res) => {

    try {

        const dashboard =
            await service.getDashboard(req.params.modelId, {

                period: req.query.period || undefined,

                calibrationId: req.query.calibrationId || undefined

            });

        res.json({

            success: true,

            data: dashboard

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
