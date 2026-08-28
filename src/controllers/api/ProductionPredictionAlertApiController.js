const ProductionPredictionAlertService =
    require("../../services/ProductionPredictionAlertService");

const service =
    new ProductionPredictionAlertService();

/*
 * Entrega 2.7.0.3, sección 13 -- "no recomiendo permitir que el
 * frontend cree directamente estas alertas. El backend debe determinar
 * cuándo existe una desviación." Por eso este controlador es
 * exclusivamente de LECTURA -- ningún endpoint aquí crea, actualiza o
 * resuelve una alerta; eso solo ocurre desde
 * ProductionPredictionAlertService.evaluateForBatch(), disparado por el
 * flujo de mediciones (ProductionMeasurementService.createForBatch()).
 */

/*
 * GET /api/batches/:id/prediction-alerts -- historial completo
 * (activas y resueltas, sección 12).
 */
exports.history = async (req, res) => {

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

/*
 * GET /api/batches/:id/prediction-alerts/active -- solo la alerta
 * ACTIVE del lote, si existe (sección 13).
 */
exports.active = async (req, res) => {

    try {

        const active =
            await service.getActive(req.params.id);

        res.json({

            success: true,

            data: active

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
