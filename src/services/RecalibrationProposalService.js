const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const MaturationModelAlertRepository =
    require("../repositories/MaturationModelAlertRepository");

const MaturationModelConfigurationRepository =
    require("../repositories/MaturationModelConfigurationRepository");

const MaturationModelCalibrationService =
    require("./MaturationModelCalibrationService");

const CalibrationEffectivenessService =
    require("./CalibrationEffectivenessService");

const MaturationAlertAuditLogRepository =
    require("../repositories/MaturationAlertAuditLogRepository");

/*
 * Gestión y aprobación de propuestas de recalibración (Entrega
 * 2.6.1.24) -- completa el flujo de revisión humana que 2.6.1.21/23
 * dejaron abierto: una vez que existe una propuesta PROPOSED, alguien
 * tiene que poder verla en contexto (por qué se creó, cómo se compara
 * contra la calibración actual) y decidir explícitamente si se
 * aprueba o se rechaza. Esta entrega NUNCA activa la calibración
 * aprobada (sección 13) -- eso queda para 2.6.1.25.
 *
 * Puramente orquestador, mismo criterio que ModelAlertService
 * (2.6.1.21/22/23): compone servicios/repositorios ya existentes,
 * nunca reimplementa ninguno de sus cálculos. En particular, la
 * validación de transición de estado (solo PROPOSED puede aprobarse/
 * rechazarse) vive ÚNICAMENTE en
 * MaturationModelCalibrationService.approve()/reject() (existe desde
 * 2.6.1.16) -- este servicio no la duplica.
 *
 * Definición operativa de "propuesta de recalibración" en este modelo
 * de datos: toda MaturationModelCalibration con `parentCalibrationId`
 * no nulo (ver el comentario de
 * MaturationModelCalibrationRepository.findRecalibrationProposals()).
 * Una calibración de primera versión (sin padre, creada manualmente
 * desde /maturation/calibrations) no es una "propuesta de
 * recalibración" en el sentido de esta entrega -- _requireProposal()
 * la rechaza explícitamente.
 */
class RecalibrationProposalService {

    constructor() {

        this.calibrationRepository =
            new MaturationModelCalibrationRepository();

        this.alertRepository =
            new MaturationModelAlertRepository();

        this.modelConfigurationRepository =
            new MaturationModelConfigurationRepository();

        this.calibrationService =
            new MaturationModelCalibrationService();

        this.effectivenessService =
            new CalibrationEffectivenessService();

        this.auditLogRepository =
            new MaturationAlertAuditLogRepository();

    }

    async _requireProposal(id) {

        const record =
            await this.calibrationRepository.findProposalWithContext(id);

        if (!record) {

            throw new Error("Recalibration proposal not found");

        }

        if (record.parentCalibrationId === null || record.parentCalibrationId === undefined) {

            throw new Error("Esta calibración no es una propuesta de recalibración -- no tiene una calibración origen.");

        }

        return record;

    }

    /*
     * Resuelve el modelConfigurationId (para auditoría y para el
     * enlace "Ver desempeño del modelo") a partir del (modelType,
     * recipeVersionId) de la propuesta -- solo puede haber un modelo
     * ACTIVE por recipeVersion a la vez (2.6.1.11), así que si existe
     * coincide por construcción con el modelType de la propuesta.
     */
    async _resolveModelConfigurationId(recipeVersionId) {

        const active =
            await this.modelConfigurationRepository.findActiveByRecipeVersion(recipeVersionId);

        return active ? active.id : null;

    }

    _productAndRecipe(recipeVersion) {

        const recipe =
            recipeVersion ? recipeVersion.recipe : null;

        const product =
            recipe ? recipe.product : null;

        return {

            product: product ? { id: product.id, name: product.name } : null,

            recipe: recipe ? { id: recipe.id, name: recipe.name } : null,

            recipeVersion: recipeVersion ? { id: recipeVersion.id, version: recipeVersion.version } : null

        };

    }

    _serializeSummary(record) {

        const { product, recipe, recipeVersion } =
            this._productAndRecipe(record.recipeVersion);

        return {

            id: record.id,

            createdAt: record.createdAt,

            modelType: record.modelType,

            product,

            recipe,

            recipeVersion,

            sourceCalibration: record.parentCalibration ? {

                id: record.parentCalibration.id,

                version: record.parentCalibration.version

            } : null,

            proposedVersion: record.version,

            status: record.status,

            createdBy: record.createdBy ?? null

        };

    }

    /*
     * Sección 2/3 -- listado con filtros. Refleja tal cual lo que
     * devuelve el repositorio (más reciente primero) más la
     * serialización de contexto.
     */
    async list(filters = {}) {

        const rows =
            await this.calibrationRepository.findRecalibrationProposals(filters);

        return rows.map(record => this._serializeSummary(record));

    }

    /*
     * Sección 4/5/6 -- detalle completo: calibración origen + propuesta
     * + comparación de métricas + alerta origen + qué métricas
     * justificaron la propuesta. Nunca escribe nada.
     */
    async getDetail(id) {

        const proposal =
            await this._requireProposal(id);

        const source =
            proposal.parentCalibration;

        const { product, recipe, recipeVersion } =
            this._productAndRecipe(proposal.recipeVersion);

        // Sección 6 -- la alerta que originó esta propuesta es la más
        // reciente que apunta a la calibración ORIGEN (ver el
        // comentario de findMostRecentByCalibration()).
        const originAlert =
            source ? await this.alertRepository.findMostRecentByCalibration(source.id) : null;

        let originAlertDetails =
            null;

        if (originAlert && originAlert.details) {

            try {

                originAlertDetails = JSON.parse(originAlert.details);

            } catch (err) {

                originAlertDetails = null;

            }

        }

        // Sección 5 -- comparación ACTUAL (salud real de la calibración
        // origen, reutilizando 2.6.1.18 sin cambios) vs. PROPUESTA
        // (simulación sobre la MISMA ventana reciente, 2.6.1.24 nuevo
        // -- ver CalibrationEffectivenessService.simulateProposedOffset()).
        let comparison =
            null;

        if (source) {

            const [health, simulated] =
                await Promise.all([

                    this.effectivenessService.getHealth(source.id),

                    this.effectivenessService.simulateProposedOffset(source.id, proposal.offsetHours)

                ]);

            comparison = {

                actual: {

                    historical: health.historical,

                    recent: health.recent,

                    health: health.health,

                    trend: health.trend,

                    recommendRecalibration: health.recommendRecalibration,

                    period: {

                        from: source.activatedAt ?? null,

                        to: new Date()

                    }

                },

                proposed: {

                    simulated

                }

            };

        }

        const modelId =
            await this._resolveModelConfigurationId(proposal.recipeVersionId);

        return {

            id: proposal.id,

            modelType: proposal.modelType,

            modelId,

            product,

            recipe,

            recipeVersion,

            sourceCalibration: source ? {

                id: source.id,

                version: source.version,

                status: source.status,

                offsetHours: source.offsetHours !== null && source.offsetHours !== undefined ? Number(source.offsetHours) : null,

                activatedAt: source.activatedAt

            } : null,

            proposedVersion: proposal.version,

            offsetHours: proposal.offsetHours !== null && proposal.offsetHours !== undefined ? Number(proposal.offsetHours) : null,

            status: proposal.status,

            reason: proposal.reason,

            createdBy: proposal.createdBy ?? null,

            createdAt: proposal.createdAt,

            approvedAt: proposal.approvedAt,

            approvedBy: proposal.approvedBy ?? null,

            rejectedAt: proposal.rejectedAt,

            rejectedBy: proposal.rejectedBy ?? null,

            rejectionReason: proposal.rejectionReason ?? null,

            // Entrega 2.6.1.25, sección 7.
            activatedAt: proposal.activatedAt,

            activatedBy: proposal.activatedBy ?? null,

            // Sección 5, último punto -- "métricas utilizadas para
            // generar la propuesta": el snapshot que
            // ModelAlertService._evaluateCondition() ya calculó y
            // congeló en la alerta (2.6.1.21), nunca recalculado aquí.
            justification: originAlertDetails,

            originAlert: originAlert ? {

                id: originAlert.id,

                severity: originAlert.severity,

                status: originAlert.status,

                createdAt: originAlert.createdAt

            } : null,

            comparison

        };

    }

    /*
     * Sección 7/9/10/12 -- aprobar. La validación de estado (solo
     * PROPOSED) vive en MaturationModelCalibrationService.approve(),
     * reutilizada sin cambios -- si la propuesta ya no está PROPOSED,
     * ese método lanza el error de negocio y esta capa nunca llega a
     * escribir auditoría.
     */
    async approve(id, { userId } = {}) {

        const proposal =
            await this._requireProposal(id);

        const updated =
            await this.calibrationService.approve(id, { approvedBy: userId || null });

        const modelId =
            await this._resolveModelConfigurationId(proposal.recipeVersionId);

        const originAlert =
            proposal.parentCalibrationId ? await this.alertRepository.findMostRecentByCalibration(proposal.parentCalibrationId) : null;

        await this.auditLogRepository.log({

            userId: userId || null,

            action: "APPROVE_RECALIBRATION_PROPOSAL",

            modelId,

            alertId: originAlert ? originAlert.id : null,

            sourceCalibrationId: proposal.parentCalibrationId,

            targetCalibrationId: proposal.id

        });

        return updated;

    }

    /*
     * Entrega 2.6.1.25, secciones 5/7/8/9/10 -- activar una propuesta ya
     * APPROVED. La transición de estado (solo desde APPROVED, sección
     * 10.4), la garantía de "como máximo una ACTIVE por (modelType,
     * recipeVersionId)" (sección 9) y el volcado ACTIVE->INACTIVE de la
     * calibración anterior son TODOS reutilizados sin cambios de
     * `MaturationModelCalibrationService.activate()` (existe desde
     * 2.6.1.16, ya corre dentro de una transacción) -- este método solo
     * agrega `_requireProposal()` (secciones 10.2/10.3: debe
     * corresponder a una propuesta con `parentCalibrationId`) y el
     * efecto de auditoría (sección 8).
     *
     * `previousCalibrationId` se lee ANTES de llamar a
     * calibrationService.activate() (que internamente hace su propia
     * lectura, dentro de su transacción, para decidir qué desactivar)
     * -- sin lógica de concurrencia especial, per sección 10 del spec
     * ("no necesitamos agregar lógica específica de concurrencia"),
     * consistente con el resto de este arco.
     */
    async activate(id, { userId } = {}) {

        const proposal =
            await this._requireProposal(id);

        const previousActive =
            await this.calibrationRepository.findActiveByModelAndRecipeVersion(

                proposal.modelType,

                proposal.recipeVersionId

            );

        const updated =
            await this.calibrationService.activate(id, { activatedBy: userId || null });

        const modelId =
            await this._resolveModelConfigurationId(proposal.recipeVersionId);

        const originAlert =
            proposal.parentCalibrationId ? await this.alertRepository.findMostRecentByCalibration(proposal.parentCalibrationId) : null;

        await this.auditLogRepository.log({

            userId: userId || null,

            action: "ACTIVATE_RECALIBRATION",

            modelId,

            alertId: originAlert ? originAlert.id : null,

            targetCalibrationId: proposal.id,

            previousCalibrationId: previousActive ? previousActive.id : null

        });

        return updated;

    }

    /*
     * Sección 8/9/10/12 -- rechazar. A diferencia de approve(), aquí SÍ
     * hay una regla nueva y propia de este flujo ("no se permitirá
     * rechazarla sin motivo", sección 8) -- se valida ANTES de tocar
     * MaturationModelCalibrationService.reject() (que, deliberadamente,
     * no exige motivo por sí solo -- ver el comentario de ese método),
     * así que un intento sin motivo nunca llega a escribir nada, ni la
     * calibración ni la auditoría.
     */
    async reject(id, { userId, reason } = {}) {

        const proposal =
            await this._requireProposal(id);

        if (!reason || !String(reason).trim()) {

            throw new Error("El motivo de rechazo es obligatorio.");

        }

        const trimmedReason =
            String(reason).trim();

        const updated =
            await this.calibrationService.reject(id, { rejectedBy: userId || null, rejectionReason: trimmedReason });

        const modelId =
            await this._resolveModelConfigurationId(proposal.recipeVersionId);

        const originAlert =
            proposal.parentCalibrationId ? await this.alertRepository.findMostRecentByCalibration(proposal.parentCalibrationId) : null;

        await this.auditLogRepository.log({

            userId: userId || null,

            action: "REJECT_RECALIBRATION_PROPOSAL",

            modelId,

            alertId: originAlert ? originAlert.id : null,

            sourceCalibrationId: proposal.parentCalibrationId,

            targetCalibrationId: proposal.id,

            reason: trimmedReason

        });

        return updated;

    }

}

module.exports =
    RecalibrationProposalService;
