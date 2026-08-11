const SequelizeRepository =
    require("./SequelizeRepository");

const MaturationPrediction =
    require("../models/MaturationPrediction");

/*
 * Repositorio de MaturationPrediction (Entrega 2.6.1.12).
 *
 * Mismo criterio que MaturationModelConfigurationRepository (2.6.1.11):
 * reenvía `{ transaction }` explícitamente a Sequelize en vez de
 * confiar en la base compartida (que la ignora en silencio) — la
 * garantía de "solo una predicción isCurrent por lote" depende de que
 * marcar-anteriores-como-no-actuales y crear-la-nueva ocurran en la
 * misma transacción.
 */
class MaturationPredictionRepository
    extends SequelizeRepository {

    constructor() {

        super(MaturationPrediction);

    }

    /*
     * Historial completo de un lote, más reciente primero. No incluye
     * la configuración de modelo (el listado de la sección 6 de la
     * especificación solo necesita modelType/modelConfigurationId, no
     * el detalle de la configuración) -- ver findById() para eso.
     *
     * Entrega 2.6.1.26, sección 1/7 -- SÍ incluye la asociación
     * `calibration` (calibrationId nunca se recalcula, sección 2, pero
     * el listado/historial y el análisis por lote (sección 12,
     * `getBatchPredictionAnalysis()`) necesitan el version/status
     * ACTUAL de esa calibración -- que puede ya haber cambiado a
     * INACTIVE aunque la predicción la siga referenciando, sección 3 --
     * así que no basta con el `calibrationId` crudo ya guardado en la
     * fila, hace falta el join).
     */
    async findByBatch(productionBatchId) {

        return await this.model.findAll({

            where: {

                productionBatchId

            },

            include: [

                {

                    association: "calibration"

                }

            ],

            order: [

                ["predictedAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    async findCurrentByBatch(productionBatchId, transaction = null) {

        return await this.model.findOne({

            where: {

                productionBatchId,

                isCurrent: true

            },

            transaction

        });

    }

    /*
     * Detalle de UNA predicción, con su configuración de modelo
     * incluida (necesaria para el endpoint de trazabilidad completa,
     * sección 7: activatedAt/source del modelo que la produjo).
     *
     * Entrega 2.6.1.26, sección 3/4 -- también incluye la asociación
     * `calibration` (ver comentario de findByBatch() arriba, mismo
     * motivo): el detalle de una predicción debe poder mostrar
     * version/status/fecha de creación de la calibración que realmente
     * se usó, y enlazar a su detalle completo -- nada de esto vive en
     * las columnas propias de MaturationPrediction (que solo guardan
     * calibrationId/offsetHours/rawPredictedMaturationAt, sección 2:
     * nunca se duplica el dato, solo se referencia).
     */
    async findById(id) {

        return await this.model.findByPk(id, {

            include: [

                {

                    association: "modelConfiguration"

                },

                {

                    association: "calibration"

                }

            ]

        });

    }

    /*
     * Marca como isCurrent=false TODAS las predicciones ACTUALES de un
     * lote (normalmente será 0 o 1 fila, pero no se asume eso: se
     * actualizan todas las que estén en true, por seguridad). Nunca
     * borra ni modifica ningún otro campo -- una predicción histórica
     * sigue siendo inmutable salvo este flag (sección 4/5).
     */
    async markAllNotCurrent(productionBatchId, transaction = null) {

        await this.model.update(

            { isCurrent: false },

            {

                where: {

                    productionBatchId,

                    isCurrent: true

                },

                transaction

            }

        );

    }

    async create(data, transaction = null) {

        return await this.model.create(data, { transaction });

    }

    /*
     * Entrega 2.6.1.17 -- todas las predicciones que efectivamente
     * usaron una calibración específica. Filtrar por `calibrationId`
     * (en vez de por modelType+recipeVersionId+fecha de activación por
     * separado) colapsa de una sola vez las cinco exclusiones de la
     * sección 16: `calibrationId` solo se estampa (ver
     * `MaturationPredictionService._applyActiveCalibration()`, 2.6.1.16)
     * en el momento en que ESTA calibración específica estaba ACTIVE
     * para exactamente su propio (modelType, recipeVersionId) -- así
     * que ninguna predicción de otro modelo, otra versión de receta, u
     * otra calibración (incluida una anterior/posterior para el mismo
     * alcance) puede aparecer aquí por construcción. Incluye
     * `productionBatch` para poder leer `finishedAt` (actualMaturationAt)
     * sin una segunda consulta.
     */
    async findByCalibration(calibrationId) {

        return await this.model.findAll({

            where: {

                calibrationId

            },

            include: [

                {

                    association: "productionBatch"

                }

            ],

            order: [

                ["predictedAt", "ASC"],

                ["id", "ASC"]

            ]

        });

    }

    /*
     * Entrega 2.6.1.20 -- todas las predicciones VIGENTES (isCurrent=true,
     * mismo criterio de conteo que `ModelAccuracyMetricsService`,
     * 2.6.1.14: nunca contar dos veces las repeticiones de un mismo
     * lote) de una configuración de modelo específica -- a diferencia
     * de `findByCalibration()`, esto trae TODAS las predicciones de ese
     * modelo+receta a lo largo del tiempo, sin importar qué calibración
     * (si alguna) tenía cada una aplicada en su momento. Es justo lo
     * que necesita el dashboard: la comparación RAW vs. CALIBRATED
     * (sección 2) y la evolución temporal (sección 3) deben reflejar
     * TODA la historia del modelo, incluyendo predicciones generadas
     * bajo versiones de calibración distintas o sin ninguna -- cada fila
     * ya trae su propio `rawPredictedMaturationAt`/`predictedMaturationAt`/
     * `calibrationId` (2.6.1.16), así que no hace falta separar por
     * calibración aquí.
     */
    async findByModelConfiguration(modelConfigurationId) {

        return await this.model.findAll({

            where: {

                modelConfigurationId,

                isCurrent: true

            },

            include: [

                {

                    association: "productionBatch"

                }

            ],

            order: [

                ["predictedAt", "ASC"],

                ["id", "ASC"]

            ]

        });

    }

}

module.exports =
    MaturationPredictionRepository;
