const HydrometerConversionTableService =
    require("../../services/HydrometerConversionTableService");

const { parseHydrometerCsv } =
    require("../../utils/HydrometerCsvParser");

const service =
    new HydrometerConversionTableService();

/*
 * Entrega 2.8.0.2, sección 15 -- API de administración de la tabla de
 * conversión del fabricante:
 *   GET  /api/hydrometer/tables
 *   GET  /api/hydrometer/tables/:id
 *   POST /api/hydrometer/tables            (creación manual, body JSON)
 *   POST /api/hydrometer/tables/import      (creación desde CSV, sección 16)
 *   POST /api/hydrometer/tables/:id/validate
 *   POST /api/hydrometer/tables/:id/activate
 *   POST /api/hydrometer/tables/:id/simulate (sección 13 -- endpoint
 *     adicional no listado literalmente en la sección 15, pero
 *     necesario para cumplir el requisito explícito de esa sección:
 *     "simular con una tabla específica antes de activarla". Judgment
 *     call flagueado en el resumen de la entrega.)
 *
 * Este controller nunca contiene lógica de negocio -- todo vive en
 * `HydrometerConversionTableService` (ciclo de vida) y en
 * `HydrometerCsvParser`/`HydrometerTableValidation` (formato/contenido).
 */

exports.list = async (req, res) => {

    try {

        const { instrument, status } =
            req.query || {};

        const data =
            await service.list({ instrument, status });

        res.json({ success: true, data });

    } catch (err) {

        res.status(400).json({ success: false, message: err.message });

    }

};

exports.getById = async (req, res) => {

    try {

        const data =
            await service.getById(req.params.id);

        res.json({ success: true, data });

    } catch (err) {

        res.status(404).json({ success: false, message: err.message });

    }

};

/*
 * Creación manual (body JSON con `rows`: [{sg, brix, alcohol}, ...]).
 * Cubre tanto la primera versión de un instrumento como una nueva
 * versión explícita cuando el body incluye `parentTableId` (sección 11).
 */
exports.create = async (req, res) => {

    try {

        const body =
            req.body || {};

        const data =
            await service.create({

                name: body.name,

                manufacturer: body.manufacturer,

                instrument: body.instrument,

                source: body.source,

                rows: body.rows,

                createdBy: body.createdBy,

                parentTableId: body.parentTableId,

                changeReason: body.changeReason

            });

        res.status(201).json({ success: true, data });

    } catch (err) {

        res.status(400).json({ success: false, message: err.message });

    }

};

/*
 * Sección 16 -- creación desde un archivo CSV subido (multipart, ver
 * `routes/api/hydrometer.js`, `upload.single("file")`). Nunca activa
 * automáticamente (sección 16: "el sistema nunca debe activar la tabla
 * automáticamente después de importarla") -- solo crea la versión en
 * DRAFT, igual que `create()`. Flujo completo: IMPORTAR (este endpoint)
 * -> VALIDAR (`POST /:id/validate`) -> REVISAR (`GET /:id`) -> ACTIVAR
 * (`POST /:id/activate`).
 */
exports.importCsv = async (req, res) => {

    try {

        if (!req.file) {

            return res.status(400).json({

                success: false,

                message: "No se recibió ningún archivo. El campo del formulario debe llamarse \"file\"."

            });

        }

        const csvText =
            req.file.buffer.toString("utf8");

        const parsed =
            parseHydrometerCsv(csvText);

        if (parsed.errors.length > 0) {

            return res.status(400).json({

                success: false,

                message: "No se pudo leer el archivo CSV.",

                errors: parsed.errors

            });

        }

        const body =
            req.body || {};

        const data =
            await service.create({

                name: body.name || req.file.originalname,

                manufacturer: body.manufacturer,

                instrument: body.instrument,

                source: body.source || `Importado desde archivo "${req.file.originalname}".`,

                rows: parsed.rows,

                createdBy: body.createdBy,

                parentTableId: body.parentTableId,

                changeReason: body.changeReason

            });

        res.status(201).json({ success: true, data });

    } catch (err) {

        res.status(400).json({ success: false, message: err.message });

    }

};

exports.validate = async (req, res) => {

    try {

        const body =
            req.body || {};

        const data =
            await service.validate(req.params.id, { validatedBy: body.validatedBy });

        res.json({ success: true, data });

    } catch (err) {

        res.status(400).json({ success: false, message: err.message });

    }

};

exports.activate = async (req, res) => {

    try {

        const body =
            req.body || {};

        const data =
            await service.activate(req.params.id, { activatedBy: body.activatedBy });

        res.json({ success: true, data });

    } catch (err) {

        res.status(400).json({ success: false, message: err.message });

    }

};

exports.simulate = async (req, res) => {

    try {

        const body =
            req.body || {};

        const data =
            await service.simulate(req.params.id, {

                scale: body.scale,

                value: body.value

            });

        res.json({ success: true, data });

    } catch (err) {

        res.status(400).json({ success: false, message: err.message });

    }

};
