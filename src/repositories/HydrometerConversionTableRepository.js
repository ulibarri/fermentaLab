const HydrometerConversionTable =
    require("../models/HydrometerConversionTable");

const HydrometerConversionTableRow =
    require("../models/HydrometerConversionTableRow");

const SequelizeRepository =
    require("./SequelizeRepository");

const ROWS_INCLUDE = {

    association: "rows",

    separate: true,

    order: [["rowOrder", "ASC"]]

};

/*
 * Entrega 2.8.0.2 -- repositorio de `HydrometerConversionTable`, calcado
 * de `MaturationModelCalibrationRepository` (2.6.1.16): reenvía
 * `{ transaction }` explícitamente a Sequelize en cada consulta -- la
 * garantía de "una sola tabla ACTIVE por instrument" depende de que
 * desactivar la anterior y activar la nueva ocurran en la misma
 * transacción (ver `HydrometerConversionTableService.activate()`).
 */
class HydrometerConversionTableRepository
    extends SequelizeRepository {

    constructor() {

        super(HydrometerConversionTable);

    }

    async findById(id, transaction = null) {

        return await this.model.findByPk(id, {

            include: [ROWS_INCLUDE],

            transaction

        });

    }

    /*
     * Listado para la pantalla administrativa (sección 10), más
     * reciente primero. Filtros opcionales, todos combinables.
     */
    async findAll(filters = {}) {

        const where = {};

        if (filters.instrument) {

            where.instrument = filters.instrument;

        }

        if (filters.status) {

            where.status = filters.status;

        }

        return await this.model.findAll({

            where,

            order: [

                ["instrument", "ASC"],

                ["version", "DESC"]

            ]

        });

    }

    /*
     * La tabla ACTIVE de un instrumento, o null si ninguna lo está. Es
     * la consulta que `HydrometerConversionService` usa para saber cuál
     * tabla usar en cada conversión (sección 15: "debe usar
     * automáticamente la tabla ACTIVE"), y la que
     * `HydrometerConversionTableService.activate()` usa para saber cuál
     * desactivar antes de activar una nueva.
     */
    async findActiveByInstrument(instrument, transaction = null) {

        return await this.model.findOne({

            where: {

                instrument,

                status: "ACTIVE"

            },

            include: [ROWS_INCLUDE],

            transaction

        });

    }

    /*
     * Cadena de versiones de un instrumento, más antigua primero --
     * mismo criterio que `MaturationModelCalibrationRepository
     * .findVersionChain()` (2.6.1.19).
     */
    async findVersionChain(instrument) {

        return await this.model.findAll({

            where: { instrument },

            order: [

                ["version", "ASC"],

                ["id", "ASC"]

            ]

        });

    }

    /*
     * Sección 3 -- siguiente número de versión DENTRO de `instrument`,
     * nunca global. MAX(version)+1 en ese alcance (1 si todavía no
     * existe ninguna), siempre calculado server-side.
     */
    async _nextVersion(instrument, transaction = null) {

        const maxVersion =
            await this.model.max("version", {

                where: { instrument },

                transaction

            });

        return (maxVersion || 0) + 1;

    }

    /*
     * Crea la cabecera de una versión nueva, siempre en estado DRAFT
     * (sección 12 -- el estado inicial nunca lo decide el cliente).
     * `version` siempre se calcula aquí, nunca se acepta del llamador.
     */
    async create({ name, manufacturer, instrument, source, createdBy, parentTableId, changeReason }, transaction = null) {

        const version =
            await this._nextVersion(instrument, transaction);

        return await this.model.create({

            name,

            manufacturer: manufacturer ?? null,

            instrument,

            source: source ?? null,

            status: "DRAFT",

            createdBy: createdBy ?? null,

            parentTableId: parentTableId ?? null,

            changeReason: changeReason ?? null,

            version

        }, { transaction });

    }

    /*
     * Reemplaza TODAS las filas de una tabla (usado tanto al crear una
     * tabla nueva desde cero como al reimportar/recapturar sus filas
     * mientras siga en DRAFT -- nunca sobre una tabla VALIDATED/ACTIVE,
     * eso lo impide el servicio, sección 11: "no permitir edición
     * directa de una tabla activa"). `rows` ya viene con `rowOrder`
     * asignado por el llamador (1-based, mismo orden que el archivo/
     * body de entrada).
     */
    async replaceRows(tableId, rows, transaction = null) {

        await HydrometerConversionTableRow.destroy({

            where: { hydrometerConversionTableId: tableId },

            transaction

        });

        if (rows.length === 0) {

            return [];

        }

        return await HydrometerConversionTableRow.bulkCreate(

            rows.map(row => ({

                hydrometerConversionTableId: tableId,

                rowOrder: row.rowOrder,

                sg: row.sg,

                brix: row.brix,

                alcohol: row.alcohol

            })),

            { transaction }

        );

    }

    /*
     * Sección 10 -- caché de presentación (rango SG, número de filas)
     * recalculada cada vez que se reemplazan las filas de una tabla.
     */
    async updateCachedStats(tableId, { rowCount, minSg, maxSg }, transaction = null) {

        const record =
            await this.model.findByPk(tableId, { transaction });

        if (!record) {

            return null;

        }

        record.rowCount = rowCount;

        record.minSg = minSg;

        record.maxSg = maxSg;

        await record.save({ transaction });

        return record;

    }

    /*
     * Sección 17 -- resultado de un intento de validación. Siempre
     * sobreescribe `lastValidationErrors` (éxito -> arreglo vacío,
     * fallo -> los mensajes específicos). Solo transiciona a VALIDATED
     * cuando `valid` es true -- si es false, el estado (DRAFT) no
     * cambia, el llamador es responsable de no permitir activar una
     * tabla que nunca llegó a VALIDATED (sección 12).
     */
    async recordValidationResult(id, { valid, errors, validatedBy }, transaction = null) {

        const record =
            await this.model.findByPk(id, { transaction });

        if (!record) {

            return null;

        }

        record.lastValidationErrors = JSON.stringify(errors || []);

        if (valid) {

            record.status = "VALIDATED";

            record.validatedAt = new Date();

            record.validatedBy = validatedBy ?? null;

        }

        await record.save({ transaction });

        return record;

    }

    async activateRow(id, { activatedBy } = {}, transaction = null) {

        return await this._setStatus(id, {

            status: "ACTIVE",

            activatedAt: new Date(),

            activatedBy: activatedBy ?? null

        }, transaction);

    }

    async deactivateRow(id, transaction = null) {

        return await this._setStatus(id, {

            status: "INACTIVE",

            deactivatedAt: new Date()

        }, transaction);

    }

    async _setStatus(id, fields, transaction) {

        const record =
            await this.model.findByPk(id, { transaction });

        if (!record) {

            return null;

        }

        Object.assign(record, fields);

        await record.save({ transaction });

        return record;

    }

}

module.exports =
    HydrometerConversionTableRepository;
