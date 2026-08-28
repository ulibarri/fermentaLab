const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const MaturationPredictionRepository =
    require("../repositories/MaturationPredictionRepository");

const ProductionPredictionAlertRepository =
    require("../repositories/ProductionPredictionAlertRepository");

const FermentationDashboard =
    require("../utils/FermentationDashboard");

/*
 * Entrega 2.7.0.4 -- "Panel operativo de monitoreo de fermentaciones".
 *
 * Capa puramente de AGREGACIÓN Y LECTURA: no genera predicciones, no
 * calcula desviaciones, no crea ni modifica alertas (sección 15,
 * explícito -- "no modifica la lógica predictiva... exclusivamente una
 * capa de visualización"). Consume, lote por lote, exactamente lo que
 * ya calcularon 2.7.0.1 (predicción vigente + su ventana de confianza),
 * 2.7.0.2 (predictedAt/phase) y 2.7.0.3 (alerta activa) -- nunca
 * reimplementa esa lógica.
 *
 * Sección 14 (rendimiento): para cada lote solo se piden TRES filas
 * como máximo (última medición, predicción vigente, alerta activa),
 * todas ya "lean" por diseño de sus propios repositorios
 * (findLatestByBatch()/findCurrentByBatch()/findActiveByBatch() -- cada
 * una un `findOne`/`LIMIT 1`, nunca el historial completo). Con N lotes
 * activos esto es 1 consulta bulk + hasta 3N consultas de una sola fila
 * -- deliberadamente NO se escribió una única consulta SQL con
 * subconsultas/window functions para colapsar esto en menos
 * round-trips: este proyecto no usa SQL crudo en ningún otro punto
 * (todo pasa por Sequelize ORM + los repositorios ya existentes), y el
 * volumen real de "lotes activos simultáneos" es pequeño (decenas, no
 * miles) -- el criterio de aceptación de la sección 14 es "no cargar
 * TODO el historial", no "una sola consulta SQL total". Judgment call,
 * flagged.
 */
class FermentationDashboardService {

    constructor() {

        this.batchRepository =
            new ProductionBatchRepository();

        this.measurementRepository =
            new ProductionMeasurementRepository();

        this.predictionRepository =
            new MaturationPredictionRepository();

        this.alertRepository =
            new ProductionPredictionAlertRepository();

    }

    /*
     * Sección 4 -- "fase actual". Deliberadamente distinta del `status`
     * crudo de ProductionBatch (que el panel también expone tal cual,
     * por separado): un lote COMPLETED (F1 terminado, F2 sin iniciar
     * todavía) se etiqueta como fase "F1" -- ya no se están tomando
     * mediciones F1, pero es la última fase con datos reales, y no hay
     * todavía ninguna fase F2 que mostrar.
     */
    _resolvePhaseLabel(batchStatus) {

        if (batchStatus === "F2_STARTED") {

            return "F2";

        }

        return "F1";

    }

    _resolveProductLabel(batch) {

        const recipe =
            batch.recipeVersion ? batch.recipeVersion.recipe : null;

        return {

            productId: recipe && recipe.product ? recipe.product.id : null,

            productName: recipe && recipe.product ? recipe.product.name : null,

            recipeId: recipe ? recipe.id : null,

            recipeName: recipe ? recipe.name : null,

            recipeVersionId: batch.recipeVersionId

        };

    }

    async _buildItem(batch, now) {

        const [ latestMeasurement, currentPrediction, activeAlert, hasF1Measurement ] =
            await Promise.all([

                this.measurementRepository.findLatestByBatch(batch.id),

                this.predictionRepository.findCurrentByBatch(batch.id),

                this.alertRepository.findActiveByBatch(batch.id),

                this.measurementRepository.existsByBatchAndPhase(batch.id, "F1")

            ]);

        const predictionAvailability =
            FermentationDashboard.classifyPredictionAvailability({

                hasCurrentPrediction: Boolean(currentPrediction),

                hasF1Measurement

            });

        const severity =
            FermentationDashboard.resolveSeverity({

                activeAlertSeverity: activeAlert ? activeAlert.severity : null,

                predictionAvailability

            });

        const severityMeta =
            FermentationDashboard.severityMeta(severity);

        const activity =
            FermentationDashboard.classifyActivity({

                lastMeasurementDate: latestMeasurement ? latestMeasurement.measurementDate : null,

                now

            });

        const maturationMetric =
            batch.recipeVersion ? batch.recipeVersion.maturationMetric : null;

        return {

            batchId: batch.id,

            batchNumber: batch.batchNumber,

            batchStatus: batch.status,

            phase: this._resolvePhaseLabel(batch.status),

            ...this._resolveProductLabel(batch),

            lastMeasurement: latestMeasurement
                ? {

                    measurementDate: latestMeasurement.measurementDate,

                    metric: maturationMetric,

                    value: maturationMetric ? (latestMeasurement[maturationMetric] ?? null) : null,

                    phase: latestMeasurement.phase

                }
                : null,

            lastMeasurementMinutesAgo: activity.minutesAgo,

            lastMeasurementStale: activity.stale,

            prediction: currentPrediction
                ? {

                    predictedFinishAt: currentPrediction.predictedMaturationAt,

                    lowerBound: currentPrediction.confidenceLowerBound,

                    upperBound: currentPrediction.confidenceUpperBound,

                    predictedAt: currentPrediction.predictedAt

                }
                : null,

            predictionAvailability,

            alert: activeAlert
                ? {

                    id: activeAlert.id,

                    type: activeAlert.type,

                    severity: activeAlert.severity,

                    deviationMinutes: activeAlert.deviationMinutes,

                    message: activeAlert.message,

                    createdAt: activeAlert.createdAt

                }
                : null,

            deviationMinutes: activeAlert ? activeAlert.deviationMinutes : null,

            alertCreatedAt: activeAlert ? activeAlert.createdAt : null,

            severity,

            severityLabel: severityMeta.label,

            severityEmoji: severityMeta.emoji,

            // Sección 10 -- cuándo se generó/actualizó por última vez la
            // información operativa de esta fila (distinto de "cuándo
            // se tomó la última medición cruda"): la predicción vigente
            // es lo último que el backend recalculó para este lote.
            lastUpdatedAt: currentPrediction ? currentPrediction.predictedAt : (latestMeasurement ? latestMeasurement.measurementDate : null)

        };

    }

    /*
     * Sección 13/16 -- punto de entrada único del dashboard.
     *
     * `phase`/`severity`/`alertsOnly`/`productId` (todos opcionales)
     * filtran la TABLA (`items`) -- nunca alteran ni recalculan nada
     * persistido (criterio de aceptación explícito, sección 16,
     * "Filtros"). `summary` siempre refleja el conjunto COMPLETO de
     * lotes activos, sin importar los filtros aplicados a la tabla --
     * las tarjetas de resumen describen "la producción en su
     * totalidad", no "lo que el filtro actual deja ver" (judgment call,
     * mismo criterio que un dashboard típico: los KPIs de arriba no
     * deberían cambiar de significado según qué columnas decidió mirar
     * el usuario en la tabla de abajo).
     */
    async getActiveFermentations({ phase = null, severity = null, alertsOnly = null, productId = null, now = new Date() } = {}) {

        const batches =
            await this.batchRepository.findActiveForDashboard();

        const items =
            await Promise.all(batches.map(batch => this._buildItem(batch, now)));

        const summary =
            FermentationDashboard.summarize(items);

        let filtered =
            items;

        if (phase) {

            filtered =
                filtered.filter(item => item.phase === phase);

        }

        if (severity) {

            filtered =
                filtered.filter(item => item.severity === severity);

        }

        // Sección 7 -- "Solo con alertas" / "Solo normales".
        if (alertsOnly === true) {

            filtered =
                filtered.filter(item => item.alert !== null);

        } else if (alertsOnly === false) {

            filtered =
                filtered.filter(item => item.alert === null);

        }

        if (productId) {

            filtered =
                filtered.filter(item => item.productId === Number(productId));

        }

        const sorted =
            [...filtered].sort((a, b) => FermentationDashboard.comparePriority(a, b));

        return {

            summary,

            items: sorted

        };

    }

}

module.exports =
    FermentationDashboardService;
