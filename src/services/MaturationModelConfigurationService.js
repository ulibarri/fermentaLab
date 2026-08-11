const BaseService =
    require("./BaseService");

const MaturationModelConfigurationRepository =
    require("../repositories/MaturationModelConfigurationRepository");

const RecipeVersionRepository =
    require("../repositories/RecipeVersionRepository");

const ModelRecommendationService =
    require("./ModelRecommendationService");

const { isValidModelType, AVAILABLE_MODEL_TYPES } =
    require("../utils/MaturationModelTypes");

/*
 * Gestión del modelo activo de predicción de maduración (Entrega
 * 2.6.1.11): separa MODELO DISPONIBLE / EVALUADO / RECOMENDADO (ya
 * construidos en 2.6.1.7-2.6.1.10, puramente analíticos) de MODELO
 * ACTIVO — el único que de verdad se usa para las predicciones nuevas,
 * y que SOLO cambia cuando el usuario lo aprueba explícitamente
 * (sección 2 de la especificación: "FermentaLab nunca deberá cambiar
 * automáticamente el modelo activo").
 *
 * Cada RecipeVersion tiene, como mucho, una fila ACTIVE en
 * MaturationModelConfiguration a la vez (sección 5). Activar un modelo
 * nunca sobrescribe la fila anterior: la desactiva (status=INACTIVE,
 * deactivatedAt=ahora) y crea una fila nueva ACTIVE, dentro de la misma
 * transacción — así el historial completo de qué modelo estuvo activo,
 * cuándo, y por qué, queda preservado (sección 3).
 *
 * Dos caminos para activar, con dos reglas de confianza distintas:
 *   - activateManual(): el cliente elige el modelo explícitamente.
 *     Siempre se registra source=MANUAL, incluso si el modelo elegido
 *     coincide con el recomendado — MANUAL describe la ACCIÓN tomada
 *     (el usuario lo eligió a mano), no si el resultado coincide con
 *     la recomendación.
 *   - activateRecommendation(): el cliente NO envía modelType — el
 *     servidor vuelve a calcular la recomendación actual (nunca confía
 *     en lo que el frontend diga que era, sección 7) y rechaza la
 *     activación si no hay una recomendación válida (NO_DECISION,
 *     sección 8).
 */
class MaturationModelConfigurationService
    extends BaseService {

    constructor() {

        super(

            new MaturationModelConfigurationRepository()

        );

        this.recipeVersionRepository =
            new RecipeVersionRepository();

        this.recommendationService =
            new ModelRecommendationService();

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

    /*
     * Estado completo del modelo de maduración para una recipeVersion:
     * el modelo ACTIVE actual (o null, con activeModelStatus =
     * "NO_ACTIVE_MODEL" — sección 12) y el historial completo.
     */
    async getStatus(recipeVersionId) {

        await this._requireRecipeVersion(recipeVersionId);

        const active =
            await this.repository.findActiveByRecipeVersion(recipeVersionId);

        const history =
            await this.repository.findHistoryByRecipeVersion(recipeVersionId);

        return {

            recipeVersionId: Number(recipeVersionId),

            active: active ? this._serialize(active) : null,

            activeModelStatus: active ? "ACTIVE_MODEL_CONFIGURED" : "NO_ACTIVE_MODEL",

            history: history.map(record => this._serialize(record))

        };

    }

    /*
     * Activación manual (sección 9): el usuario elige el modelo, sea o
     * no el que FermentaLab recomendó. Útil cuando el productor tiene
     * conocimiento práctico que el modelo estadístico todavía no
     * refleja.
     */
    async activateManual({ recipeVersionId, modelType, notes, activatedBy }, transaction = null) {

        await this._requireRecipeVersion(recipeVersionId);

        if (!isValidModelType(modelType)) {

            throw new Error(

                `modelType inválido. Valores permitidos: ${AVAILABLE_MODEL_TYPES.join(", ")}.`

            );

        }

        return this._activate({

            recipeVersionId,

            modelType,

            source: "MANUAL",

            notes: notes ?? null,

            activatedBy: activatedBy ?? null

        }, transaction);

    }

    /*
     * Activación desde la recomendación actual (sección 7). El
     * servidor SIEMPRE recalcula la recomendación —el cliente nunca
     * envía modelType aquí— y rechaza la activación si no hay una
     * recomendación vigente con status RECOMMENDED (sección 8: nunca
     * se puede activar un NO_DECISION).
     */
    async activateRecommendation({ recipeVersionId, notes, activatedBy }, transaction = null) {

        await this._requireRecipeVersion(recipeVersionId);

        const analysis =
            await this.recommendationService.getAnalysis({ recipeVersionId });

        // recipeVersionId ya acota el filtro a un único alcance: si el
        // servicio de recomendación de todos modos regresó la forma
        // agrupada, es porque no encontró NINGÚN lote evaluable para
        // esta recipeVersion (groups: []) -- no hay recomendación que
        // activar.
        if (!analysis || Array.isArray(analysis.groups)) {

            throw new Error(

                "No hay evidencia suficiente para calcular una recomendación en esta versión de receta."

            );

        }

        const recommendation =
            analysis.recommendation;

        if (!recommendation || recommendation.status !== "RECOMMENDED" || !recommendation.model) {

            throw new Error(

                "No existe una recomendación válida (NO_DECISION) para activar."

            );

        }

        return this._activate({

            recipeVersionId,

            modelType: recommendation.model,

            source: "RECOMMENDATION",

            notes: notes ?? null,

            activatedBy: activatedBy ?? null

        }, transaction);

    }

    /*
     * Núcleo transaccional compartido por ambos caminos de activación
     * (sección 6, criterio de aceptación #12): desactivar el ACTIVE
     * anterior (si existe) y crear/activar el nuevo ocurren en la
     * MISMA transacción — si cualquiera de los dos pasos falla, ninguno
     * se aplica, así que nunca queda la recipeVersion sin ningún modelo
     * ACTIVE (o con dos) a medio camino. Acepta una transacción externa
     * opcional (mismo patrón que ProductionBatchService), útil tanto
     * para componer con otras operaciones transaccionales futuras como
     * para pruebas end-to-end sin tocar la base de datos real.
     */
    async _activate({ recipeVersionId, modelType, source, notes, activatedBy }, transaction = null) {

        return this.transactional(async t => {

            const currentActive =
                await this.repository.findActiveByRecipeVersion(recipeVersionId, t);

            if (currentActive) {

                await this.repository.deactivate(currentActive.id, t);

            }

            const created =
                await this.repository.createActive(

                    { recipeVersionId, modelType, source, notes, activatedBy },

                    t

                );

            return this._serialize(created);

        }, transaction);

    }

    _serialize(record) {

        return {

            id: record.id,

            recipeVersionId: record.recipeVersionId,

            modelType: record.modelType,

            status: record.status,

            activatedAt: record.activatedAt,

            deactivatedAt: record.deactivatedAt,

            source: record.source,

            activatedBy: record.activatedBy,

            notes: record.notes

        };

    }

}

module.exports =
    MaturationModelConfigurationService;
