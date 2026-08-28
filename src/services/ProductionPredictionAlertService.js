const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const MaturationPredictionRepository =
    require("../repositories/MaturationPredictionRepository");

const ProductionPredictionAlertRepository =
    require("../repositories/ProductionPredictionAlertRepository");

const PredictionDeviation =
    require("../utils/PredictionDeviation");

/*
 * Entrega 2.7.0.3 -- capa OPERATIVA de alertas de desviación,
 * deliberadamente separada de `MaturationPredictionService` (trazabilidad
 * del modelo, 2.6.1.12+) y de `ModelAlertService`/`CalibrationDegradationService`
 * (alertas de DEGRADACIÓN DEL MODELO, 2.6.1.21/28) -- sección 10 del
 * spec: "una alerta de lote no debe disparar automáticamente una
 * recalibración". Este servicio nunca toca calibraciones, modelos ni
 * predicciones -- solo LEE predicciones ya persistidas y escribe/
 * actualiza/resuelve filas de `ProductionPredictionAlert`.
 *
 * `evaluateForBatch()` es el único punto de entrada que escribe --
 * llamado desde `ProductionMeasurementService.createForBatch()` justo
 * después de que una predicción nueva se generó con éxito (nunca desde
 * un GET, mismo criterio que `generatePrediction()` en 2.6.1.12: no
 * queremos evaluar/crear una alerta cada vez que alguien abre la
 * pantalla del lote).
 */
class ProductionPredictionAlertService {

    constructor() {

        this.repository =
            new ProductionPredictionAlertRepository();

        this.batchRepository =
            new ProductionBatchRepository();

        this.predictionRepository =
            new MaturationPredictionRepository();

    }

    /*
     * Sección 2/3 -- textos exactos del mockup, elegidos por severidad
     * (y, para WARNING, también por dirección -- "más lentamente" es el
     * único ejemplo literal del spec, "más rápido" es el equivalente
     * simétrico, mismo criterio de texto direccional ya usado en
     * `driftAlertHtml()`, 2.7.0.1).
     */
    _buildDeviationMessage({ severity, direction }) {

        if (severity === "CRITICAL") {

            return "🔴 La evolución del lote está significativamente fuera del comportamiento esperado.";

        }

        if (severity === "SIGNIFICANT") {

            return "⚠ La fermentación presenta una desviación significativa respecto a la predicción.";

        }

        const directionText =
            direction === "FASTER" ? "más rápido de lo esperado" : "más lentamente de lo esperado";

        return `⚠ El lote está evolucionando ${directionText}.`;

    }

    /*
     * Sección 8 -- mensaje fijo del mockup ("El lote volvió al
     * intervalo esperado").
     */
    _buildResolvedMessage() {

        return "✓ El lote volvió al intervalo esperado.";

    }

    _serialize(record) {

        return {

            id: record.id,

            batchId: record.productionBatchId,

            predictionId: record.predictionId,

            type: record.type,

            severity: record.severity,

            expectedFinishAt: record.expectedFinishAt,

            predictedFinishAt: record.predictedFinishAt,

            deviationMinutes: record.deviationMinutes,

            status: record.status,

            message: record.message,

            createdAt: record.createdAt,

            resolvedAt: record.resolvedAt ?? null

        };

    }

    /*
     * Flujo de la sección 14: predicción vigente vs. predicción
     * inmediatamente anterior (la "línea base"/expectativa, sección 5)
     * -> ¿dentro del rango? -> resolver o crear/actualizar.
     *
     * Regresa null (nunca lanza, salvo lote inexistente) cuando no hay
     * todavía una segunda predicción con la que comparar -- la primera
     * predicción de un lote no tiene expectativa previa que pudiera
     * haberse incumplido.
     */
    async evaluateForBatch(batchId, { thresholds } = {}) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            return null;

        }

        const predictions =
            await this.predictionRepository.findByBatch(batchId);

        // findByBatch() regresa más-reciente-primero (2.6.1.12) --
        // aquí se necesita orden cronológico ascendente para identificar
        // sin ambigüedad "la vigente" y "la línea base inmediatamente
        // anterior", mismo criterio que
        // BatchOperationalPredictionService.getStatus() (2.7.0.1).
        const chronological =
            [...(predictions || [])].sort((a, b) =>

                new Date(a.predictedAt).getTime() - new Date(b.predictedAt).getTime()

            );

        if (chronological.length < 2) {

            return null;

        }

        const current =
            chronological[chronological.length - 1];

        const previous =
            chronological[chronological.length - 2];

        const deviation =
            PredictionDeviation.evaluate({

                expectedFinishAt: previous.predictedMaturationAt,

                expectedLowerBound: previous.confidenceLowerBound,

                expectedUpperBound: previous.confidenceUpperBound,

                predictedFinishAt: current.predictedMaturationAt,

                ...(thresholds ? { thresholds } : {})

            });

        if (!deviation.applicable) {

            return null;

        }

        const activeAlert =
            await this.repository.findActiveByBatch(batchId);

        if (deviation.status === "NORMAL") {

            // Sección 8 -- el lote volvió al rango esperado. Si no había
            // ninguna alerta activa, no hay nada que resolver (evitar
            // "resolver" algo que nunca se abrió).
            if (!activeAlert) {

                return null;

            }

            return await this.repository.resolve(activeAlert.id, {

                message: this._buildResolvedMessage()

            });

        }

        // DEVIATION (WARNING/SIGNIFICANT/CRITICAL) -- sección 7: nunca
        // duplicar, siempre refrescar la misma fila mientras siga sin
        // resolver.
        const message =
            this._buildDeviationMessage(deviation);

        const payload = {

            predictionId: current.id,

            type: deviation.direction,

            severity: deviation.severity,

            expectedFinishAt: previous.predictedMaturationAt,

            predictedFinishAt: current.predictedMaturationAt,

            deviationMinutes: deviation.deviationMinutes,

            message

        };

        if (activeAlert) {

            return await this.repository.updateActive(activeAlert.id, payload);

        }

        return await this.repository.create({

            productionBatchId: Number(batchId),

            ...payload

        });

    }

    /*
     * Sección 12/13 -- historial completo (activas y resueltas),
     * más reciente primero.
     */
    async getHistory(batchId) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        const rows =
            await this.repository.findByBatch(batchId);

        return {

            batchId: Number(batchId),

            alerts: rows.map(r => this._serialize(r))

        };

    }

    /*
     * Sección 13 -- solo la alerta ACTIVE del lote, si existe.
     */
    async getActive(batchId) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        const row =
            await this.repository.findActiveByBatch(batchId);

        return {

            batchId: Number(batchId),

            active: row ? this._serialize(row) : null

        };

    }

}

module.exports =
    ProductionPredictionAlertService;
