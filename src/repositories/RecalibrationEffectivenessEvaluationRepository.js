const SequelizeRepository =
    require("./SequelizeRepository");

const RecalibrationEffectivenessEvaluation =
    require("../models/RecalibrationEffectivenessEvaluation");

/*
 * Repositorio de RecalibrationEffectivenessEvaluation (Entrega
 * 2.6.1.32). Mismo criterio delgado que
 * RecalibrationProposalEvaluationRepository (2.6.1.30): cada fila se
 * crea una sola vez, completa, y nunca se actualiza retroactivamente
 * (sección 17, "no cambia retroactivamente").
 */
class RecalibrationEffectivenessEvaluationRepository
    extends SequelizeRepository {

    constructor() {

        super(RecalibrationEffectivenessEvaluation);

    }

    async create(data) {

        return await this.model.create(data);

    }

    /*
     * Historial completo, más reciente primero (sección 17: "se puede
     * consultar el detalle de cada evaluación").
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

    async findLatestByCalibration(calibrationId) {

        return await this.model.findOne({

            where: { calibrationId },

            order: [

                ["evaluatedAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

}

module.exports =
    RecalibrationEffectivenessEvaluationRepository;
