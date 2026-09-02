const OperationalReportService =
    require("../../services/OperationalReportService");

const service =
    new OperationalReportService();

/*
 * Entrega 2.7.0.9 -- GET /api/analytics/operational-report (sección 11).
 */
exports.report = async (req, res) => {

    try {

        const data =
            await service.getReport({

                from: req.query.from,

                to: req.query.to,

                productId: req.query.productId,

                recipeId: req.query.recipeId,

                modelId: req.query.modelId

            });

        res.json({ success: true, data });

    } catch (err) {

        res.status(400).json({ success: false, message: err.message });

    }

};
