const { Op } =
    require("sequelize");

const SequelizeRepository =
    require("./SequelizeRepository");

const RecalibrationProposalEvaluation =
    require("../models/RecalibrationProposalEvaluation");

/*
 * Repositorio de RecalibrationProposalEvaluation (Entrega 2.6.1.30).
 *
 * Mismo criterio deliberadamente delgado que
 * MaturationCalibrationEvaluationRepository (2.6.1.17): cada fila se
 * crea una sola vez, completa, y nunca se actualiza retroactivamente
 * (sección 15) -- no hace falta ningún método de actualización.
 */
class RecalibrationProposalEvaluationRepository
    extends SequelizeRepository {

    constructor() {

        super(RecalibrationProposalEvaluation);

    }

    async create(data) {

        return await this.model.create(data);

    }

    /*
     * Historial completo, más reciente primero (sección 14: "una nueva
     * evaluación queda diferenciada de la anterior" -- nunca se borran
     * ni se sobrescriben filas anteriores).
     */
    async findByCalibration(calibrationId) {

        return await this.model.findAll({

            where: { calibrationId },

            order: [

                ["evaluatedAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    /*
     * La evaluación vigente para mostrar en la tabla/detalle de
     * propuestas (sección 16) -- siempre la más reciente, nunca la
     * primera.
     */
    async findLatestByCalibration(calibrationId) {

        return await this.model.findOne({

            where: { calibrationId },

            order: [

                ["evaluatedAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    /*
     * Entrega 2.6.1.30 -- variante en bloque de `findLatestByCalibration()`
     * para listados (evita una consulta por fila). Devuelve un mapa
     * `{ [calibrationId]: row }` con solo la fila MÁS RECIENTE de cada
     * una; SQLite/Sequelize no tienen aquí un `DISTINCT ON` limpio, así
     * que se trae todo el conjunto ordenado y se reduce en JS -- el
     * volumen esperado (evaluaciones por propuesta) es pequeño, mismo
     * criterio pragmático que el resto de este proyecto (sin capa de
     * paginación en ningún listado todavía).
     */
    async findLatestByCalibrationIds(calibrationIds) {

        const ids =
            Array.isArray(calibrationIds) ? calibrationIds.filter(id => id !== null && id !== undefined) : [];

        if (ids.length === 0) {

            return {};

        }

        const rows =
            await this.model.findAll({

                where: { calibrationId: { [Op.in]: ids } },

                order: [

                    ["evaluatedAt", "DESC"],

                    ["id", "DESC"]

                ]

            });

        const latestByCalibrationId =
            {};

        for (const row of rows) {

            if (!(row.calibrationId in latestByCalibrationId)) {

                latestByCalibrationId[row.calibrationId] =
                    row;

            }

        }

        return latestByCalibrationId;

    }

}

module.exports =
    RecalibrationProposalEvaluationRepository;
