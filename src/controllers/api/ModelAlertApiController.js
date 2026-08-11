const ModelAlertService =
    require("../../services/ModelAlertService");

const service =
    new ModelAlertService();

/*
 * Entrega 2.6.1.21 -- alertas y recomendaciones de recalibración
 * (sección 12, 4 endpoints). Mismo patrón try/catch -> res.json({
 * success, data }) / res.status(400).json({success:false, message})
 * que el resto de controllers de este módulo.
 */

// GET /api/maturation/models/:modelId/alerts
exports.list = async (req, res) => {

    try {

        const alerts =
            await service.getAlerts(req.params.modelId);

        res.json({

            success: true,

            data: alerts

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.22 -- centro de alertas (sección 10/11, 3 endpoints
 * nuevos). Mismo patrón try/catch de siempre.
 */

// GET /api/maturation/alerts
exports.globalList = async (req, res) => {

    try {

        const alerts =
            await service.listAlerts({

                productId: req.query.productId || null,

                recipeVersionId: req.query.recipeVersionId || null,

                modelId: req.query.modelId || null,

                severity: req.query.severity || null,

                status: req.query.status || null,

                from: req.query.from || null,

                to: req.query.to || null

            });

        res.json({

            success: true,

            data: alerts

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// GET /api/maturation/alerts/summary
exports.summary = async (req, res) => {

    try {

        const summary =
            await service.getSummary({

                productId: req.query.productId || null,

                recipeVersionId: req.query.recipeVersionId || null,

                modelId: req.query.modelId || null,

                from: req.query.from || null,

                to: req.query.to || null

            });

        res.json({

            success: true,

            data: summary

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// GET /api/maturation/alerts/:id
exports.detail = async (req, res) => {

    try {

        const alert =
            await service.getAlertDetail(req.params.id);

        res.json({

            success: true,

            data: alert

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// POST /api/maturation/alerts/:id/acknowledge
exports.acknowledge = async (req, res) => {

    try {

        const alert =
            await service.acknowledge(req.params.id, {

                userId: req.body ? req.body.userId : undefined

            });

        res.json({

            success: true,

            data: alert

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// POST /api/maturation/alerts/:id/resolve
exports.resolve = async (req, res) => {

    try {

        const alert =
            await service.resolve(req.params.id, {

                userId: req.body ? req.body.userId : undefined

            });

        res.json({

            success: true,

            data: alert

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.23, sección 7 -- POST /api/maturation/models/:modelId/
 * recalibration-proposal se mantiene, pero ahora puede responder 409
 * cuando ya existe una propuesta PROPOSED equivalente (sección 4/14) --
 * `ModelAlertService.createRecalibrationProposal()` marca ese caso con
 * `err.statusCode = 409` y `err.existingProposal`, este controller es
 * el único lugar que traduce eso a HTTP.
 */
exports.recalibrationProposal = async (req, res) => {

    try {

        const calibration =
            await service.createRecalibrationProposal(req.params.modelId, {

                reason: req.body ? req.body.reason : undefined,

                userId: req.body ? req.body.userId : undefined

            });

        res.status(201).json({

            success: true,

            data: calibration

        });

    } catch (err) {

        if (err.statusCode === 409) {

            return res.status(409).json({

                success: false,

                message: err.message,

                existingProposal: err.existingProposal || null

            });

        }

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
