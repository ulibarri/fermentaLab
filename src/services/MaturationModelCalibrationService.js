const BaseService =
    require("./BaseService");

const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const RecipeVersionRepository =
    require("../repositories/RecipeVersionRepository");

const { isValidModelType, AVAILABLE_MODEL_TYPES } =
    require("../utils/MaturationModelTypes");

/*
 * Gestión y activación de calibraciones (Entrega 2.6.1.16).
 *
 * Separa DETECTAR un sesgo (2.6.1.15, `ModelCalibrationAnalysisService`
 * -- puramente analítico, nunca persiste nada) de UTILIZAR una
 * calibración: esta clase implementa el ciclo de vida completo
 * PROPOSED -> APPROVED -> ACTIVE -> INACTIVE (o -> REJECTED desde
 * PROPOSED), siguiendo la misma filosofía que
 * MaturationModelConfigurationService (2.6.1.11) usa para el modelo
 * activo -- "recomendación -> aprobación explícita -> configuración
 * activa -> historial" (sección 12 de la especificación).
 *
 * Regla fundamental (sección 2): toda calibración está acotada a un
 * (modelType, recipeVersionId) específico -- nunca solo al modelType.
 * "Tepache Original v3" y "Tepache Original v4" son alcances distintos.
 *
 * Validaciones de estado explícitamente exigidas (sección 13):
 *   - No se puede activar una PROPOSED directamente -- debe pasar por
 *     APPROVED primero.
 *   - No puede haber dos calibraciones ACTIVE simultáneas para el mismo
 *     (modelType, recipeVersionId).
 *   - No se puede editar una calibración ACTIVE (hay que crear una
 *     propuesta nueva).
 */
class MaturationModelCalibrationService
    extends BaseService {

    constructor() {

        super(

            new MaturationModelCalibrationRepository()

        );

        this.recipeVersionRepository =
            new RecipeVersionRepository();

    }

    async _requireRecipeVersion(recipeVersionId) {

        if (!recipeVersionId) {

            throw new Error("recipeVersionId es obligatorio.");

        }

        const recipeVersion =
            await this.recipeVersionRepository.findById(recipeVersionId);

        if (!recipeVersion) {

            throw new Error("Recipe version not found");

        }

        return recipeVersion;

    }

    async _requireExisting(id) {

        const record =
            await this.repository.findById(id);

        if (!record) {

            throw new Error("Calibration not found");

        }

        return record;

    }

    /*
     * Crea una propuesta nueva (sección 3). El offset inicial suele
     * venir del Bias observado en el análisis de sesgo (2.6.1.15), pero
     * el usuario puede editarlo antes de enviarlo -- este método no
     * impone ninguna relación entre offsetHours y biasHours, solo los
     * registra juntos para que el historial quede completo.
     */
    async createProposal({ modelType, recipeVersionId, offsetHours, sampleSize, biasHours, reason, createdBy, parentCalibrationId }, transaction = null) {

        await this._requireRecipeVersion(recipeVersionId);

        if (!isValidModelType(modelType)) {

            throw new Error(

                `modelType inválido. Valores permitidos: ${AVAILABLE_MODEL_TYPES.join(", ")}.`

            );

        }

        const parsedOffset =
            Number(offsetHours);

        if (!Number.isFinite(parsedOffset)) {

            throw new Error("offsetHours es obligatorio y debe ser un número.");

        }

        // Entrega 2.6.1.19, sección 14 -- validación explícita exigida
        // por el spec, verificada aquí (no solo por construcción en
        // `createReplacement()`) para que quede garantizada sin importar
        // desde dónde se llegue a `createProposal()`: un
        // `parentCalibrationId` SIEMPRE debe pertenecer al mismo
        // (modelType, recipeVersionId) que la calibración que se está
        // creando -- "LINEAR / Recipe 3 -> EXPONENTIAL / Recipe 8" nunca
        // puede tratarse como una cadena de versiones de la misma
        // calibración, son alcances distintos.
        if (parentCalibrationId !== null && parentCalibrationId !== undefined) {

            const parent =
                await this._requireExisting(parentCalibrationId);

            if (parent.modelType !== modelType || Number(parent.recipeVersionId) !== Number(recipeVersionId)) {

                throw new Error(

                    `parentCalibrationId debe pertenecer al mismo modelType/recipeVersionId (calibración #${parentCalibrationId} es ${parent.modelType} / receta #${parent.recipeVersionId}, se intentó crear ${modelType} / receta #${recipeVersionId}).`

                );

            }

        }

        const created =
            await this.repository.create({

                modelType,

                recipeVersionId,

                offsetHours: parsedOffset,

                sampleSize: sampleSize ?? null,

                biasHours: biasHours ?? null,

                reason: reason ?? null,

                createdBy: createdBy ?? null,

                parentCalibrationId: parentCalibrationId ?? null

            }, transaction);

        return this._serialize(created);

    }

    /*
     * Entrega 2.6.1.19, sección 6 -- crea una propuesta NUEVA derivada
     * de una calibración existente (típicamente ofrecida desde una
     * alerta de salud DEGRADED). Nunca sobrescribe la fila `parentId`
     * (sección 1: "no vamos a sobrescribir una calibración existente")
     * -- hereda modelType/recipeVersionId/parentCalibrationId de ella,
     * pero SIEMPRE recibe su propio offsetHours/sampleSize/biasHours
     * nuevos (criterio de aceptación explícito: "el usuario pueda
     * modificar el nuevo offsetHours"), y siempre nace PROPOSED (nunca
     * salta directo a ACTIVE, sección 7: "esto evita que el sistema
     * cambie el comportamiento de las predicciones simplemente porque
     * detectó deterioro").
     */
    async createReplacement(parentId, { offsetHours, sampleSize, biasHours, reason, createdBy }, transaction = null) {

        const parent =
            await this._requireExisting(parentId);

        return this.createProposal({

            modelType: parent.modelType,

            recipeVersionId: parent.recipeVersionId,

            offsetHours,

            sampleSize,

            biasHours,

            reason,

            createdBy,

            parentCalibrationId: parent.id

        }, transaction);

    }

    /*
     * Entrega 2.6.1.19, sección 13 -- cadena de versiones de un
     * (modelType, recipeVersionId), ordenada v1..vN (ver el comentario
     * de `MaturationModelCalibrationRepository.findVersionChain()` para
     * por qué se basa en `version` y no en recorrer `parentCalibrationId`
     * como un grafo).
     */
    async getVersionChain(id) {

        const anchor =
            await this._requireExisting(id);

        const chain =
            await this.repository.findVersionChain(anchor.modelType, anchor.recipeVersionId);

        return chain.map(record => this._serialize(record));

    }

    async list(filters = {}) {

        const records =
            await this.repository.findAll(filters);

        return records.map(record => this._serialize(record));

    }

    async getById(id) {

        const record =
            await this._requireExisting(id);

        return this._serialize(record);

    }

    /*
     * Edita offsetHours/reason. Solo permitido mientras la propuesta
     * sigue en PROPOSED -- una vez APPROVED, el usuario ya dio su visto
     * bueno a esos valores concretos, y una vez ACTIVE, editarla en
     * silencio cambiaría predicciones futuras sin pasar por el flujo de
     * aprobación (sección 13 lo prohíbe explícitamente para ACTIVE;
     * extender la misma cautela a APPROVED evita que una edición
     * posterior invalide una aprobación ya dada sin que nadie vuelva a
     * revisarla).
     */
    async update(id, { offsetHours, reason }, transaction = null) {

        const record =
            await this._requireExisting(id);

        if (record.status !== "PROPOSED") {

            throw new Error(

                `Solo se puede editar una calibración en estado PROPOSED (estado actual: ${record.status}).`

            );

        }

        let parsedOffset;

        if (offsetHours !== undefined) {

            parsedOffset = Number(offsetHours);

            if (!Number.isFinite(parsedOffset)) {

                throw new Error("offsetHours debe ser un número.");

            }

        }

        const updated =
            await this.repository.updateEditableFields(id, {

                offsetHours: parsedOffset,

                reason

            }, transaction);

        return this._serialize(updated);

    }

    /*
     * PROPOSED -> APPROVED (sección 5). Todavía sin ningún efecto sobre
     * las predicciones -- solo dice "estoy de acuerdo con este offset",
     * no "úsalo ya".
     */
    /*
     * Entrega 2.6.1.24, sección 7/9 -- `approvedBy` es un parámetro
     * nuevo, opcional y retrocompatible: el controller genérico
     * `/calibrations/:id/approve` (2.6.1.16) sigue llamando
     * `service.approve(id)` sin segundo argumento, y sigue funcionando
     * igual que siempre (`approvedBy` queda null). El nuevo
     * `RecalibrationProposalService` (2.6.1.24) es quien pasa
     * `{approvedBy: userId}`. La validación de estado (solo desde
     * PROPOSED) es la MISMA de siempre -- ya cumple, por sí sola, el
     * criterio "no se permiten transiciones inválidas" de 2.6.1.24 sin
     * necesidad de duplicar esta lógica en el servicio nuevo.
     */
    async approve(id, { approvedBy } = {}, transaction = null) {

        const record =
            await this._requireExisting(id);

        if (record.status !== "PROPOSED") {

            throw new Error(

                `Solo se puede aprobar una calibración en estado PROPOSED (estado actual: ${record.status}).`

            );

        }

        const updated =
            await this.repository.approve(id, { approvedBy }, transaction);

        return this._serialize(updated);

    }

    /*
     * PROPOSED -> REJECTED. Solo desde PROPOSED -- una vez aprobada, la
     * forma de "deshacerla" pasa a ser activarla y luego desactivarla
     * (o simplemente no activarla nunca), no rechazarla retroactivamente.
     */
    /*
     * Entrega 2.6.1.24, sección 8/9 -- mismo criterio de
     * retrocompatibilidad que approve() de arriba. Este método
     * deliberadamente NO exige `rejectionReason` -- el endpoint
     * genérico `/calibrations/:id/reject` (2.6.1.16, todavía usado
     * desde /maturation/calibrations, criterio "las entregas anteriores
     * continúan funcionando") nunca envía motivo y debe seguir
     * pudiendo rechazar sin él. "Motivo obligatorio" es una regla
     * específica del flujo de propuestas de recalibración -- se valida
     * en `RecalibrationProposalService.reject()`, ANTES de llegar aquí.
     */
    async reject(id, { rejectedBy, rejectionReason } = {}, transaction = null) {

        const record =
            await this._requireExisting(id);

        if (record.status !== "PROPOSED") {

            throw new Error(

                `Solo se puede rechazar una calibración en estado PROPOSED (estado actual: ${record.status}).`

            );

        }

        const updated =
            await this.repository.reject(id, { rejectedBy, rejectionReason }, transaction);

        return this._serialize(updated);

    }

    /*
     * APPROVED -> ACTIVE (sección 6, criterio de aceptación explícito:
     * "no se debe permitir activar directamente una PROPOSED"). A
     * partir de este momento, las predicciones NUEVAS de este
     * (modelType, recipeVersionId) aplicarán este offset -- las ya
     * generadas nunca se recalculan (sección 11).
     *
     * Núcleo transaccional: desactivar cualquier ACTIVE anterior del
     * mismo (modelType, recipeVersionId) y activar esta ocurren en la
     * MISMA transacción (mismo patrón que
     * MaturationModelConfigurationService._activate(), 2.6.1.11) --
     * así nunca queda el alcance sin ninguna calibración ACTIVE (o con
     * dos) a medio camino.
     */
    /*
     * Entrega 2.6.1.25, sección 7/10 -- `activatedBy` es un parámetro
     * nuevo, opcional y retrocompatible (mismo criterio que approve()/
     * reject() en 2.6.1.24): el controller genérico
     * `/calibrations/:id/activate` (2.6.1.16) sigue llamando
     * `service.activate(id)` sin segundo argumento y sigue funcionando
     * exactamente igual (`activatedBy` queda null). El nuevo flujo de
     * propuestas (`RecalibrationProposalService.activate()`, 2.6.1.25)
     * es quien pasa `{activatedBy: userId}`. La garantía "como máximo
     * una ACTIVE por (modelType, recipeVersionId)" (sección 9) y la
     * validación de estado (solo desde APPROVED, sección 10.4) son las
     * MISMAS de siempre -- no se duplican en el servicio nuevo.
     */
    async activate(id, { activatedBy } = {}, transaction = null) {

        const record =
            await this._requireExisting(id);

        if (record.status !== "APPROVED") {

            throw new Error(

                `No se puede activar una calibración que no esté APPROVED (estado actual: ${record.status}). No se puede saltar de PROPOSED a ACTIVE directamente.`

            );

        }

        return this.transactional(async t => {

            const currentActive =
                await this.repository.findActiveByModelAndRecipeVersion(

                    record.modelType,

                    record.recipeVersionId,

                    t

                );

            if (currentActive) {

                await this.repository.deactivateRow(currentActive.id, t);

            }

            const updated =
                await this.repository.activateRow(id, { activatedBy }, t);

            return this._serialize(updated);

        }, transaction);

    }

    /*
     * ACTIVE -> INACTIVE (sección 7). El offset deja de aplicarse a
     * predicciones nuevas (que a partir de ahora vuelven a usar
     * rawPredictedMaturationAt == predictedMaturationAt, offset 0) sin
     * borrar el historial de esta fila ni de ninguna predicción que ya
     * la haya usado.
     */
    async deactivate(id, transaction = null) {

        const record =
            await this._requireExisting(id);

        if (record.status !== "ACTIVE") {

            throw new Error(

                `Solo se puede desactivar una calibración en estado ACTIVE (estado actual: ${record.status}).`

            );

        }

        const updated =
            await this.repository.deactivateRow(id, transaction);

        return this._serialize(updated);

    }

    _recipeVersionLabel(recipeVersion) {

        if (!recipeVersion) {

            return null;

        }

        const recipeName =
            recipeVersion.recipe ? recipeVersion.recipe.name : null;

        const productName =
            recipeVersion.recipe && recipeVersion.recipe.product
                ? recipeVersion.recipe.product.name
                : null;

        return {

            id: recipeVersion.id,

            version: recipeVersion.version,

            recipeName,

            productName

        };

    }

    _serialize(record) {

        return {

            id: record.id,

            modelType: record.modelType,

            recipeVersionId: record.recipeVersionId,

            recipeVersion: this._recipeVersionLabel(record.recipeVersion),

            offsetHours: record.offsetHours !== null && record.offsetHours !== undefined
                ? Number(record.offsetHours)
                : null,

            status: record.status,

            // Entrega 2.6.1.19 -- versionado (sección 2/3).
            version: record.version,

            parentCalibrationId: record.parentCalibrationId ?? null,

            sampleSize: record.sampleSize,

            biasHours: record.biasHours !== null && record.biasHours !== undefined
                ? Number(record.biasHours)
                : null,

            reason: record.reason,

            createdBy: record.createdBy,

            createdAt: record.createdAt,

            approvedAt: record.approvedAt,

            approvedBy: record.approvedBy ?? null,

            rejectedAt: record.rejectedAt,

            rejectedBy: record.rejectedBy ?? null,

            rejectionReason: record.rejectionReason ?? null,

            activatedAt: record.activatedAt,

            activatedBy: record.activatedBy ?? null,

            deactivatedAt: record.deactivatedAt

        };

    }

}

module.exports =
    MaturationModelCalibrationService;
