const BaseService =
    require("./BaseService");

const HydrometerConversionTableRepository =
    require("../repositories/HydrometerConversionTableRepository");

const HydrometerTableAuditLogRepository =
    require("../repositories/HydrometerTableAuditLogRepository");

const { validateTable, toFiniteNumber } =
    require("../utils/HydrometerTableValidation");

const { convertUsingPoints } =
    require("../utils/HydrometerConverter");

/*
 * Entrega 2.8.0.2 -- ciclo de vida de `HydrometerConversionTable`
 * (secciones 1-4, 10-14, 16, 17). Calcado de
 * `MaturationModelCalibrationService` (2.6.1.16): DRAFT -> VALIDATED ->
 * ACTIVE -> INACTIVE, nunca se salta un estado, nunca hay más de una
 * fila ACTIVE por `instrument` a la vez (garantizado por la transacción
 * de `activate()`, no por una restricción de base de datos).
 *
 * Sección 6 -- "separar tabla y algoritmo": este servicio conoce el
 * CICLO DE VIDA de la tabla (crear, validar, activar), pero nunca
 * reimplementa la interpolación -- eso vive exclusivamente en
 * `HydrometerConverter` (`convertUsingPoints()`), a la que este
 * servicio solo le pasa las filas de una tabla concreta (usado por
 * `simulate()`, sección 13).
 */

// Sección 2/3 -- este proyecto no soporta todavía múltiples modelos de
// instrumento (nota de cierre del spec de esta entrega). Todas las
// tablas creadas sin `instrument` explícito comparten este alcance de
// versionado/activación único -- deja la puerta abierta a un futuro
// selector de instrumento sin otra migración.
const DEFAULT_INSTRUMENT = "HYDROMETER_SG_BRIX_ALCOHOL";

class HydrometerConversionTableService
    extends BaseService {

    constructor() {

        super(

            new HydrometerConversionTableRepository()

        );

        this.auditLogRepository =
            new HydrometerTableAuditLogRepository();

    }

    async _requireExisting(id) {

        const record =
            await this.repository.findById(id);

        if (!record) {

            throw new Error("Tabla de conversión no encontrada.");

        }

        return record;

    }

    /*
     * Sección 16 -- valores crudos de la tabla (número o string, tal
     * como llegan de un import CSV o de un body JSON de creación
     * manual) a `{rowOrder, sg, brix, alcohol}` NUMÉRICO, listo para
     * `repository.replaceRows()`. Filas cuyos valores no son numéricos
     * se descartan aquí (quedan reportadas como error por
     * `validateTable()` cuando se llame a `validate()`, sección 17) --
     * `create()` nunca lanza solo porque una fila individual tenga un
     * valor no numérico, para que el usuario pueda revisar la tabla ya
     * creada en estado DRAFT en vez de perder todo el intento de
     * import. Judgment call flagueado en el resumen de la entrega.
     */
    _normalizeRows(rawRows) {

        return (rawRows || []).map((row, index) => ({

            rowOrder: index + 1,

            sg: toFiniteNumber(row.sg),

            brix: toFiniteNumber(row.brix),

            alcohol: toFiniteNumber(row.alcohol)

        }));

    }

    _computeStats(normalizedRows) {

        const validSg =
            normalizedRows

                .map(r => r.sg)

                .filter(sg => sg !== null);

        return {

            rowCount: normalizedRows.length,

            minSg: validSg.length > 0 ? Math.min(...validSg) : null,

            maxSg: validSg.length > 0 ? Math.max(...validSg) : null

        };

    }

    /*
     * Crea una versión nueva de la tabla, siempre en DRAFT (sección 12
     * -- el estado inicial nunca lo decide el cliente). Cubre tanto la
     * primera versión de un instrumento (`parentTableId` ausente) como
     * un reemplazo explícito (sección 11, botón "[Crear nueva
     * versión]") -- en ese caso `parentTableId` debe pertenecer al
     * mismo `instrument` que se está creando (mismo criterio que
     * `MaturationModelCalibrationService.createProposal()` valida para
     * `parentCalibrationId`, 2.6.1.19).
     */
    async create({ name, manufacturer, instrument, source, rows, createdBy, parentTableId, changeReason }, transaction = null) {

        if (!name || String(name).trim() === "") {

            throw new Error("name es obligatorio.");

        }

        let resolvedInstrument =
            instrument && String(instrument).trim() !== ""
                ? String(instrument).trim()
                : DEFAULT_INSTRUMENT;

        if (parentTableId !== null && parentTableId !== undefined) {

            const parent =
                await this._requireExisting(parentTableId);

            if (instrument && String(instrument).trim() !== "" && String(instrument).trim() !== parent.instrument) {

                throw new Error(

                    `parentTableId debe pertenecer al mismo instrument (tabla #${parentTableId} es "${parent.instrument}", se intentó crear "${instrument}").`

                );

            }

            resolvedInstrument = parent.instrument;

        }

        const normalizedRows =
            this._normalizeRows(rows);

        return this.transactional(async t => {

            const created =
                await this.repository.create({

                    name,

                    manufacturer,

                    instrument: resolvedInstrument,

                    source,

                    createdBy,

                    parentTableId: parentTableId ?? null,

                    changeReason

                }, t);

            await this.repository.replaceRows(created.id, normalizedRows, t);

            await this.repository.updateCachedStats(

                created.id,

                this._computeStats(normalizedRows),

                t

            );

            await this.auditLogRepository.log({

                userId: createdBy,

                action: "CREATED",

                tableId: created.id,

                reason: changeReason ?? null

            }, t);

            const withRows =
                await this.repository.findById(created.id, t);

            return this._serialize(withRows);

        }, transaction);

    }

    async list(filters = {}) {

        const records =
            await this.repository.findAll(filters);

        return records.map(record => this._serialize(record));

    }

    async getById(id) {

        const record =
            await this._requireExisting(id);

        return this._serialize(record, { includeRows: true });

    }

    /*
     * Sección 17 -- corre `HydrometerTableValidation.validateTable()`
     * sobre las filas actuales de la tabla y persiste el resultado
     * (sección 14: "quién validó, cuándo"). Solo permitido desde DRAFT
     * o VALIDATED (re-validar es idempotente) -- nunca sobre
     * ACTIVE/INACTIVE, que ya pasaron por conversiones reales y no
     * deben mutar (sección 4, inmutabilidad histórica).
     */
    async validate(id, { validatedBy } = {}, transaction = null) {

        const record =
            await this._requireExisting(id);

        if (record.status !== "DRAFT" && record.status !== "VALIDATED") {

            throw new Error(

                `No se puede validar una tabla en estado ${record.status}. Una tabla ACTIVE o INACTIVE ya se usó para conversiones reales y no puede modificarse (inmutabilidad histórica).`

            );

        }

        const rowsForValidation =
            (record.rows || []).map(row => ({

                rowNumber: row.rowOrder,

                sg: row.sg,

                brix: row.brix,

                alcohol: row.alcohol

            }));

        const result =
            validateTable(rowsForValidation);

        return this.transactional(async t => {

            const updated =
                await this.repository.recordValidationResult(id, {

                    valid: result.valid,

                    errors: result.errors,

                    validatedBy

                }, t);

            await this.auditLogRepository.log({

                userId: validatedBy,

                action: result.valid ? "VALIDATED" : "VALIDATION_FAILED",

                tableId: id,

                reason: result.valid ? null : result.errors.join(" ")

            }, t);

            const withRows =
                await this.repository.findById(id, t);

            return {

                ...this._serialize(withRows),

                valid: result.valid,

                errors: result.errors

            };

        }, transaction);

    }

    /*
     * VALIDATED -> ACTIVE (sección 12, criterio explícito: "una tabla
     * con errores no puede pasar a ACTIVE" -- no se puede saltar de
     * DRAFT a ACTIVE directamente). Núcleo transaccional idéntico a
     * `MaturationModelCalibrationService.activate()`: desactivar
     * cualquier ACTIVE anterior del mismo `instrument` y activar esta
     * ocurren en la MISMA transacción, así nunca queda el instrumento
     * sin ninguna tabla ACTIVE (o con dos) a medio camino. La tabla
     * anterior queda INACTIVE solo para conversiones NUEVAS -- las
     * mediciones históricas conservan su propio
     * `hydrometerConversionTableId` (sección 5/12).
     */
    async activate(id, { activatedBy } = {}, transaction = null) {

        const record =
            await this._requireExisting(id);

        if (record.status !== "VALIDATED") {

            throw new Error(

                `No se puede activar una tabla que no esté VALIDATED (estado actual: ${record.status}). No se puede saltar de DRAFT a ACTIVE directamente.`

            );

        }

        return this.transactional(async t => {

            const currentActive =
                await this.repository.findActiveByInstrument(record.instrument, t);

            if (currentActive && currentActive.id !== record.id) {

                await this.repository.deactivateRow(currentActive.id, t);

            }

            const updated =
                await this.repository.activateRow(id, { activatedBy }, t);

            await this.auditLogRepository.log({

                userId: activatedBy,

                action: "ACTIVATED",

                tableId: id,

                previousTableId: currentActive ? currentActive.id : null

            }, t);

            const withRows =
                await this.repository.findById(id, t);

            return this._serialize(withRows);

        }, transaction);

    }

    // Sección 15 -- tabla que `HydrometerConversionService.convert()`
    // debe usar automáticamente para un instrumento.
    async getActiveByInstrument(instrument = DEFAULT_INSTRUMENT) {

        const record =
            await this.repository.findActiveByInstrument(instrument);

        return record ? this._serialize(record, { includeRows: true }) : null;

    }

    /*
     * Sección 13 -- "simular" una conversión con una versión concreta
     * (no necesariamente ACTIVE) ANTES de activarla, para detectar
     * errores de carga temprano. Reutiliza el mismo algoritmo puro que
     * usa la conversión real (`convertUsingPoints()`) -- nunca
     * reimplementa la interpolación aquí.
     */
    async simulate(id, { scale, value }) {

        const record =
            await this._requireExisting(id);

        const points =
            (record.rows || []).map(row => ({

                sg: Number(row.sg),

                brix: Number(row.brix),

                alcohol: Number(row.alcohol)

            }));

        return convertUsingPoints({ points, scale, value });

    }

    _serialize(record, { includeRows = false } = {}) {

        const base = {

            id: record.id,

            name: record.name,

            manufacturer: record.manufacturer ?? null,

            instrument: record.instrument,

            source: record.source ?? null,

            version: record.version,

            parentTableId: record.parentTableId ?? null,

            status: record.status,

            rowCount: record.rowCount ?? null,

            minSg: record.minSg !== null && record.minSg !== undefined ? Number(record.minSg) : null,

            maxSg: record.maxSg !== null && record.maxSg !== undefined ? Number(record.maxSg) : null,

            lastValidationErrors: record.lastValidationErrors ? JSON.parse(record.lastValidationErrors) : [],

            createdBy: record.createdBy ?? null,

            createdAt: record.createdAt,

            validatedAt: record.validatedAt ?? null,

            validatedBy: record.validatedBy ?? null,

            activatedAt: record.activatedAt ?? null,

            activatedBy: record.activatedBy ?? null,

            deactivatedAt: record.deactivatedAt ?? null,

            changeReason: record.changeReason ?? null

        };

        if (includeRows || record.rows) {

            base.rows = (record.rows || []).map(row => ({

                rowOrder: row.rowOrder,

                sg: Number(row.sg),

                brix: Number(row.brix),

                alcohol: Number(row.alcohol)

            }));

        }

        return base;

    }

}

module.exports =
    HydrometerConversionTableService;
