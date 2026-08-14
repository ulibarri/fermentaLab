const MaturationModelCalibrationService =
    require("../../services/MaturationModelCalibrationService");

const CalibrationEffectivenessService =
    require("../../services/CalibrationEffectivenessService");

const service =
    new MaturationModelCalibrationService();

const effectivenessService =
    new CalibrationEffectivenessService();

const RecalibrationEffectivenessService =
    require("../../services/RecalibrationEffectivenessService");

const recalibrationEffectivenessService =
    new RecalibrationEffectivenessService();

const parseOptionalId = (req, key) =>

    req.query[key] !== undefined && req.query[key] !== ""
        ? Number(req.query[key])
        : null;

/*
 * Entrega 2.6.1.16 -- 7 endpoints REST bajo /api/maturation/calibrations
 * (sección 12 de la especificación). Mismo patrón try/catch ->
 * res.json({success,data}) / res.status(400).json({success:false,
 * message}) que el resto de controllers de este módulo -- todo error de
 * validación de estado (ver MaturationModelCalibrationService) llega
 * aquí como un Error normal, nunca un código HTTP distinto por tipo de
 * validación.
 */

// GET /api/maturation/calibrations
exports.list = async (req, res) => {

    try {

        const calibrations =
            await service.list({

                modelType: req.query.modelType || null,

                recipeVersionId: parseOptionalId(req, "recipeVersionId"),

                status: req.query.status || null

            });

        res.json({

            success: true,

            data: calibrations

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// POST /api/maturation/calibrations
exports.create = async (req, res) => {

    try {

        if (!req.body) {

            throw new Error(

                "No se recibieron datos. Verifica el body y el header Content-Type: application/json."

            );

        }

        const calibration =
            await service.createProposal({

                modelType: req.body.modelType,

                recipeVersionId: req.body.recipeVersionId,

                offsetHours: req.body.offsetHours,

                sampleSize: req.body.sampleSize,

                biasHours: req.body.biasHours,

                reason: req.body.reason,

                createdBy: req.body.createdBy

            });

        res.status(201).json({

            success: true,

            data: calibration

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// GET /api/maturation/calibrations/:id
exports.detail = async (req, res) => {

    try {

        const calibration =
            await service.getById(req.params.id);

        res.json({

            success: true,

            data: calibration

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// PUT /api/maturation/calibrations/:id
exports.update = async (req, res) => {

    try {

        if (!req.body) {

            throw new Error(

                "No se recibieron datos. Verifica el body y el header Content-Type: application/json."

            );

        }

        const calibration =
            await service.update(req.params.id, {

                offsetHours: req.body.offsetHours,

                reason: req.body.reason

            });

        res.json({

            success: true,

            data: calibration

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// POST /api/maturation/calibrations/:id/approve
exports.approve = async (req, res) => {

    try {

        const calibration =
            await service.approve(req.params.id);

        res.json({

            success: true,

            data: calibration

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// POST /api/maturation/calibrations/:id/activate
exports.activate = async (req, res) => {

    try {

        const calibration =
            await service.activate(req.params.id);

        res.json({

            success: true,

            data: calibration

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// POST /api/maturation/calibrations/:id/deactivate
exports.deactivate = async (req, res) => {

    try {

        const calibration =
            await service.deactivate(req.params.id);

        res.json({

            success: true,

            data: calibration

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// POST /api/maturation/calibrations/:id/reject
exports.reject = async (req, res) => {

    try {

        const calibration =
            await service.reject(req.params.id);

        res.json({

            success: true,

            data: calibration

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.17 -- evaluación de efectividad (sección 15, 3
 * endpoints). Mismo patrón try/catch de siempre.
 */

// GET /api/maturation/calibrations/:id/evaluation -- EN VIVO, nunca persiste
exports.evaluation = async (req, res) => {

    try {

        const evaluation =
            await effectivenessService.evaluate(req.params.id);

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

// GET /api/maturation/calibrations/:id/evaluations -- historial persistido
exports.evaluations = async (req, res) => {

    try {

        const history =
            await effectivenessService.getHistory(req.params.id);

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

// POST /api/maturation/calibrations/:id/evaluate -- calcula Y guarda
exports.evaluate = async (req, res) => {

    try {

        const evaluation =
            await effectivenessService.evaluateAndStore(req.params.id);

        res.status(201).json({

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
 * Entrega 2.6.1.18 -- monitoreo continuo (sección 16, 2 endpoints).
 * IMPORTANTE: "/calibrations/health" (ruta literal, todas las
 * calibraciones ACTIVE) debe registrarse ANTES que
 * "/calibrations/:id" en el router, o Express interpretaría "health"
 * como si fuera un :id -- ver src/routes/api/maturation.js.
 */

// GET /api/maturation/calibrations/:id/health
exports.health = async (req, res) => {

    try {

        const health =
            await effectivenessService.getHealth(req.params.id);

        res.json({

            success: true,

            data: health

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// GET /api/maturation/calibrations/health -- todas las ACTIVE
exports.healthAll = async (req, res) => {

    try {

        const health =
            await effectivenessService.getAllActiveHealth();

        res.json({

            success: true,

            data: health

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.27 -- evaluación post-activación (secciones 1-9).
 * EN VIVO, nunca persiste nada -- mismo patrón que health()/evaluation()
 * de arriba.
 */

// GET /api/maturation/calibrations/:id/post-activation-evaluation
exports.postActivationEvaluation = async (req, res) => {

    try {

        const evaluation =
            await effectivenessService.getPostActivationEvaluation(req.params.id);

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
 * Entrega 2.6.1.19 -- versionado y reemplazo controlado (sección 13,
 * 3 endpoints). Mismo patrón try/catch de siempre.
 */

// GET /api/maturation/calibrations/:id/versions
exports.versions = async (req, res) => {

    try {

        const versions =
            await service.getVersionChain(req.params.id);

        res.json({

            success: true,

            data: versions

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// GET /api/maturation/calibrations/:id/comparison/:otherId
exports.comparison = async (req, res) => {

    try {

        const comparison =
            await effectivenessService.compare(req.params.id, req.params.otherId);

        res.json({

            success: true,

            data: comparison

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.32 -- efectividad real de las recalibraciones (secciones
 * 1-10, 3 endpoints). Mismo patrón try/catch de siempre.
 */

// GET /api/maturation/calibrations/:id/effectiveness -- EN VIVO, nunca persiste
exports.effectiveness = async (req, res) => {

    try {

        const evaluation =
            await recalibrationEffectivenessService.evaluate(req.params.id);

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

// POST /api/maturation/calibrations/:id/effectiveness/evaluate -- calcula Y guarda
exports.evaluateEffectiveness = async (req, res) => {

    try {

        const evaluation =
            await recalibrationEffectivenessService.evaluateAndStore(req.params.id);

        res.status(201).json({

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

// GET /api/maturation/calibrations/:id/effectiveness/history -- historial persistido
exports.effectivenessHistory = async (req, res) => {

    try {

        const history =
            await recalibrationEffectivenessService.getHistory(req.params.id);

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

// POST /api/maturation/calibrations/:id/create-replacement
exports.createReplacement = async (req, res) => {

    try {

        if (!req.body) {

            throw new Error(

                "No se recibieron datos. Verifica el body y el header Content-Type: application/json."

            );

        }

        const calibration =
            await service.createReplacement(req.params.id, {

                offsetHours: req.body.offsetHours,

                sampleSize: req.body.sampleSize,

                biasHours: req.body.biasHours,

                reason: req.body.reason,

                createdBy: req.body.createdBy

            });

        res.status(201).json({

            success: true,

            data: calibration

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
