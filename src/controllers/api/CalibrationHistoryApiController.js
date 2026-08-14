const CalibrationHistoryService =
    require("../../services/CalibrationHistoryService");

const service =
    new CalibrationHistoryService();

/*
 * Entrega 2.6.1.31, sección 13 -- GET /api/maturation/calibrations/history.
 * Mismo patrón try/catch -> res.json({success,data}) de siempre en este
 * módulo. Filtros todos opcionales, todos `undefined` si se omiten
 * (nunca cadenas vacías -- ver CalibrationHistoryService.getHistory()).
 */

// GET /api/maturation/calibrations/history
exports.history = async (req, res) => {

    try {

        const history =
            await service.getHistory({

                modelType: req.query.modelType || undefined,

                recipeVersionId: req.query.recipeVersionId || undefined,

                dateFrom: req.query.dateFrom || undefined,

                dateTo: req.query.dateTo || undefined

            });

        res.json({

            success: true,

            data: history

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
