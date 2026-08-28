const ProductionAlertActionService =
    require("../../services/ProductionAlertActionService");

const service =
    new ProductionAlertActionService();

/*
 * Entrega 2.7.0.5, sección 13 -- namespace literal pedido por el spec:
 * "/api/prediction-alerts/:id/actions" (distinto de "/api/batches/:id/
 * prediction-alerts", 2.7.0.3 -- ese es por-lote, este es por-alerta).
 * Mismo patrón try/catch -> res.json({success,data}) /
 * res.status(400).json({success:false,message}) que el resto de
 * controllers de este módulo.
 */

// GET /api/prediction-alerts/:id/actions
exports.list = async (req, res) => {

    try {

        const history =
            await service.getHistory(req.params.id);

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

// POST /api/prediction-alerts/:id/actions
exports.create = async (req, res) => {

    try {

        const created =
            await service.createAction(req.params.id, {

                type: req.body.type,

                description: req.body.description,

                expectedResult: req.body.expectedResult,

                notes: req.body.notes,

                createdBy: req.body.createdBy

            });

        res.status(201).json({

            success: true,

            data: created

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
