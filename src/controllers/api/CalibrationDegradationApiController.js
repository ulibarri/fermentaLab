const CalibrationDegradationService =
    require("../../services/CalibrationDegradationService");

const service =
    new CalibrationDegradationService();

/*
 * Entrega 2.6.1.28 -- detección automática de degradación de
 * calibraciones activas (sección 14, 3 endpoints). Mismo patrón
 * try/catch -> res.json({success,data}) / res.status(400).json({
 * success:false, message}) que el resto de controllers de este
 * módulo.
 */

// GET /api/maturation/calibrations/:id/degradation -- EN VIVO, corre
// la detección (y persiste/dedup/auto-resuelve según corresponda, ver
// CalibrationDegradationService.getStatus()).
exports.status = async (req, res) => {

    try {

        const status =
            await service.getStatus(req.params.id, {

                thresholdPercentage: req.query.thresholdPercentage !== undefined && req.query.thresholdPercentage !== ""
                    ? Number(req.query.thresholdPercentage)
                    : undefined

            });

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

// POST /api/maturation/degradation-events/:id/acknowledge
exports.acknowledge = async (req, res) => {

    try {

        const event =
            await service.acknowledge(req.params.id);

        res.json({

            success: true,

            data: event

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

// POST /api/maturation/degradation-events/:id/resolve
exports.resolve = async (req, res) => {

    try {

        const event =
            await service.resolve(req.params.id);

        res.json({

            success: true,

            data: event

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

/*
 * Entrega 2.6.1.29, sección 12 -- genera una propuesta de recalibración
 * a partir de esta alerta de degradación. Ruta pedida literalmente por
 * el spec bajo su propio namespace "degradation-alerts" (ver el
 * comentario de la ruta en src/routes/api/maturation.js).
 */
// POST /api/maturation/degradation-alerts/:id/proposal
exports.generateProposal = async (req, res) => {

    try {

        const result =
            await service.generateProposal(req.params.id, {

                userId: req.body ? req.body.userId : undefined

            });

        res.json({

            success: true,

            data: result

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
