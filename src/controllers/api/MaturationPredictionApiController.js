const MaturationPredictionService =
    require("../../services/MaturationPredictionService");

const service =
    new MaturationPredictionService();

/*
 * Historial de predicciones de un lote (sección 6 de la especificación
 * 2.6.1.12). Ruta: GET /api/maturation/predictions/batch/:batchId --
 * con el segmento "/batch/" para no colisionar con el detalle por id
 * de abajo (el propio texto de la especificación muestra ambas rutas
 * como "/predictions/:X" con distinto significado del parámetro, algo
 * ambiguo en Express si se toman literalmente igual; se documenta como
 * judgment call).
 */
exports.history = async (req, res) => {

    try {

        const history =
            await service.getHistory(req.params.batchId);

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
 * Detalle completo de una predicción (sección 7). Ruta: GET
 * /api/maturation/predictions/:id -- se mantiene literal a la
 * especificación.
 */
exports.detail = async (req, res) => {

    try {

        const detail =
            await service.getDetail(req.params.id);

        res.json({

            success: true,

            data: detail

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.13, sección 8: Comparación Predicción vs. Maduración
 * Real de UNA predicción. Ruta: GET
 * /api/maturation/predictions/:id/evaluation.
 */
exports.evaluation = async (req, res) => {

    try {

        const evaluation =
            await service.evaluatePredictionById(req.params.id);

        res.json({

            success: true,

            data: evaluation

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.13, sección 12: conjunto de predicciones de un lote
 * con su evaluación individual. Ruta: GET
 * /api/maturation/batches/:batchId/prediction-analysis.
 */
exports.batchAnalysis = async (req, res) => {

    try {

        const analysis =
            await service.getBatchPredictionAnalysis(req.params.batchId);

        res.json({

            success: true,

            data: analysis

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
