const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const MaturationPredictionRepository =
    require("../repositories/MaturationPredictionRepository");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const BatchOperationalStatus =
    require("../utils/BatchOperationalStatus");

/*
 * Capa OPERATIVA de predicción (Entrega 2.7.0.1, sección 7): "Lote ->
 * Predicción operativa -> Alerta operacional". Deliberadamente un
 * SERVICIO SEPARADO de `MaturationPredictionService` (la capa de
 * trazabilidad/auditoría, "Modelo -> Predicción -> Evaluación del
 * modelo", 2.6.1.12 en adelante) y de `CalibrationDegradationService`/
 * `ModelAlertService` (la capa de degradación del MODELO, 2.6.1.21/28).
 *
 * Este servicio SOLO LEE -- nunca genera, modifica ni evalúa una
 * predicción; solo consulta las ya persistidas (con su ventana de
 * confianza YA calculada por `MaturationPredictionService.generatePrediction()`,
 * ver `_computeConfidence()` en ese archivo) y las traduce a un estado
 * operativo en vivo. No importa ni depende de `DegradationDetection.js`/
 * `CalibrationHealth.js` -- una desviación operativa de UN lote nunca
 * se traduce automáticamente en una conclusión sobre el modelo (sección
 * 7, regla explícita).
 */
class BatchOperationalPredictionService {

    constructor() {

        this.batchRepository =
            new ProductionBatchRepository();

        this.predictionRepository =
            new MaturationPredictionRepository();

        this.measurementRepository =
            new ProductionMeasurementRepository();

    }

    /*
     * Duplicado deliberado y mínimo de
     * `MaturationPredictionService._serializeConfidence()` -- este
     * servicio no depende de aquel (ver comentario de clase, separación
     * de capas), así que lee las mismas columnas ya persistidas
     * directamente en vez de compartir una instancia de otro servicio.
     */
    _serializeConfidence(record) {

        const applicable =
            record.confidenceLowerBound !== null && record.confidenceLowerBound !== undefined &&
            record.confidenceUpperBound !== null && record.confidenceUpperBound !== undefined;

        return {

            applicable,

            basis: record.confidenceBasis ?? "UNAVAILABLE",

            lowerBound: record.confidenceLowerBound ?? null,

            upperBound: record.confidenceUpperBound ?? null,

            windowHours: record.confidenceWindowHours ?? null,

            confidencePercentage: record.confidencePercentage ?? null,

            sampleSize: record.confidenceSampleSize ?? 0

        };

    }

    _serializePredictionPoint(record) {

        if (!record) {

            return null;

        }

        return {

            id: record.id,

            predictedAt: record.predictedAt,

            predictedMaturationAt: record.predictedMaturationAt,

            modelType: record.modelType

        };

    }

    /*
     * Secciones 1-6 -- estado operativo completo de UN lote:
     *
     *   - `current`: la predicción vigente (isCurrent=true) más su
     *     ventana de confianza (sección 1).
     *   - `rangeStatus`: 🟢 EN RANGO / 🟡 CERCA DEL LÍMITE / 🔴 FUERA DE
     *     PREDICCIÓN (sección 3) -- comparado contra `now` mientras el
     *     lote sigue en curso, o contra `finishedAt` una vez que ya
     *     terminó (mismo cálculo, ver comentario de
     *     `BatchOperationalStatus.classifyRangeStatus()`).
     *   - `drift`: deriva entre las DOS predicciones vigentes más
     *     recientes del lote (sección 4/6) -- null/"NONE" si todavía no
     *     existe una segunda predicción con la cual comparar.
     *
     * Nunca lanza error si el lote simplemente no tiene ninguna
     * predicción todavía -- `applicable:false` es un resultado
     * legítimo (un lote recién creado, sin mediciones F1 registradas
     * todavía), mismo criterio que el resto de este proyecto desde
     * `MaturationPredictionService.generatePrediction()`.
     */
    async getStatus(batchId) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        const predictions =
            await this.predictionRepository.findByBatch(batchId);

        if (!predictions || predictions.length === 0) {

            // Entrega 2.7.0.2, sección 9 -- "Predicción: NO DISPONIBLE"
            // o "Predicción: ESPERANDO DATOS" son dos situaciones
            // distintas que antes se colapsaban en un único
            // "NO_PREDICTION": ESPERANDO_DATOS es el caso normal/
            // esperado de un lote recién creado (todavía no hay ni
            // siquiera una medición F1 con la que empezar); NO_DISPONIBLE
            // es la señal de que sí hay datos pero, por alguna razón
            // (sin modelo activo configurado, medición sin ningún valor
            // relevante, etc.), no fue posible generar una predicción
            // trazable -- nunca se fabrica una con datos insuficientes
            // (mismo criterio en ambos casos).
            const measurements =
                await this.measurementRepository.findByBatch(batchId);

            const hasF1Measurement =
                (measurements || []).some(m => m.phase === "F1");

            const reason =
                hasF1Measurement ? "NO_DISPONIBLE" : "ESPERANDO_DATOS";

            const label =
                hasF1Measurement ? "Predicción: NO DISPONIBLE" : "Predicción: ESPERANDO DATOS";

            return {

                batchId: Number(batchId),

                applicable: false,

                reason,

                current: null,

                previous: null,

                rangeStatus: { code: "UNAVAILABLE", label, emoji: "⚪" },

                drift: { code: "NONE", driftHours: null, direction: null }

            };

        }

        // findByBatch() regresa más-reciente-primero (2.6.1.12) --
        // aquí se necesita orden cronológico ascendente para identificar
        // sin ambigüedad "la vigente" y "la inmediatamente anterior".
        const chronological =
            [...predictions].sort((a, b) =>

                new Date(a.predictedAt).getTime() - new Date(b.predictedAt).getTime()

            );

        const current =
            chronological.find(p => p.isCurrent) || chronological[chronological.length - 1];

        const currentIndex =
            chronological.findIndex(p => p.id === current.id);

        const previous =
            currentIndex > 0 ? chronological[currentIndex - 1] : null;

        const actualMaturationAt =
            batch.finishedAt ?? null;

        // Sección 3 -- en vivo mientras el lote sigue en curso, o contra
        // el resultado real una vez que ya finalizó (ver comentario del
        // propio `classifyRangeStatus()`, diseñado para ambos casos con
        // el mismo código).
        const rangeStatus =
            BatchOperationalStatus.classifyRangeStatus({

                now: actualMaturationAt || new Date(),

                lowerBound: current.confidenceLowerBound,

                upperBound: current.confidenceUpperBound

            });

        const drift =
            BatchOperationalStatus.classifyDrift({

                previousPredictedMaturationAt: previous ? previous.predictedMaturationAt : null,

                currentPredictedMaturationAt: current.predictedMaturationAt

            });

        return {

            batchId: Number(batchId),

            applicable: true,

            reason: null,

            isCompleted: Boolean(actualMaturationAt),

            actual: { maturationAt: actualMaturationAt },

            current: {

                ...this._serializePredictionPoint(current),

                predictedDurationHours: current.predictedDurationHours,

                calibrationId: current.calibrationId ?? null,

                confidence: this._serializeConfidence(current)

            },

            previous: this._serializePredictionPoint(previous),

            rangeStatus,

            drift

        };

    }

}

module.exports =
    BatchOperationalPredictionService;
