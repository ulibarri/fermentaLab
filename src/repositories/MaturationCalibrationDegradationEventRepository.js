const { Op } = require("sequelize");

const SequelizeRepository =
    require("./SequelizeRepository");

const MaturationCalibrationDegradationEvent =
    require("../models/MaturationCalibrationDegradationEvent");

/*
 * Repositorio de MaturationCalibrationDegradationEvent (Entrega
 * 2.6.1.28).
 *
 * Deliberadamente delgado -- mismo criterio que
 * MaturationModelAlertRepository (2.6.1.21): toda la lógica de
 * detección/deduplicación/recuperación vive en
 * CalibrationDegradationService, este repositorio solo sabe leer/
 * crear/actualizar filas.
 */
class MaturationCalibrationDegradationEventRepository
    extends SequelizeRepository {

    constructor() {

        super(MaturationCalibrationDegradationEvent);

    }

    /*
     * El evento SIN RESOLVER (DETECTED o ACKNOWLEDGED) vigente de una
     * calibración -- sección 8: "una única degradación activa para
     * una determinada calibración mientras ésta permanezca sin
     * resolver". Debería haber a lo sumo uno por construcción (el
     * servicio nunca crea un segundo mientras exista uno sin
     * resolver), pero se toma el más reciente por seguridad.
     */
    async findActiveByCalibration(calibrationId) {

        return await this.model.findOne({

            where: {

                calibrationId,

                status: { [Op.in]: ["DETECTED", "ACKNOWLEDGED"] }

            },

            order: [

                ["detectedAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    /*
     * Historial completo de una calibración (sección 7: "no debemos
     * eliminar registros anteriores" / sección 12: "desde la
     * calibración -> Alertas de degradación"), más reciente primero.
     */
    async findByCalibration(calibrationId) {

        return await this.model.findAll({

            where: { calibrationId },

            order: [

                ["detectedAt", "DESC"],

                ["id", "DESC"]

            ]

        });

    }

    async findById(id) {

        return await this.model.findByPk(id);

    }

    /*
     * Entrega 2.6.1.29, sección 8 -- lado "propuesta -> alerta origen"
     * de la trazabilidad bidireccional. Búsqueda directa por FK exacta
     * (nunca "más reciente por calibración", a diferencia de
     * MaturationModelAlertRepository.findMostRecentByCalibration(),
     * 2.6.1.24, que sí necesita ese criterio heurístico porque las
     * alertas de salud no guardan un puntero directo a la propuesta que
     * originaron): `proposalId` identifica sin ambigüedad, como mucho,
     * un único evento.
     */
    async findByProposalId(proposalId) {

        return await this.model.findOne({

            where: { proposalId }

        });

    }

    async create({ calibrationId, sampleSize, baselineMaeHours, currentMaeHours, baselineRmseHours, currentRmseHours, baselineBiasHours, currentBiasHours, degradationPercentage, thresholdPercentage }) {

        return await this.model.create({

            calibrationId,

            detectedAt: new Date(),

            sampleSize,

            baselineMaeHours: baselineMaeHours ?? null,

            currentMaeHours: currentMaeHours ?? null,

            baselineRmseHours: baselineRmseHours ?? null,

            currentRmseHours: currentRmseHours ?? null,

            baselineBiasHours: baselineBiasHours ?? null,

            currentBiasHours: currentBiasHours ?? null,

            degradationPercentage: degradationPercentage ?? null,

            thresholdPercentage,

            status: "DETECTED"

        });

    }

    /*
     * Sección 8/9 -- refresca el snapshot de métricas de un evento SIN
     * RESOLVER YA EXISTENTE, en el lugar (nunca crea una fila nueva
     * para la misma degradación continua -- mismo patrón que
     * MaturationModelAlertRepository.updateCondition(), 2.6.1.21).
     * Nunca toca `detectedAt` (el inicio del episodio no cambia por
     * refrescarse) ni `status`/`acknowledgedAt` (un evento ya
     * reconocido sigue reconocido aunque las métricas se actualicen).
     */
    async updateSnapshot(id, { sampleSize, baselineMaeHours, currentMaeHours, baselineRmseHours, currentRmseHours, baselineBiasHours, currentBiasHours, degradationPercentage, thresholdPercentage }) {

        const record =
            await this.model.findByPk(id);

        if (!record) {

            return null;

        }

        record.sampleSize = sampleSize;
        record.baselineMaeHours = baselineMaeHours ?? null;
        record.currentMaeHours = currentMaeHours ?? null;
        record.baselineRmseHours = baselineRmseHours ?? null;
        record.currentRmseHours = currentRmseHours ?? null;
        record.baselineBiasHours = baselineBiasHours ?? null;
        record.currentBiasHours = currentBiasHours ?? null;
        record.degradationPercentage = degradationPercentage ?? null;
        record.thresholdPercentage = thresholdPercentage;

        await record.save();

        return record;

    }

    /*
     * Entrega 2.6.1.29, sección 8/12 (paso 10) -- asocia el evento con
     * la propuesta recién generada, dentro de la MISMA transacción que
     * la creó (sección 13: "la generación de la propuesta y su
     * asociación con la alerta deben ocurrir de forma atómica"). Nunca
     * toca `status`/`acknowledgedAt`/`resolvedAt` -- generar una
     * propuesta no es, por sí sola, ni un reconocimiento ni una
     * resolución del evento (esas siguen siendo acciones explícitas del
     * usuario, acknowledge()/resolve() de abajo).
     */
    async attachProposal(id, proposalId, transaction = null) {

        const record =
            await this.model.findByPk(id, { transaction });

        if (!record) {

            return null;

        }

        record.proposalId = proposalId;

        await record.save({ transaction });

        return record;

    }

    async acknowledge(id) {

        return await this._setStatus(id, {

            status: "ACKNOWLEDGED",

            acknowledgedAt: new Date()

        });

    }

    async resolve(id) {

        return await this._setStatus(id, {

            status: "RESOLVED",

            resolvedAt: new Date()

        });

    }

    async _setStatus(id, fields) {

        const record =
            await this.model.findByPk(id);

        if (!record) {

            return null;

        }

        Object.assign(record, fields);

        await record.save();

        return record;

    }

}

module.exports =
    MaturationCalibrationDegradationEventRepository;
