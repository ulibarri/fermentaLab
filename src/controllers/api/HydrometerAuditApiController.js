const HydrometerAuditService =
    require("../../services/HydrometerAuditService");

const service =
    new HydrometerAuditService();

// Entrega 2.8.0.4, sección 7 -- GET /api/batches/:id/hydrometer/audit.
// Este controller nunca contiene lógica de negocio (mismo criterio
// que el resto del proyecto, ver cabecera de
// HydrometerConversionTableApiController.js) -- toda la comparación
// vive en HydrometerAuditService/utils/HydrometerAudit.js.
exports.auditForBatch = async (req, res) => {

    try {

        const audit =
            await service.getAuditForBatch(req.params.id);

        res.json({
            success: true,
            data: audit
        });

    } catch (err) {

        res.status(400).json({
            success: false,
            message: err.message
        });

    }

};

// Entrega 2.8.0.5, sección 10 -- GET /api/hydrometer/audit (a nivel
// raíz, no anidado bajo un lote -- distinto de auditForBatch() de
// arriba). Todos los filtros llegan como query params opcionales.
exports.historicalAnalysis = async (req, res) => {

    try {

        const analysis =
            await service.getHistoricalAnalysis({

                phase: req.query.phase,

                batchId: req.query.batchId,

                tableId: req.query.tableId,

                tableVersion: req.query.tableVersion,

                from: req.query.from,

                to: req.query.to

            });

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
