const { Op } =
    require("sequelize");

const SequelizeRepository =
    require("./SequelizeRepository");

const ProductionMeasurement =
    require("../models/ProductionMeasurement");

class ProductionMeasurementRepository
    extends SequelizeRepository {

    constructor() {

        super(ProductionMeasurement);

    }

    async findByBatch(productionBatchId) {

        return await this.model.findAll({

            where: {

                productionBatchId

            },

            order: [

                ["measurementDate", "ASC"]

            ]

        });

    }

    /*
     * Entrega 2.7.0.4, sección 14 -- "no debemos cargar todas las
     * mediciones históricas": a diferencia de findByBatch() (historial
     * completo), esto trae UNA SOLA fila (la más reciente por
     * measurementDate, de cualquier fase) -- justo lo que el panel
     * operativo necesita para "última medición"/"fecha de última
     * medición" (sección 4) sin cargar el resto del historial del lote.
     */
    async findLatestByBatch(productionBatchId) {

        return await this.model.findOne({

            where: {

                productionBatchId

            },

            order: [

                ["measurementDate", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    /*
     * Entrega 2.8.0.5, sección 10 -- `GET /api/hydrometer/audit` (a
     * diferencia de `findByBatch()`, esta consulta NO está limitada a
     * un lote: es la base del análisis histórico cross-batch). Todos
     * los filtros son opcionales y de columnas planas (sin joins) --
     * `tableVersion` deliberadamente NO se filtra aquí, porque el
     * modelo solo guarda `hydrometerConversionTableId` (la versión se
     * resuelve consultando `HydrometerConversionTable`, ver
     * `HydrometerAuditService.getHistoricalAnalysis()`).
     */
    async findForAudit({ phase, batchId, tableId, from, to } = {}) {

        const where = {};

        if (phase) {

            where.phase = phase;

        }

        if (batchId) {

            where.productionBatchId = batchId;

        }

        if (tableId) {

            where.hydrometerConversionTableId = tableId;

        }

        if (from || to) {

            where.measurementDate = {};

            if (from) {

                where.measurementDate[Op.gte] = from;

            }

            if (to) {

                where.measurementDate[Op.lte] = to;

            }

        }

        return await this.model.findAll({

            where,

            order: [

                ["measurementDate", "ASC"]

            ]

        });

    }

    async existsByBatchAndPhase(productionBatchId, phase) {

        const count = await this.model.count({

            where: {

                productionBatchId,

                phase

            }

        });

        return count > 0;

    }

}

module.exports =
    ProductionMeasurementRepository;
