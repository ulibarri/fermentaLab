const RecalibrationProposalService =
    require("../../services/RecalibrationProposalService");

const service =
    new RecalibrationProposalService();

/*
 * Entrega 2.6.1.24, sección 11 -- 4 endpoints bajo
 * /api/maturation/recalibration-proposals. Mismo patrón try/catch ->
 * res.json({success,data}) / res.status(400).json({success:false,
 * message}) que el resto de controllers de este módulo.
 */

// GET /api/maturation/recalibration-proposals
exports.list = async (req, res) => {

    try {

        const proposals =
            await service.list({

                modelType: req.query.modelType || null,

                productId: req.query.productId || null,

                status: req.query.status || null,

                createdBy: req.query.createdBy || null,

                from: req.query.from || null,

                to: req.query.to || null

            });

        res.json({

            success: true,

            data: proposals

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// GET /api/maturation/recalibration-proposals/:id
exports.detail = async (req, res) => {

    try {

        const proposal =
            await service.getDetail(req.params.id);

        res.json({

            success: true,

            data: proposal

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// POST /api/maturation/recalibration-proposals/:id/approve
exports.approve = async (req, res) => {

    try {

        const proposal =
            await service.approve(req.params.id, {

                userId: req.body ? req.body.userId : undefined

            });

        res.json({

            success: true,

            data: proposal

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.25, secciones 10/11 -- endpoint propio para activar una
 * propuesta APPROVED, deliberadamente en el namespace de propuestas
 * (nunca en el genérico /api/maturation/calibrations/:id/activate, que
 * sigue existiendo sin cambios desde 2.6.1.16 para
 * /maturation/calibrations). Ver el comentario de la ruta en
 * src/routes/api/maturation.js para el detalle de esta decisión.
 */
// POST /api/maturation/recalibration-proposals/:id/activate
exports.activate = async (req, res) => {

    try {

        const proposal =
            await service.activate(req.params.id, {

                userId: req.body ? req.body.userId : undefined

            });

        res.json({

            success: true,

            data: proposal

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.30, sección 17 -- evaluar y priorizar una propuesta.
 */
// POST /api/maturation/recalibration-proposals/:id/evaluate
exports.evaluate = async (req, res) => {

    try {

        const evaluation =
            await service.evaluate(req.params.id);

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

// GET /api/maturation/recalibration-proposals/:id/evaluations
exports.evaluationHistory = async (req, res) => {

    try {

        const history =
            await service.getEvaluationHistory(req.params.id);

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

// POST /api/maturation/recalibration-proposals/:id/reject
exports.reject = async (req, res) => {

    try {

        if (!req.body) {

            throw new Error(

                "No se recibieron datos. Verifica el body y el header Content-Type: application/json."

            );

        }

        const proposal =
            await service.reject(req.params.id, {

                userId: req.body.userId,

                reason: req.body.reason

            });

        res.json({

            success: true,

            data: proposal

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
