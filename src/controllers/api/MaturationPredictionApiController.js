const MaturationPredictionService =
    require("../../services/MaturationPredictionService");

const service =
    new MaturationPredictionService();

const BatchOperationalPredictionService =
    require("../../services/BatchOperationalPredictionService");

const operationalService =
    new BatchOperationalPredictionService();

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

/*
 * Entrega 2.7.0.2, sección 11 -- endpoints propuestos literalmente por
 * el spec, bajo el namespace "/api/batches/:id/..." (distinto del
 * "/api/maturation/..." que usa el resto de este controlador desde
 * 2.6.1.12 -- se mantiene el nombre exacto que pide esta entrega en vez
 * de forzar todo bajo un único prefijo). Reutilizan getHistory()/el
 * nuevo getCurrent() del servicio tal cual -- no se reimplementa nada,
 * solo se exponen bajo la ruta que pide esta sección.
 *
 * "predictions": historial completo del lote (mismos datos que
 * `history`, arriba, solo que bajo el path nuevo).
 */
exports.predictionsForBatch = async (req, res) => {

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
 * "predictions/current": predicción vigente del lote, aislada del
 * resto del historial (sección 4/11).
 */
exports.currentPredictionForBatch = async (req, res) => {

    try {

        const current =
            await service.getCurrent(req.params.id);

        res.json({

            success: true,

            data: current

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.7.0.1, secciones 1-6: estado operativo en vivo de un lote
 * (rango de confianza / cerca del límite / fuera de predicción, más
 * alerta de deriva). Ruta: GET
 * /api/maturation/batches/:batchId/operational-status.
 */
exports.operationalStatus = async (req, res) => {

    try {

        const status =
            await operationalService.getStatus(req.params.batchId);

        res.json({

            success: true,

            data: status

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
