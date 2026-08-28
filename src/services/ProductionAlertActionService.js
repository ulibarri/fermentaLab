const ProductionAlertActionRepository =
    require("../repositories/ProductionAlertActionRepository");

const ProductionPredictionAlertRepository =
    require("../repositories/ProductionPredictionAlertRepository");

const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const MaturationPredictionRepository =
    require("../repositories/MaturationPredictionRepository");

const ProductionAlertActionCatalog =
    require("../utils/ProductionAlertActionCatalog");

const ActionEffectiveness =
    require("../utils/ActionEffectiveness");

/*
 * Entrega 2.7.0.5 -- "registro de acciones operativas ante alertas".
 * Entrega 2.7.0.6 -- "análisis de efectividad de las acciones
 * operativas", agregada sobre el mismo servicio (misma entidad, capa
 * conceptualmente continua: primero se registra la acción, después se
 * observa qué pasó).
 *
 * Capa deliberadamente de SOLO REGISTRO/CONSULTA/OBSERVACIÓN: nunca
 * modifica mediciones (sección 10 de 2.7.0.5, reafirmado en sección 15
 * de 2.7.0.6), nunca modifica predicciones (sección 11/15), nunca
 * cambia el estado productivo del lote, y nunca resuelve ni cierra una
 * alerta (sección 16 de 2.7.0.5 -- eso sigue dependiendo exclusivamente
 * de ProductionPredictionAlertService.evaluateForBatch(), 2.7.0.3).
 * Tampoco modifica umbrales de alerta ni calibraciones/modelos (sección
 * 15 de 2.7.0.6). Esta clase solo sabe: "una alerta existe, un lote
 * existe, aquí hay una acción documentada -- y, más adelante, aquí está
 * lo que FermentaLab observó después de esa acción". Nunca infiere
 * causalidad (sección 2 de 2.7.0.6, explícito) -- ver
 * ActionEffectiveness.js para la única lógica de clasificación.
 */
class ProductionAlertActionService {

    constructor() {

        this.actionRepository =
            new ProductionAlertActionRepository();

        this.alertRepository =
            new ProductionPredictionAlertRepository();

        this.batchRepository =
            new ProductionBatchRepository();

        this.predictionRepository =
            new MaturationPredictionRepository();

    }

    _serialize(record) {

        return {

            id: record.id,

            alertId: record.alertId,

            type: record.type,

            typeLabel: ProductionAlertActionCatalog.typeLabel(record.type),

            description: record.description ?? null,

            expectedResult: record.expectedResult ?? null,

            notes: record.notes ?? null,

            createdBy: record.createdBy ?? null,

            createdAt: record.createdAt,

            // --- Entrega 2.7.0.6, sección 3 -- fotografía capturada al
            // registrar la acción (inmutable, ver createAction()).
            alertSeverityAtAction: record.alertSeverityAtAction ?? null,

            deviationMinutesAtAction: record.deviationMinutesAtAction ?? null,

            predictionIdAtAction: record.predictionIdAtAction ?? null,

            predictedFinishAtAction: record.predictedFinishAtAction ?? null,

            // --- Entrega 2.7.0.6, sección 11/16 -- resultado de la
            // evaluación posterior (único resultado persistido, el más
            // reciente).
            effectivenessStatus: record.effectivenessStatus || "PENDING",

            effectivenessEvaluatedAt: record.effectivenessEvaluatedAt ?? null,

            deviationMinutesAfter: record.deviationMinutesAfter ?? null,

            severityAfter: record.severityAfter ?? null,

            predictionIdAfter: record.predictionIdAfter ?? null,

            // Sección 9/17 -- "Cambio: -3h 10m" del mockup, derivado de
            // los dos valores ya persistidos (nunca un tercer campo
            // separado que pudiera desincronizarse).
            changeMinutes: ActionEffectiveness.changeMinutes(record.deviationMinutesAtAction, record.deviationMinutesAfter)

        };

    }

    /*
     * Sección 14 (2.7.0.5) -- validaciones de backend, nunca confiar
     * solo en la validación de JavaScript del formulario:
     *   1) que la alerta exista;
     *   2) que el lote relacionado exista;
     *   3) que el tipo de acción sea válido;
     *   4) que los campos obligatorios estén presentes (descripción si
     *      type = OTHER).
     * "que el usuario pueda registrar acciones" (sección 14, tercer
     * punto) no se implementa como una verificación de permisos --
     * FermentaLab no tiene todavía ningún sistema de autenticación/
     * sesión real en ningún otro punto del proyecto (sección 6:
     * "debe utilizarse el mecanismo de usuario/autenticación que ya
     * tenga FermentaLab" -- ese mecanismo, en toda la base de código, es
     * un campo `createdBy` de texto libre opcional, nunca un login).
     * Judgment call, flagged.
     *
     * Entrega 2.7.0.6, sección 3 -- además de crear la fila, captura la
     * "fotografía" del estado del lote EN ESE MOMENTO (severidad/
     * desviación/predicción vigente de la alerta ya cargada arriba para
     * la validación -- ninguna consulta adicional). `effectivenessStatus`
     * nace en "PENDING" (default de columna, nunca se estampa aquí
     * explícitamente para no duplicar la fuente de verdad del default).
     */
    async createAction(alertId, { type, description, expectedResult, notes, createdBy } = {}) {

        const alert =
            await this.alertRepository.findById(alertId);

        if (!alert) {

            throw new Error("Alert not found");

        }

        const batch =
            await this.batchRepository.findById(alert.productionBatchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        const validation =
            ProductionAlertActionCatalog.validate({ type, description });

        if (!validation.valid) {

            throw new Error(validation.errors.join(" "));

        }

        const created =
            await this.actionRepository.create({

                alertId: Number(alertId),

                productionBatchId: alert.productionBatchId,

                type,

                description: description ? String(description).trim() : null,

                expectedResult: expectedResult ? String(expectedResult).trim() : null,

                notes: notes ? String(notes).trim() : null,

                createdBy: createdBy ? String(createdBy).trim() : null,

                // Sección 3 -- fotografía inmutable del momento de creación.
                alertSeverityAtAction: alert.severity,

                deviationMinutesAtAction: alert.deviationMinutes,

                predictionIdAtAction: alert.predictionId,

                predictedFinishAtAction: alert.predictedFinishAt ?? null

            });

        return this._serialize(created);

    }

    /*
     * Sección 12/18 -- todas las acciones de una alerta, cronológicas.
     * Alerta sin acciones -> array vacío, nunca un error (sección 8:
     * "Alerta -> Sin acciones es perfectamente válido").
     */
    async getHistory(alertId) {

        const alert =
            await this.alertRepository.findById(alertId);

        if (!alert) {

            throw new Error("Alert not found");

        }

        const rows =
            await this.actionRepository.findByAlert(alertId);

        return {

            alertId: Number(alertId),

            actions: rows.map(r => this._serialize(r))

        };

    }

    /*
     * Entrega 2.7.0.6, secciones 4/8/13/14 -- punto de entrada de la
     * evaluación automática. Se llama desde el MISMO lugar donde ya se
     * dispara ProductionPredictionAlertService.evaluateForBatch()
     * (justo después de generatePrediction(), en
     * ProductionMeasurementService.createForBatch()) -- "cuando aparezca
     * una nueva predicción... evaluar acción pendiente".
     *
     * Flujo:
     *   1. Resuelve la predicción VIGENTE del lote (isCurrent=true). Sin
     *      predicción vigente todavía, no hay nada que evaluar.
     *   2. Busca las acciones PENDING de ese lote (sección 13 -- las que
     *      ya tienen un resultado persistido nunca se recalculan
     *      retroactivamente, sección 11).
     *   3. Descarta las que ya fueron creadas DESPUÉS de la predicción
     *      vigente actual (`predictionIdAtAction === current.id`) -- esa
     *      acción todavía no tuvo ninguna predicción nueva desde que se
     *      registró, así que sigue PENDING (sección 4: el disparador es
     *      justamente que exista una predicción MÁS NUEVA que la que
     *      tenía la acción al crearse).
     *   4. Para las restantes, compara contra el estado ACTUAL del lote
     *      (alerta activa, si existe) -- nunca contra la alerta
     *      ESPECÍFICA a la que la acción está vinculada, que pudo ya
     *      haberse resuelto entretanto (sección 2: esto es
     *      deliberadamente observacional sobre "cómo está el lote
     *      ahora", no una atribución a un episodio concreto -- ver
     *      judgment call documentado en el resumen de la entrega).
     */
    async evaluatePendingActionsForBatch(batchId, { minimumImprovementMinutes } = {}) {

        const currentPrediction =
            await this.predictionRepository.findCurrentByBatch(batchId);

        if (!currentPrediction) {

            return [];

        }

        const pendingActions =
            await this.actionRepository.findPendingByBatch(batchId);

        const toEvaluate =
            pendingActions.filter(action => action.predictionIdAtAction !== currentPrediction.id);

        if (toEvaluate.length === 0) {

            return [];

        }

        const activeAlert =
            await this.alertRepository.findActiveByBatch(batchId);

        const alertStillActive =
            Boolean(activeAlert);

        // Sección 6 -- sin alerta activa, la condición se considera
        // NORMAL (dentro de rango); no se fabrica una cifra de
        // desviación que el sistema de alertas no calculó de forma
        // independiente para este momento exacto (ver judgment call en
        // el resumen de la entrega).
        const deviationMinutesAfter =
            alertStillActive ? activeAlert.deviationMinutes : null;

        const severityAfter =
            alertStillActive ? activeAlert.severity : "NORMAL";

        const evaluatedAt =
            new Date();

        const results =
            [];

        for (const action of toEvaluate) {

            const status =
                ActionEffectiveness.classify({

                    deviationMinutesBefore: action.deviationMinutesAtAction,

                    deviationMinutesAfter,

                    alertStillActive,

                    ...(minimumImprovementMinutes !== undefined ? { minimumImprovementMinutes } : {})

                });

            const updated =
                await this.actionRepository.update(action.id, {

                    effectivenessStatus: status,

                    effectivenessEvaluatedAt: evaluatedAt,

                    deviationMinutesAfter,

                    severityAfter,

                    predictionIdAfter: currentPrediction.id

                });

            results.push(this._serialize(updated));

        }

        return results;

    }

}

module.exports =
    ProductionAlertActionService;
