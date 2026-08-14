const BaseService =
    require("./BaseService");

const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const MaturationCalibrationDegradationEventRepository =
    require("../repositories/MaturationCalibrationDegradationEventRepository");

const CalibrationEffectivenessService =
    require("./CalibrationEffectivenessService");

const DegradationDetection =
    require("../utils/DegradationDetection");

// Entrega 2.6.1.29 -- dependencias nuevas para generateProposal():
// nunca reimplementa nada de esto, solo las orquesta en secuencia.
const MaturationModelCalibrationService =
    require("./MaturationModelCalibrationService");

const MaturationAlertAuditLogRepository =
    require("../repositories/MaturationAlertAuditLogRepository");

const RecalibrationAlertRules =
    require("../utils/RecalibrationAlertRules");

const PostActivationEvaluation =
    require("../utils/PostActivationEvaluation");

/*
 * Detección automática de degradación de calibraciones activas
 * (Entrega 2.6.1.28).
 *
 * Puramente orquestador -- mismo rol que ModelAlertService (2.6.1.21)
 * cumple para las alertas de salud, pero para un concepto distinto:
 * ModelAlertService compara una calibración contra SU PROPIA ventana
 * histórica (CalibrationHealth, 2.6.1.18); este servicio compara una
 * calibración ACTIVE contra LA CALIBRACIÓN QUE REEMPLAZÓ (sección 3:
 * "inicialmente utilizaremos como baseline la información disponible
 * de la calibración anterior").
 *
 * Fuente de los dos números que se comparan (deliberado, ver comentario
 * de `_evaluateCalibration()` más abajo): reutiliza
 * `CalibrationEffectivenessService.getHealth()` (2.6.1.18) DOS veces --
 * nunca reimplementa ningún cálculo de MAE/RMSE/Bias.
 *
 * `getStatus()` es, a propósito, el único punto de entrada que corre
 * la detección -- mismo criterio que `ModelAlertService.getAlerts()`
 * (2.6.1.21/22, sección 9 de esa entrega: "no se deberá crear una
 * alerta idéntica cada vez que el usuario abra el dashboard"), así
 * que la deduplicación ocurre ahí mismo, no en un endpoint de
 * "evaluar" separado.
 *
 * Entrega 2.6.1.29 -- agrega `generateProposal()`, que conecta esta
 * detección con el mecanismo de propuestas de recalibración ya
 * existente (2.6.1.19/24). Ahora extiende `BaseService` (como
 * `MaturationModelCalibrationService`, 2.6.1.16) únicamente para
 * heredar `transactional()` -- la generación de la propuesta y su
 * asociación con el evento deben ocurrir de forma atómica (sección
 * 13). `this.repository` (heredado) y `this.degradationEventRepository`
 * son deliberadamente el mismo objeto (ver constructor) -- el resto de
 * este archivo, escrito antes de esta entrega, sigue usando
 * `this.degradationEventRepository` sin ningún cambio.
 */
class CalibrationDegradationService
    extends BaseService {

    constructor() {

        super(new MaturationCalibrationDegradationEventRepository());

        this.degradationEventRepository =
            this.repository;

        this.calibrationRepository =
            new MaturationModelCalibrationRepository();

        this.effectivenessService =
            new CalibrationEffectivenessService();

        // Entrega 2.6.1.29.
        this.calibrationService =
            new MaturationModelCalibrationService();

        this.auditLogRepository =
            new MaturationAlertAuditLogRepository();

    }

    async _requireCalibration(calibrationId) {

        const calibration =
            await this.calibrationRepository.findById(calibrationId);

        if (!calibration) {

            throw new Error("Calibration not found");

        }

        return calibration;

    }

    /*
     * Arma la condición ACTUAL de una calibración ACTIVE -- nunca
     * persiste nada por sí sola, eso lo decide `getStatus()`.
     *
     * Elección deliberada de qué es "actual" y qué es "baseline"
     * (sección 3, criterio central de esta entrega):
     *
     *   - `current`  = `getHealth(calibrationId).recent` -- la VENTANA
     *     MÓVIL de hasta las últimas 10 predicciones evaluables de
     *     ESTA calibración (2.6.1.18, `CalibrationHealth.
     *     RECENT_WINDOW_SIZE`, que coincide exactamente con el mínimo
     *     de muestra de la sección 5 de esta entrega). Se elige la
     *     ventana móvil -- y no el agregado acumulado desde la
     *     activación -- precisamente para poder cumplir la sección 9
     *     ("debemos detectar cuando el comportamiento vuelve a la
     *     normalidad"): un agregado acumulado desde la activación
     *     apenas se movería con datos nuevos una vez que la muestra
     *     total crece, haciendo la recuperación casi indetectable. La
     *     ventana móvil, en cambio, refleja el desempeño RECIENTE
     *     real, y a la vez nunca reacciona a una sola predicción
     *     (siempre son hasta 10 puntos), satisfaciendo también la
     *     sección 2.
     *   - `baseline` = `getHealth(parentCalibrationId).historical` --
     *     el agregado COMPLETO de la calibración ANTERIOR desde que
     *     ella misma fue activada. A diferencia de `current`, este
     *     valor es efectivamente estático: la calibración padre ya no
     *     está ACTIVE, así que nunca vuelve a generar predicciones
     *     nuevas -- es un "comportamiento de referencia" genuinamente
     *     fijo, tal como pide la sección 3 ("cada calibración activa
     *     tendrá un comportamiento de referencia").
     *
     * Sin `parentCalibrationId` no hay baseline posible -- una primera
     * versión nunca reemplazó a nada, así que la detección no aplica
     * (mismo caso que `PostActivationEvaluation`'s `NO_PREVIOUS_DATA`,
     * 2.6.1.27).
     */
    async _evaluateCalibration(calibration, thresholdPercentage) {

        if (!calibration.parentCalibrationId) {

            return {

                applicable: false,

                reason: "NO_BASELINE",

                classification: null,

                snapshot: null

            };

        }

        const currentHealth =
            await this.effectivenessService.getHealth(calibration.id);

        const baselineHealth =
            await this.effectivenessService.getHealth(calibration.parentCalibrationId);

        const classification =
            DegradationDetection.classifyDegradation({

                sampleSize: currentHealth.recent.sampleSize,

                baselineMaeHours: baselineHealth.historical.maeHours,

                currentMaeHours: currentHealth.recent.maeHours,

                thresholdPercentage

            });

        return {

            applicable: true,

            reason: null,

            classification,

            snapshot: {

                sampleSize: currentHealth.recent.sampleSize,

                baselineMaeHours: baselineHealth.historical.maeHours,

                currentMaeHours: currentHealth.recent.maeHours,

                baselineRmseHours: baselineHealth.historical.rmseHours,

                currentRmseHours: currentHealth.recent.rmseHours,

                baselineBiasHours: baselineHealth.historical.biasHours,

                currentBiasHours: currentHealth.recent.biasHours,

                degradationPercentage: classification.degradationPercentage,

                thresholdPercentage: classification.thresholdPercentage

            }

        };

    }

    /*
     * Punto de entrada principal -- GET /api/maturation/calibrations/:id/
     * degradation. Corre la detección (sección 1/14: solo si la
     * calibración está ACTIVE), aplica deduplicación (sección 8) y
     * recuperación (sección 9), y devuelve tanto el evento vigente (si
     * lo hay) como el historial completo (sección 7/12).
     *
     * Seguridad (sección 14, criterios explícitos): este método SOLO
     * lee la calibración y crea/actualiza filas de
     * MaturationCalibrationDegradationEvent -- nunca modifica la
     * calibración misma, ninguna predicción, ni crea una calibración
     * nueva (eso queda, deliberadamente, para una entrega futura --
     * sección 11).
     */
    async getStatus(calibrationId, { thresholdPercentage = DegradationDetection.DEFAULT_DEGRADATION_THRESHOLD_PERCENTAGE } = {}) {

        const calibration =
            await this._requireCalibration(calibrationId);

        const activeEvent =
            await this.degradationEventRepository.findActiveByCalibration(calibrationId);

        // Sección 14: "se evalúan únicamente calibraciones ACTIVE" --
        // si la calibración ya no está ACTIVE (fue desactivada o
        // reemplazada), la detección simplemente no vuelve a correr;
        // cualquier evento ya persistido se sigue viendo en el
        // historial tal cual quedó (nunca se resuelve automáticamente
        // solo porque la calibración dejó de estar activa -- a
        // diferencia de MaturationModelAlert, 2.6.1.21, que sí
        // auto-resuelve en ese caso; aquí se prefiere dejar el
        // registro histórico intacto, ya que "la calibración dejó de
        // estar activa" no es lo mismo que "el desempeño se
        // recuperó", sección 9).
        if (calibration.status !== "ACTIVE") {

            const history =
                await this.degradationEventRepository.findByCalibration(calibrationId);

            return {

                calibrationId: calibration.id,

                calibrationStatus: calibration.status,

                applicable: false,

                reason: "NOT_ACTIVE",

                degradationStatus: activeEvent ? "DEGRADED" : "NORMAL",

                current: activeEvent ? await this._serializeEventWithProposal(activeEvent) : null,

                history: history.map(record => this._serialize(record))

            };

        }

        const evaluation =
            await this._evaluateCalibration(calibration, thresholdPercentage);

        let currentEvent =
            activeEvent;

        if (!evaluation.applicable) {

            // Sin padre -- no hay baseline, no se puede clasificar. Un
            // evento ya activo (de una detección previa cuando sí
            // había padre -- no debería pasar en la práctica, ya que
            // parentCalibrationId nunca cambia una vez creada la
            // calibración, pero se contempla defensivamente) se deja
            // tal cual, nunca se inventa una resolución.

        } else if (evaluation.classification.isDegraded) {

            if (currentEvent) {

                // Sección 8/9 -- la misma degradación sigue activa (o
                // se refrescó su magnitud): se actualiza EN EL LUGAR,
                // nunca se crea una segunda fila. Un evento ya
                // ACKNOWLEDGED permanece ACKNOWLEDGED (reconocerlo no
                // se deshace solo porque las métricas se refrescaron).
                currentEvent =
                    await this.degradationEventRepository.updateSnapshot(currentEvent.id, evaluation.snapshot);

            } else {

                // Sección 17 (por analogía con 2.6.1.21) -- no había
                // ningún evento sin resolver para esta calibración
                // (nunca existió, o el anterior ya fue resuelto): se
                // crea uno nuevo.
                currentEvent =
                    await this.degradationEventRepository.create({

                        calibrationId: calibration.id,

                        ...evaluation.snapshot

                    });

            }

        } else if (currentEvent) {

            // Sección 9 -- recuperación: el criterio de desempeño
            // vuelve a cumplirse (isDegraded=false) CON muestra
            // suficiente (evaluation.classification.sufficientSample,
            // ya exigido dentro de isDegraded/classifyDegradation) --
            // nunca se resuelve por una sola observación aislada,
            // porque `current` siempre es la ventana móvil de hasta 10
            // predicciones, nunca una única predicción (ver comentario
            // de `_evaluateCalibration()`). Se resuelve
            // AUTOMÁTICAMENTE -- distinto de `resolve()` (más abajo),
            // que es la resolución manual explícita del usuario.
            if (evaluation.classification.sufficientSample) {

                currentEvent =
                    await this.degradationEventRepository.resolve(currentEvent.id);

            }

            // Si la muestra reciente todavía no es suficiente para
            // confirmar la recuperación, el evento permanece tal cual
            // estaba -- no se resuelve con evidencia parcial, pero
            // tampoco se re-degrada solo por falta de datos nuevos.

        }

        const history =
            await this.degradationEventRepository.findByCalibration(calibrationId);

        return {

            calibrationId: calibration.id,

            calibrationStatus: calibration.status,

            applicable: evaluation.applicable,

            reason: evaluation.reason,

            classification: evaluation.classification,

            degradationStatus: currentEvent && currentEvent.status !== "RESOLVED" ? "DEGRADED" : "NORMAL",

            current: currentEvent && currentEvent.status !== "RESOLVED" ? await this._serializeEventWithProposal(currentEvent) : null,

            history: history.map(record => this._serialize(record))

        };

    }

    /*
     * Sección 7/10 -- "reconocer" (ACKNOWLEDGED) solo desde DETECTED,
     * nunca implica que la degradación esté resuelta.
     */
    async acknowledge(id) {

        const record =
            await this.degradationEventRepository.findById(id);

        if (!record) {

            throw new Error("Degradation event not found");

        }

        if (record.status !== "DETECTED") {

            throw new Error(

                `Solo se puede reconocer un evento en estado DETECTED (estado actual: ${record.status}).`

            );

        }

        const updated =
            await this.degradationEventRepository.acknowledge(id);

        return this._serialize(updated);

    }

    /*
     * Sección 7 -- DETECTED o ACKNOWLEDGED -> RESOLVED, resolución
     * MANUAL explícita del usuario (ej. "ya sé de esto y decidí que no
     * amerita más seguimiento por ahora"), distinta de la resolución
     * automática por recuperación que `getStatus()` aplica cuando el
     * desempeño vuelve a la normalidad por sí solo.
     */
    async resolve(id) {

        const record =
            await this.degradationEventRepository.findById(id);

        if (!record) {

            throw new Error("Degradation event not found");

        }

        if (record.status === "RESOLVED") {

            throw new Error("Este evento de degradación ya está resuelto.");

        }

        const updated =
            await this.degradationEventRepository.resolve(id);

        return this._serialize(updated);

    }

    _serialize(record) {

        return {

            id: record.id,

            calibrationId: record.calibrationId,

            // Entrega 2.6.1.29, sección 8 -- null mientras no se haya
            // generado ninguna propuesta desde este evento.
            proposalId: record.proposalId ?? null,

            detectedAt: record.detectedAt,

            sampleSize: record.sampleSize,

            baselineMaeHours: record.baselineMaeHours,

            currentMaeHours: record.currentMaeHours,

            baselineRmseHours: record.baselineRmseHours,

            currentRmseHours: record.currentRmseHours,

            baselineBiasHours: record.baselineBiasHours,

            currentBiasHours: record.currentBiasHours,

            degradationPercentage: record.degradationPercentage,

            thresholdPercentage: record.thresholdPercentage,

            status: record.status,

            acknowledgedAt: record.acknowledgedAt,

            resolvedAt: record.resolvedAt,

            createdAt: record.createdAt

        };

    }

    /*
     * Entrega 2.6.1.29 -- variante de `_serialize()` usada SOLO para el
     * evento `current` de `getStatus()` (nunca para `history`, para no
     * introducir N+1 consultas sobre un historial potencialmente largo
     * que la tarjeta de "Estado del modelo" ni siquiera muestra fila
     * por fila). Agrega `proposalStatus` -- lo que el frontend necesita
     * para decidir entre "Ver propuesta" (todavía PROPOSED/APPROVED/
     * ACTIVE/INACTIVE) y "Generar nueva propuesta" (la anterior quedó
     * REJECTED, sección 9: "posteriormente podrá generarse otra
     * propuesta solamente mediante una nueva solicitud explícita") sin
     * una segunda petición HTTP.
     */
    async _serializeEventWithProposal(record) {

        const base =
            this._serialize(record);

        base.proposalStatus =
            null;

        if (base.proposalId) {

            const proposal =
                await this.calibrationRepository.findById(base.proposalId);

            base.proposalStatus =
                proposal ? proposal.status : null;

        }

        return base;

    }

    /*
     * Entrega 2.6.1.29, sección 1/2/8/9/12/13/14 -- genera una
     * propuesta de recalibración a partir de una alerta de degradación
     * DETECTED o ACKNOWLEDGED (sección 9 solo menciona DETECTED
     * explícitamente para la regla de duplicados, pero nada prohíbe
     * generarla también tras reconocerla -- "reconocer" nunca implica
     * "ya no amerita acción", ver el comentario de `acknowledge()`
     * arriba; se excluye únicamente RESOLVED, donde ya no hay nada que
     * proponer). Sigue al pie de la letra la checklist de la sección 12:
     *
     *   1-2. cargar y validar el evento.
     *   3.   obtener la calibración afectada (`event.calibrationId`).
     *   4-5. obtener la muestra evaluable ACTUAL -- reutiliza
     *        `getHealth(calibrationId).recent` (2.6.1.18), la MISMA
     *        ventana que ya usa la propia detección de degradación
     *        (`_evaluateCalibration()` arriba) -- y exige el mismo
     *        mínimo (`DegradationDetection.MIN_SAMPLE_FOR_DETECTION`,
     *        sección 5: "mismo requisito mínimo establecido para
     *        detectar degradación").
     *   6.   offset candidato = offset actual + Bias reciente
     *        (`RecalibrationAlertRules.suggestOffsetHours()`, 2.6.1.21
     *        -- sección 3 prohíbe explícitamente inventar un algoritmo
     *        nuevo; esta fórmula ya existente reproduce EXACTAMENTE el
     *        ejemplo numérico de esa misma sección: 0.6h + 1.8h = 2.4h).
     *   7.   simulación obligatoria sobre la MISMA muestra --
     *        `simulateProposedOffset()` (2.6.1.24) sin cambios.
     *   8.   ACTUAL vs. PROPUESTA -- reutiliza el clasificador
     *        multi-métrica de 2.6.1.27
     *        (`PostActivationEvaluation.classifyPostActivationResult()`,
     *        nunca una sola métrica basta, sección 6). Solo `IMPROVEMENT`
     *        continúa; cualquier otro resultado aborta SIN escribir nada
     *        (sección 6: "si la simulación no demuestra una mejora [...]
     *        no se generará ninguna propuesta").
     *   9-10. crear la propuesta (`createReplacement()`, 2.6.1.19, nace
     *        PROPOSED -- sección 7: nunca se activa automáticamente) y
     *        asociarla al evento (`attachProposal()`), ambas dentro de
     *        la MISMA transacción (sección 13).
     *
     * Auditoría (sección 14): reutiliza `createdAt`/`createdBy`/
     * `sampleSize`/`biasHours`/`reason`/`parentCalibrationId`, todos
     * campos YA existentes en `MaturationModelCalibration` desde
     * 2.6.1.16/19 -- nunca se fabrican columnas nuevas solo para
     * repetir lo que la propia calibración ya registra. El único dato
     * verdaderamente nuevo (sección 14: "esto permitirá distinguir
     * [...] propuesta automática [vs.] manual") es la fila de auditoría
     * `GENERATE_RECALIBRATION_PROPOSAL_FROM_DEGRADATION` -- mismo
     * mecanismo único que ya usan CREATE_RECALIBRATION_PROPOSAL/
     * APPROVE_.../REJECT_.../ACTIVATE_... (2.6.1.23/24/25), nunca un
     * segundo mecanismo de auditoría paralelo.
     */
    async generateProposal(degradationEventId, { userId } = {}) {

        const event =
            await this.degradationEventRepository.findById(degradationEventId);

        if (!event) {

            throw new Error("Degradation event not found");

        }

        if (event.status === "RESOLVED") {

            throw new Error("No se puede generar una propuesta a partir de un evento de degradación ya resuelto.");

        }

        // Sección 9 -- como máximo una propuesta activa (PROPOSED o
        // APPROVED) por alerta. Una propuesta REJECTED no bloquea una
        // nueva solicitud explícita (que es, precisamente, esta misma
        // llamada); ACTIVE/INACTIVE tampoco (ya pasó por el flujo
        // completo de aprobación, no hay ambigüedad que evitar).
        if (event.proposalId) {

            const existingProposal =
                await this.calibrationRepository.findById(event.proposalId);

            if (existingProposal && (existingProposal.status === "PROPOSED" || existingProposal.status === "APPROVED")) {

                throw new Error(

                    `Esta alerta de degradación ya tiene una propuesta activa (calibración #${existingProposal.id}, estado ${existingProposal.status}). Solo puede generarse una nueva si esa propuesta es rechazada.`

                );

            }

        }

        const calibration =
            await this._requireCalibration(event.calibrationId);

        const health =
            await this.effectivenessService.getHealth(calibration.id);

        if (health.recent.sampleSize < DegradationDetection.MIN_SAMPLE_FOR_DETECTION) {

            throw new Error(

                `Muestra insuficiente para generar una propuesta -- se requieren al menos ${DegradationDetection.MIN_SAMPLE_FOR_DETECTION} predicciones evaluables recientes (hay ${health.recent.sampleSize}).`

            );

        }

        const candidateOffsetHours =
            RecalibrationAlertRules.suggestOffsetHours(calibration.offsetHours, health.recent.biasHours);

        if (candidateOffsetHours === null) {

            throw new Error("No se pudo calcular un offset candidato: falta el offset actual o el Bias reciente.");

        }

        const simulated =
            await this.effectivenessService.simulateProposedOffset(calibration.id, candidateOffsetHours);

        const comparison =
            PostActivationEvaluation.classifyPostActivationResult(simulated, health.recent);

        if (comparison.result !== "IMPROVEMENT") {

            throw new Error("La simulación no muestra una mejora real frente al desempeño actual de la calibración -- no se genera ninguna propuesta. La alerta de degradación permanece abierta.");

        }

        return await this.transactional(async t => {

            const proposal =
                await this.calibrationService.createReplacement(calibration.id, {

                    offsetHours: candidateOffsetHours,

                    sampleSize: health.recent.sampleSize,

                    biasHours: health.recent.biasHours,

                    reason: `Propuesta generada automáticamente a partir de la alerta de degradación #${event.id} (incremento de MAE de ${event.degradationPercentage}% sobre el umbral configurado de ${event.thresholdPercentage}%).`,

                    createdBy: userId || null

                }, t);

            await this.degradationEventRepository.attachProposal(event.id, proposal.id, t);

            await this.auditLogRepository.log({

                userId: userId || null,

                action: "GENERATE_RECALIBRATION_PROPOSAL_FROM_DEGRADATION",

                degradationEventId: event.id,

                sourceCalibrationId: calibration.id,

                targetCalibrationId: proposal.id

            }, t);

            return {

                proposal,

                comparison,

                candidateOffsetHours,

                sampleSize: health.recent.sampleSize

            };

        });

    }

}

module.exports =
    CalibrationDegradationService;
