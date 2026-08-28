const ProductionPredictionAlertRepository =
    require("../repositories/ProductionPredictionAlertRepository");

const AlertTrendAnalysis =
    require("../utils/AlertTrendAnalysis");

/*
 * Entrega 2.7.0.8 -- "tendencias y evolución histórica de alertas".
 * Servicio especializado de SOLO CONSULTA/AGREGACIÓN (mismo criterio
 * que `OperationalActionAnalyticsService`, 2.7.0.7): reutiliza
 * `ProductionPredictionAlertRepository` tal cual (el mismo repositorio
 * de 2.7.0.3, sin ninguna tabla ni columna nueva) y delega TODO el
 * cálculo agregado en el módulo puro `AlertTrendAnalysis.js` -- este
 * servicio nunca decide él mismo una tasa de resolución, una mediana de
 * duración o una agrupación temporal.
 *
 * `from`/`to` filtran por `createdAt` de la alerta (sección 14 --
 * "Alertas creadas: createdAt" es la fuente de fecha por defecto),
 * mismo criterio de comparación simple por instante exacto
 * (`new Date(value)`) ya usado en 2.7.0.7/2.6.1.33 para filtros de
 * período, sin inventar una semántica de "fin del día" nueva.
 */
class PredictionAlertTrendService {

    constructor() {

        this.alertRepository =
            new ProductionPredictionAlertRepository();

    }

    /*
     * Extrae de cada fila (con sus includes ya resueltos por el
     * repositorio) solo lo que el módulo puro necesita -- nunca expone
     * la instancia de Sequelize completa. Defensivo ante cualquier
     * eslabón faltante de la cadena productionBatch->recipeVersion->
     * recipe->product (alertas cuyo lote, por alguna razón, no resuelva
     * la cadena completa simplemente quedan sin producto identificado,
     * nunca se descartan -- ver `AlertTrendAnalysis.buildByProduct()`).
     */
    _toPlainAlert(row) {

        const batch =
            row.productionBatch || null;

        const recipeVersion =
            batch && batch.recipeVersion || null;

        const recipe =
            recipeVersion && recipeVersion.recipe || null;

        const product =
            recipe && recipe.product || null;

        return {

            id: row.id,

            status: row.status,

            severity: row.severity,

            createdAt: row.createdAt,

            resolvedAt: row.resolvedAt,

            batchId: row.productionBatchId,

            batchNumber: batch ? batch.batchNumber : null,

            productId: product ? product.id : null,

            productName: product ? product.name : null

        };

    }

    async getTrends({ from, to, severity, status, productId, phase, groupBy } = {}) {

        const rows =
            await this.alertRepository.findForAnalytics({

                from: from ? new Date(from) : undefined,

                to: to ? new Date(to) : undefined,

                severity: severity || undefined,

                status: status || undefined,

                productId: productId || undefined,

                phase: phase || undefined

            });

        const plainAlerts =
            rows.map(row => this._toPlainAlert(row));

        return AlertTrendAnalysis.buildTrendDTO(plainAlerts, {

            groupBy: groupBy || undefined

        });

    }

}

module.exports =
    PredictionAlertTrendService;
