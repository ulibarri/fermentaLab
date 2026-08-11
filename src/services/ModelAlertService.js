const MaturationModelConfigurationRepository =
    require("../repositories/MaturationModelConfigurationRepository");

const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const MaturationModelAlertRepository =
    require("../repositories/MaturationModelAlertRepository");

const MaturationModelCalibrationService =
    require("./MaturationModelCalibrationService");

const CalibrationEffectivenessService =
    require("./CalibrationEffectivenessService");

const RecalibrationAlertRules =
    require("../utils/RecalibrationAlertRules");

const MaturationAlertAuditLogRepository =
    require("../repositories/MaturationAlertAuditLogRepository");

/*
 * Alertas y recomendaciones de recalibración (Entrega 2.6.1.21).
 *
 * Puramente orquestador: detecta la condición actual de un modelo
 * (reutilizando `CalibrationEffectivenessService.getHealth()`, 2.6.1.18,
 * y `RecalibrationAlertRules`, módulo puro de esta misma entrega),
 * decide si corresponde abrir/actualizar/resolver una fila en
 * `maturation_model_alerts`, y delega la creación de la propuesta de
 * recalibración en `MaturationModelCalibrationService.createReplacement()`
 * (2.6.1.19) -- nunca reimplementa ninguno de esos cálculos ni toca el
 * motor de predicción/calibración/activación (criterio de aceptación
 * #24).
 *
 * `getAlerts()` es, a propósito, el único punto de entrada que corre la
 * detección -- se ejecuta cada vez que el usuario abre el dashboard
 * (sección 9: "no se deberá crear una nueva alerta idéntica cada vez
 * que el usuario abra el dashboard"), por eso la deduplicación ocurre
 * ahí mismo en vez de en un endpoint de "evaluar" separado (a
 * diferencia de `CalibrationEffectivenessService.evaluate()` vs.
 * `evaluateAndStore()`, 2.6.1.17/18, que sí separan lectura de
 * persistencia -- aquí el propio GET es quien debe persistir para poder
 * cumplir la regla de "una condición activa, una sola alerta abierta").
 */
class ModelAlertService {

    constructor() {

        this.modelConfigurationRepository =
            new MaturationModelConfigurationRepository();

        this.calibrationRepository =
            new MaturationModelCalibrationRepository();

        this.alertRepository =
            new MaturationModelAlertRepository();

        this.calibrationService =
            new MaturationModelCalibrationService();

        this.effectivenessService =
            new CalibrationEffectivenessService();

        this.auditLogRepository =
            new MaturationAlertAuditLogRepository();

    }

    async _requireModelConfiguration(modelId) {

        const modelConfig =
            await this.modelConfigurationRepository.findById(modelId);

        if (!modelConfig) {

            throw new Error("Model configuration not found");

        }

        return modelConfig;

    }

    _sameCalibration(a, b) {

        const na =
            a === null || a === undefined ? null : Number(a);

        const nb =
            b === null || b === undefined ? null : Number(b);

        return na === nb;

    }

    /*
     * Arma la condición ACTUAL del modelo -- severidad, tipo, mensaje
     * explicativo (sección 7) y un snapshot de las métricas que la
     * originaron (sección 7, "auditable"). Nunca persiste nada por sí
     * sola -- eso lo decide `getAlerts()`.
     */
    async _evaluateCondition(modelConfig) {

        const target =
            await this.calibrationRepository.findActiveByModelAndRecipeVersion(

                modelConfig.modelType,

                modelConfig.recipeVersionId

            );

        if (!target) {

            const classification =
                RecalibrationAlertRules.classify({ hasCalibration: false });

            const message =
                RecalibrationAlertRules.buildMessage({ severity: classification.severity });

            return {

                calibrationId: null,

                severity: classification.severity,

                type: classification.type,

                message,

                detailsJson: null

            };

        }

        const health =
            await this.effectivenessService.getHealth(target.id);

        const classification =
            RecalibrationAlertRules.classify({

                hasCalibration: true,

                calibrationHealth: health.health,

                trend: health.trend,

                recommendRecalibration: health.recommendRecalibration,

                sampleSize: health.recent.sampleSize,

                maeHistorical: health.historical.maeHours,

                maeRecent: health.recent.maeHours,

                biasHistorical: health.historical.biasHours,

                biasRecent: health.recent.biasHours,

                rmseHistorical: health.historical.rmseHours,

                rmseRecent: health.recent.rmseHours

            });

        const message =
            RecalibrationAlertRules.buildMessage({

                severity: classification.severity,

                maeHistorical: health.historical.maeHours,

                maeRecent: health.recent.maeHours,

                biasIncreased: classification.signals.biasIncreased,

                rmseIncreased: classification.signals.rmseIncreased,

                calibrationHealth: health.health

            });

        // Sección 14: los mismos datos que necesita el modal "Nueva
        // calibración" (offset actual/sugerido, muestras) ya se
        // calculan aquí -- el frontend no necesita una segunda
        // consulta para mostrar la vista previa antes de confirmar.
        const offsetSuggested =
            RecalibrationAlertRules.suggestOffsetHours(target.offsetHours, health.recent.biasHours);

        // Entrega 2.6.1.23, secciones 4/5 -- si ya existe una propuesta
        // PROPOSED derivada de esta calibración origen, se expone aquí
        // para que el frontend pueda mostrar el seguimiento ("Calibración
        // origen: v2 / Nueva propuesta: v3 / Estado: PROPOSED") y
        // deshabilitar el botón de crear otra ANTES de que el usuario
        // intente duplicarla -- el 409 del endpoint sigue siendo la
        // garantía real (createRecalibrationProposal() la revalida por
        // su cuenta), esto es solo para que la UI no invite a un intento
        // que ya sabemos que va a fallar.
        const linkedProposal =
            await this.calibrationRepository.findProposedByParent(target.id);

        const details = {

            modelType: target.modelType,

            recipeVersionId: target.recipeVersionId,

            calibrationId: target.id,

            calibrationVersion: target.version,

            offsetHours: target.offsetHours !== null && target.offsetHours !== undefined ? Number(target.offsetHours) : null,

            offsetSuggested,

            health: health.health,

            trend: health.trend,

            recommendRecalibration: health.recommendRecalibration,

            sampleSize: health.recent.sampleSize,

            maeHistorical: health.historical.maeHours,

            maeRecent: health.recent.maeHours,

            biasHistorical: health.historical.biasHours,

            biasRecent: health.recent.biasHours,

            rmseHistorical: health.historical.rmseHours,

            rmseRecent: health.recent.rmseHours,

            signals: classification.signals,

            linkedProposal: linkedProposal ? {

                id: linkedProposal.id,

                version: linkedProposal.version,

                status: linkedProposal.status

            } : null

        };

        return {

            calibrationId: target.id,

            severity: classification.severity,

            type: classification.type,

            message,

            detailsJson: JSON.stringify(details)

        };

    }

    /*
     * Punto de entrada principal -- GET /api/maturation/models/:modelId/alerts
     * (sección 12). Corre la detección, aplica la regla de
     * deduplicación (sección 9) y devuelve tanto la alerta vigente
     * (si existe) como el historial completo (sección 8/16).
     */
    async getAlerts(modelId) {

        const modelConfig =
            await this._requireModelConfiguration(modelId);

        const condition =
            await this._evaluateCondition(modelConfig);

        const openRows =
            await this.alertRepository.findOpenOrAcknowledgedByModel(modelConfig.id);

        // Cualquier fila abierta que ya NO corresponda a la calibración
        // vigente del modelo (fue reemplazada/desactivada desde que se
        // abrió) deja de ser una condición activa -- se resuelve
        // automáticamente (también cubre, defensivamente, duplicados
        // accidentales de la misma calibración: solo la más reciente se
        // conserva como "actual").
        let currentRow =
            null;

        for (const row of openRows) {

            if (!currentRow && this._sameCalibration(row.calibrationId, condition.calibrationId)) {

                currentRow = row;

            } else {

                await this.alertRepository.resolve(row.id);

            }

        }

        let current =
            null;

        if (condition.severity === "INFO") {

            // Sección 9: la condición desapareció -- OPEN/ACKNOWLEDGED
            // -> RESOLVED. INFO nunca se persiste como fila nueva.
            if (currentRow) {

                await this.alertRepository.resolve(currentRow.id);

            }

        } else if (currentRow) {

            // Misma condición sigue activa (o escaló/desescaló de
            // severidad, ej. WARNING -> CRITICAL) -- se actualiza EN
            // EL LUGAR, nunca se crea una segunda fila (sección 9).
            current =
                await this.alertRepository.updateCondition(currentRow.id, {

                    calibrationId: condition.calibrationId,

                    severity: condition.severity,

                    type: condition.type,

                    message: condition.message,

                    details: condition.detailsJson

                });

        } else {

            // Sección 17: no había ninguna alerta abierta para esta
            // condición (nunca existió, o la anterior ya fue resuelta)
            // -- se abre una nueva.
            current =
                await this.alertRepository.create({

                    modelConfigurationId: modelConfig.id,

                    calibrationId: condition.calibrationId,

                    severity: condition.severity,

                    type: condition.type,

                    message: condition.message,

                    details: condition.detailsJson

                });

        }

        const history =
            await this.alertRepository.findAllByModel(modelConfig.id);

        return {

            modelId: modelConfig.id,

            current: current ? this._serialize(current) : null,

            infoMessage: current ? null : condition.message,

            history: history.map(record => this._serialize(record))

        };

    }

    /*
     * Entrega 2.6.1.22, secciones 1/9 -- corre la detección (2.6.1.21)
     * sobre TODOS los modelos ACTIVE, no solo el que el usuario tenga
     * abierto en el dashboard. Es lo que convierte el centro de
     * alertas en una herramienta de verdad "global": sin esto, un
     * modelo cuyo dashboard nadie ha visitado nunca aparecería aquí,
     * aunque ya llevara días degradándose. Un modelo con datos
     * inconsistentes nunca debe tumbar el refresco de los demás --
     * cada uno se evalúa en su propio try/catch.
     *
     * Alcance deliberado: solo modelos ACTIVE (no INACTIVE/histórico)
     * -- un modelConfiguration INACTIVE ya no recibe predicciones
     * nuevas, así que su condición nunca puede cambiar; sus alertas ya
     * persistidas se siguen viendo en el historial, solo no se
     * re-evalúan en cada carga. Judgment call: si el usuario quiere
     * que también se re-evalúen modelos INACTIVE, es un cambio de una
     * línea en el `where` de abajo.
     */
    async _fetchActiveModelConfigsWithContext() {

        return await this.modelConfigurationRepository.findAll({

            where: { status: "ACTIVE" },

            include: [

                {

                    association: "recipeVersion",

                    include: [

                        {

                            association: "recipe",

                            include: [

                                {

                                    association: "product"

                                }

                            ]

                        }

                    ]

                }

            ]

        });

    }

    async refreshAll() {

        const activeModels =
            await this._fetchActiveModelConfigsWithContext();

        const results =
            [];

        for (const modelConfig of activeModels) {

            try {

                const alerts =
                    await this.getAlerts(modelConfig.id);

                results.push({ modelConfig, alerts, error: null });

            } catch (err) {

                results.push({ modelConfig, alerts: null, error: err.message });

            }

        }

        return results;

    }

    _matchesFilters(modelConfig, { productId, recipeVersionId, modelId } = {}) {

        if (modelId && Number(modelConfig.id) !== Number(modelId)) {

            return false;

        }

        if (recipeVersionId && Number(modelConfig.recipeVersionId) !== Number(recipeVersionId)) {

            return false;

        }

        if (productId) {

            const productIdOnModel =
                modelConfig.recipeVersion && modelConfig.recipeVersion.recipe
                    ? modelConfig.recipeVersion.recipe.productId
                    : null;

            if (Number(productIdOnModel) !== Number(productId)) {

                return false;

            }

        }

        return true;

    }

    /*
     * Entrega 2.6.1.22, sección 1 -- vista global: refresca todos los
     * modelos y devuelve las alertas (ya con contexto de producto/
     * receta/modelo/calibración) que matchean los filtros. `severity`/
     * `status`/`from`/`to` filtran filas de la tabla directamente
     * (sección 2/3); `productId`/`recipeVersionId`/`modelId` filtran a
     * través de las asociaciones (repositorio).
     */
    async listAlerts(filters = {}) {

        await this.refreshAll();

        const rows =
            await this.alertRepository.findAllFiltered(filters);

        return rows.map(record => this._serializeWithContext(record));

    }

    /*
     * Entrega 2.6.1.22, secciones 1/11 -- resumen global. `open`/
     * `acknowledged`/`resolved` cuentan FILAS persistidas (el ejemplo
     * de la sección 11, resolved:18, es claramente un conteo histórico
     * de alertas, no de modelos) y sí respetan el filtro de periodo.
     * `bySeverity`, en cambio, cuenta MODELOS según su condición EN
     * VIVO ahora mismo (uno de CRITICAL/WARNING/INSUFFICIENT_DATA/INFO
     * por modelo, mutuamente excluyentes) -- es la única forma de que
     * `info` tenga sentido, ya que INFO nunca se persiste como fila
     * (2.6.1.21, sección 9: "una condición activa genera una alerta";
     * la ausencia de condición no es una condición). Por la misma
     * razón, `bySeverity` deliberadamente IGNORA el filtro de periodo
     * -- "ahora mismo" no admite rango de fechas.
     */
    async getSummary(filters = {}) {

        const refreshed =
            await this.refreshAll();

        const bySeverity =
            { critical: 0, warning: 0, info: 0, insufficientData: 0 };

        for (const entry of refreshed) {

            if (entry.error) {

                continue;

            }

            if (!this._matchesFilters(entry.modelConfig, filters)) {

                continue;

            }

            const severity =
                entry.alerts.current ? entry.alerts.current.severity : "INFO";

            if (severity === "CRITICAL") {

                bySeverity.critical++;

            } else if (severity === "WARNING") {

                bySeverity.warning++;

            } else if (severity === "INSUFFICIENT_DATA") {

                bySeverity.insufficientData++;

            } else {

                bySeverity.info++;

            }

        }

        const rows =
            await this.alertRepository.findAllFiltered({

                productId: filters.productId,

                recipeVersionId: filters.recipeVersionId,

                modelId: filters.modelId,

                from: filters.from,

                to: filters.to

            });

        return {

            open: rows.filter(r => r.status === "OPEN").length,

            acknowledged: rows.filter(r => r.status === "ACKNOWLEDGED").length,

            resolved: rows.filter(r => r.status === "RESOLVED").length,

            bySeverity

        };

    }

    /*
     * Entrega 2.6.1.22, secciones 4/7 -- detalle con todo el contexto
     * (nunca refresca -- la alerta ya existe, se lee tal cual está).
     */
    async getAlertDetail(id) {

        const record =
            await this.alertRepository.findByIdWithContext(id);

        if (!record) {

            throw new Error("Alert not found");

        }

        return this._serializeWithContext(record);

    }

    _serializeWithContext(record) {

        const modelConfig =
            record.modelConfiguration;

        const recipeVersion =
            modelConfig ? modelConfig.recipeVersion : null;

        const recipe =
            recipeVersion ? recipeVersion.recipe : null;

        const product =
            recipe ? recipe.product : null;

        const calibration =
            record.calibration;

        let details =
            null;

        if (record.details) {

            try {

                details = JSON.parse(record.details);

            } catch (err) {

                details = null;

            }

        }

        return {

            id: record.id,

            severity: record.severity,

            type: record.type,

            status: record.status,

            message: record.message,

            details,

            createdAt: record.createdAt,

            acknowledgedAt: record.acknowledgedAt,

            resolvedAt: record.resolvedAt,

            model: modelConfig ? {

                id: modelConfig.id,

                type: modelConfig.modelType,

                status: modelConfig.status,

                recipeVersionId: modelConfig.recipeVersionId

            } : null,

            product: product ? { id: product.id, name: product.name } : null,

            recipe: recipe ? { id: recipe.id, name: recipe.name } : null,

            recipeVersion: recipeVersion ? { id: recipeVersion.id, version: recipeVersion.version } : null,

            // Sección 7: solo lectura -- versión/estado/fecha de
            // activación/calibración origen/métricas relevantes (estas
            // últimas ya viajan en `details` de arriba, tomadas de la
            // misma calibración). Nunca se expone ningún medio de
            // modificarla desde aquí.
            calibration: calibration ? {

                id: calibration.id,

                version: calibration.version,

                status: calibration.status,

                offsetHours: calibration.offsetHours !== null && calibration.offsetHours !== undefined ? Number(calibration.offsetHours) : null,

                activatedAt: calibration.activatedAt,

                parentCalibrationId: calibration.parentCalibrationId ?? null,

                parentCalibrationVersion: calibration.parentCalibration ? calibration.parentCalibration.version : null

            } : null

        };

    }

    /*
     * Sección 10 -- "reconocer" (ACKNOWLEDGED) solo desde OPEN, nunca
     * implica que la condición esté resuelta.
     */
    async acknowledge(id, { userId } = {}) {

        const record =
            await this.alertRepository.findById(id);

        if (!record) {

            throw new Error("Alert not found");

        }

        if (record.status !== "OPEN") {

            throw new Error(

                `Solo se puede reconocer una alerta en estado OPEN (estado actual: ${record.status}).`

            );

        }

        const updated =
            await this.alertRepository.acknowledge(id);

        // Entrega 2.6.1.23, sección 6 -- auditoría de ACKNOWLEDGE_ALERT.
        await this.auditLogRepository.log({

            userId: userId ?? null,

            action: "ACKNOWLEDGE_ALERT",

            modelId: record.modelConfigurationId,

            alertId: record.id,

            sourceCalibrationId: record.calibrationId ?? null,

            targetCalibrationId: null

        });

        return this._serialize(updated);

    }

    /*
     * Sección 11 -- OPEN o ACKNOWLEDGED -> RESOLVED. Resolver
     * manualmente es una decisión explícita del usuario, distinta de
     * la resolución automática que `getAlerts()` aplica cuando la
     * condición desaparece por sí sola.
     */
    async resolve(id, { userId } = {}) {

        const record =
            await this.alertRepository.findById(id);

        if (!record) {

            throw new Error("Alert not found");

        }

        if (record.status === "RESOLVED") {

            throw new Error("La alerta ya está resuelta.");

        }

        const updated =
            await this.alertRepository.resolve(id);

        // Entrega 2.6.1.23, sección 6 -- auditoría de RESOLVE_ALERT.
        await this.auditLogRepository.log({

            userId: userId ?? null,

            action: "RESOLVE_ALERT",

            modelId: record.modelConfigurationId,

            alertId: record.id,

            sourceCalibrationId: record.calibrationId ?? null,

            targetCalibrationId: null

        });

        return this._serialize(updated);

    }

    /*
     * Sección 14/18/19/20/21 -- punto de integración con el versionado
     * de calibraciones (2.6.1.19): crea una propuesta de reemplazo de
     * la calibración ACTIVE actual del modelo, con el offset sugerido
     * ya calculado. SIEMPRE nace PROPOSED (nunca ACTIVE -- criterio de
     * aceptación #21, delegado por completo en
     * `MaturationModelCalibrationService.createReplacement()`, que ya
     * garantiza esto desde 2.6.1.19). No modifica ni reconoce ni
     * resuelve ninguna alerta por sí sola -- son acciones explícitas y
     * separadas del usuario (sección 10).
     */
    async createRecalibrationProposal(modelId, { reason, userId } = {}) {

        const modelConfig =
            await this._requireModelConfiguration(modelId);

        const target =
            await this.calibrationRepository.findActiveByModelAndRecipeVersion(

                modelConfig.modelType,

                modelConfig.recipeVersionId

            );

        if (!target) {

            throw new Error(

                "Este modelo no tiene ninguna calibración activa -- no hay una calibración origen desde la cual proponer un reemplazo."

            );

        }

        // Entrega 2.6.1.23, secciones 4/14 -- prevención de duplicados:
        // si ya existe una PROPOSED derivada de esta misma calibración
        // origen, no se crea una segunda equivalente. Se responde con un
        // error "marcado" (statusCode 409) para que el controller pueda
        // traducirlo al código HTTP correcto sin que este servicio sepa
        // nada de HTTP -- y se adjuntan los datos de la propuesta
        // existente para que el frontend pueda navegar hacia ella en vez
        // de solo mostrar un mensaje sin salida (criterio 14: "puede ser
        // consultada en lugar de duplicarse").
        const existingProposal =
            await this.calibrationRepository.findProposedByParent(target.id);

        if (existingProposal) {

            const error =
                new Error("Ya existe una propuesta de recalibración pendiente para este modelo.");

            error.statusCode =
                409;

            error.existingProposal = {

                id: existingProposal.id,

                version: existingProposal.version,

                status: existingProposal.status,

                sourceCalibrationId: target.id,

                sourceCalibrationVersion: target.version

            };

            throw error;

        }

        const health =
            await this.effectivenessService.getHealth(target.id);

        const currentOffsetHours =
            target.offsetHours !== null && target.offsetHours !== undefined ? Number(target.offsetHours) : null;

        const offsetSuggested =
            RecalibrationAlertRules.suggestOffsetHours(currentOffsetHours, health.recent.biasHours) ?? currentOffsetHours;

        // Entrega 2.6.1.23, criterio 5/6 -- `createdBy` (en la propia
        // calibración) y `userId` (en la fila de auditoría) reciben el
        // mismo valor: sin sistema de autenticación en este proyecto
        // todavía, es un campo de texto libre y opcional que el usuario
        // puede escribir en el modal de confirmación (mismo precedente
        // que `MaturationModelCalibration.createdBy` desde 2.6.1.16,
        // nunca antes tuvo un valor real).
        const created =
            await this.calibrationService.createReplacement(target.id, {

                offsetHours: offsetSuggested,

                sampleSize: health.recent.sampleSize,

                biasHours: health.recent.biasHours,

                reason: reason || `Propuesta generada desde una alerta de recalibración (Entrega 2.6.1.21). Calibración origen: v${target.version} (#${target.id}).`,

                createdBy: userId || null

            });

        // Sección 6 -- auditoría de CREATE_RECALIBRATION_PROPOSAL.
        await this.auditLogRepository.log({

            userId: userId || null,

            action: "CREATE_RECALIBRATION_PROPOSAL",

            modelId: modelConfig.id,

            sourceCalibrationId: target.id,

            targetCalibrationId: created.id

        });

        return created;

    }

    _serialize(record) {

        let details =
            null;

        if (record.details) {

            try {

                details = JSON.parse(record.details);

            } catch (err) {

                details = null;

            }

        }

        return {

            id: record.id,

            modelConfigurationId: record.modelConfigurationId,

            calibrationId: record.calibrationId ?? null,

            severity: record.severity,

            type: record.type,

            status: record.status,

            message: record.message,

            details,

            createdAt: record.createdAt,

            acknowledgedAt: record.acknowledgedAt,

            resolvedAt: record.resolvedAt

        };

    }

}

module.exports =
    ModelAlertService;
