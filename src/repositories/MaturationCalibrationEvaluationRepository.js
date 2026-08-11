const SequelizeRepository =
    require("./SequelizeRepository");

const MaturationCalibrationEvaluation =
    require("../models/MaturationCalibrationEvaluation");

/*
 * Repositorio de MaturationCalibrationEvaluation (Entrega 2.6.1.17).
 *
 * A diferencia de MaturationModelCalibrationRepository/
 * MaturationPredictionRepository, esta tabla nunca necesita
 * atomicidad multi-paso (cada fila se crea una sola vez, completa, y
 * nunca se actualiza -- sección 19, criterio "una evaluación no
 * modifique ninguna predicción" ni a sí misma retroactivamente) --
 * por eso `create()` no necesita reenviar `{transaction}` como los
 * repositorios del ciclo de vida de calibraciones.
 */
class MaturationCalibrationEvaluationRepository
    extends SequelizeRepository {

    constructor() {

        super(MaturationCalibrationEvaluation);

    }

    /*
     * Historial completo de evaluaciones de una calibración, más
     * reciente primero (sección 14: "permitirá observar si una
     * calibración sigue siendo útil conforme llegan nuevos lotes").
     */
    async findByCalibration(calibrationId) {

        return await this.model.findAll({

            where: {

                calibrationId

            },

            order: [

                ["createdAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    async create(data) {

        return await this.model.create(data);

    }

}

module.exports =
    MaturationCalibrationEvaluationRepository;
