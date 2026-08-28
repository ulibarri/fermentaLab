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
