const BaseService =
    require("./BaseService");

const MaturationPredictionRepository =
    require("../repositories/MaturationPredictionRepository");

const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const MaturationModelConfigurationRepository =
    require("../repositories/MaturationModelConfigurationRepository");

const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const MaturationCalculator =
    require("../utils/MaturationCalculator");

const PredictionEvaluation =
    require("../utils/PredictionEvaluation");

/*
 * Auditoría y trazabilidad de predicciones (Entrega 2.6.1.12).
 *
 * Cada vez que se genera una predicción de maduración para un lote,
 * queda una fila INMUTABLE en MaturationPrediction registrando QUÉ
 * configuración de modelo la produjo (modelConfigurationId, nunca solo
 * "LINEAR"/"EXPONENTIAL" -- sección 2), CON QUÉ DATOS de entrada
 * (inputData, snapshot -- sección 3) y CUÁNDO (predictedAt).
 *
 * generatePrediction() es la única forma de crear una fila nueva. Se
 * dispara como efecto de registrar una medición F1 nueva (ver
 * ProductionMeasurementService.createForBatch(), Entrega 2.6.1.12
 * sección 9/12) -- nunca en cada GET, para no inundar la tabla con una
 * fila por cada vez que alguien mira la pantalla del lote. No hace
 * nada (regresa null) cuando falta alguno de los prerequisitos --
 * nunca bloquea el registro de la medición ni lanza un error:
 *   - la recipeVersion no tiene maturationMetric configurado
 *   - no hay ningún modelo ACTIVE para esa recipeVersion (sección 8:
 *     "el modelo activo nunca debe estar hardcodeado" -- si no hay
 *     ninguno, tampoco se puede generar una predicción trazable)
 *   - todavía no hay mediciones F1 registradas
 *
 * Ninguna operación de este servicio modifica una fila ya creada
 * (salvo el flag isCurrent al generar una predicción más nueva del
 * mismo lote) ni toca measurements/recipes/modelConfigurations
 * existentes (sección 13 de 2.6.1.11, que sigue aplicando aquí).
 */
class MaturationPredictionService
    extends BaseService {

    constructor() {

        super(

            new MaturationPredictionRepository()

        );

        this.batchRepository =
            new ProductionBatchRepository();

        this.measurementRepository =
            new ProductionMeasurementRepository();

        this.modelConfigurationRepository =
            new MaturationModelConfigurationRepository();

        this.calibrationRepository =
            new MaturationModelCalibrationRepository();

    }

    /*
     * Entrega 2.6.1.16 -- aplica (si existe) el offset de la
     * calibración ACTIVE de este (modelType, recipeVersionId) a una
     * predicción cruda. Nunca modifica rawEta -- regresa ambos valores
     * por separado (sección 9: "no debemos esconder la predicción
     * original"). Cuando no hay ninguna calibración ACTIVE aplicable,
     * finalEta es exactamente igual a rawEta y calibrationOffsetHours/
     * calibrationId quedan en null (nunca se inventa un offset de 0
     * "aplicado" -- simplemente no hubo ninguno).
     */
    async _applyActiveCalibration({ modelType, recipeVersionId, rawEta, transaction }) {

        if (!rawEta) {

            return {

                finalEta: null,

                rawEta: null,

                calibrationOffsetHours: null,

                calibrationId: null

            };

        }

        const activeCalibration =
            await this.calibrationRepository.findActiveByModelAndRecipeVersion(

                modelType,

                recipeVersionId,

                transaction

            );

        if (!activeCalibration) {

            return {

                finalEta: rawEta,

                rawEta,

                calibrationOffsetHours: null,

                calibrationId: null

            };

        }

        const offsetHours =
            Number(activeCalibration.offsetHours);

        const finalEta =
            new Date(

                new Date(rawEta).getTime() + offsetHours * 60 * 60 * 1000

            ).toISOString();

        return {

            finalEta,

            rawEta,

            calibrationOffsetHours: offsetHours,

            calibrationId: activeCalibration.id

        };

    }

    /*
     * Snapshot de los datos de entrada usados para esta predicción
     * (sección 3), tomados de la PRIMERA medición F1 del lote (inicio
     * de la fase) más el volumen objetivo del lote y la recipeVersion
     * usada -- exactamente los campos del ejemplo de la especificación:
     * startingPh, startingBrix, startingTemperature, ambientTemperature,
     * targetVolume, recipeVersionId.
     */
    _buildInputSnapshot(firstMeasurement, batch, recipeVersion) {

        return {

            startingPh: firstMeasurement.ph ?? null,

            startingBrix: firstMeasurement.brix ?? null,

            startingTemperature: firstMeasurement.liquidTemperature ?? null,

            ambientTemperature: firstMeasurement.ambientTemperature ?? null,

            targetVolume: batch.targetVolume ?? null,

            recipeVersionId: recipeVersion.id

        };

    }

    /*
     * predictedDurationHours: horas desde el INICIO de la fase F1 (la
     * primera medición F1 registrada) hasta el ETA predicho -- no desde
     * el momento en que se genera la predicción. Confirmado contra los
     * dos ejemplos numéricos de la especificación (sección 7): usar
     * "desde el momento de la predicción" no reproduce el segundo
     * ejemplo (92.5h), mientras que "desde el inicio de la fase" sí --
     * consistente además con la convención de horas-desde-inicio-de-fase
     * que ya usa evaluateHistorical() desde la Entrega 2.6.1.2.
     */
    _computeDurationHours(firstMeasurementDate, predictedMaturationAt) {

        if (!predictedMaturationAt) {

            return null;

        }

        const startMillis =
            new Date(firstMeasurementDate).getTime();

        const etaMillis =
            new Date(predictedMaturationAt).getTime();

        if (!Number.isFinite(startMillis) || !Number.isFinite(etaMillis)) {

            return null;

        }

        const hours =
            (etaMillis - startMillis) / (1000 * 60 * 60);

        return Math.round(hours * 100) / 100;

    }

    /*
     * Genera (y persiste) una nueva predicción trazable para un lote,
     * usando el modelo ACTIVE configurado para su recipeVersion. Nunca
     * modifica predicciones anteriores del mismo lote -- solo marca
     * isCurrent=false en ellas (sección 5) dentro de la misma
     * transacción en la que se crea la nueva, para que nunca queden dos
     * predicciones "actuales" a la vez ni el lote se quede sin ninguna
     * a medio camino.
     *
     * Regresa null (sin lanzar error, sin bloquear nada) cuando falta
     * algún prerequisito -- ver comentario de la clase.
     */
    async generatePrediction(batchId, transaction = null) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            return null;

        }

        const recipeVersion =
            batch.recipeVersion;

        if (!recipeVersion || !recipeVersion.maturationMetric) {

            return null;

        }

        // El modelo activo SIEMPRE se lee de la configuración vigente
        // -- nunca un valor fijo en el código (sección 8).
        const activeConfiguration =
            await this.modelConfigurationRepository.findActiveByRecipeVersion(recipeVersion.id, transaction);

        if (!activeConfiguration) {

            return null;

        }

        const measurements =
            await this.measurementRepository.findByBatch(batchId);

        const f1Measurements =
            (measurements || [])

                .filter(m => m.phase === "F1")

                .sort((a, b) =>

                    new Date(a.measurementDate).getTime() -
                    new Date(b.measurementDate).getTime()

                );

        if (f1Measurements.length === 0) {

            return null;

        }

        const firstMeasurement =
            f1Measurements[0];

        const toNumberOrNull = value =>

            value === null || value === undefined
                ? null
                : Number(value);

        const analysis =
            MaturationCalculator.analyze({

                measurements: f1Measurements,

                metric: recipeVersion.maturationMetric,

                targetValue: toNumberOrNull(recipeVersion.maturationTarget),

                rateThreshold: toNumberOrNull(recipeVersion.maturationRateThreshold),

                targetTolerance: toNumberOrNull(recipeVersion.maturationTargetTolerance),

                phase: "F1"

            });

        const modelResult =
            activeConfiguration.modelType === "LINEAR"
                ? analysis.linear
                : analysis.exponential;

        const rawPredictedMaturationAt =
            modelResult ? modelResult.eta : null;

        const inputData =
            this._buildInputSnapshot(firstMeasurement, batch, recipeVersion);

        return this.transactional(async t => {

            // Entrega 2.6.1.16 -- si existe una calibración ACTIVE para
            // este (modelType, recipeVersionId), predictedMaturationAt
            // (el valor FINAL, el que de verdad se usa/muestra) es la
            // salida cruda del modelo + el offset. rawEta se guarda
            // siempre, con o sin calibración (sección 9), y
            // calibrationOffsetHours/calibrationId quedan null cuando
            // no aplicó ninguna.
            const calibrationResult =
                await this._applyActiveCalibration({

                    modelType: activeConfiguration.modelType,

                    recipeVersionId: recipeVersion.id,

                    rawEta: rawPredictedMaturationAt,

                    transaction: t

                });

            const predictedMaturationAt =
                calibrationResult.finalEta;

            const predictedDurationHours =
                this._computeDurationHours(firstMeasurement.measurementDate, predictedMaturationAt);

            await this.repository.markAllNotCurrent(batchId, t);

            const created =
                await this.repository.create({

                    productionBatchId: batchId,

                    modelConfigurationId: activeConfiguration.id,

                    predictedAt: new Date(),

                    predictedMaturationAt,

                    predictedDurationHours,

                    modelType: activeConfiguration.modelType,

                    inputData: JSON.stringify(inputData),

                    isCurrent: true,

                    rawPredictedMaturationAt: calibrationResult.rawEta,

                    calibrationOffsetHours: calibrationResult.calibrationOffsetHours,

                    calibrationId: calibrationResult.calibrationId

                }, t);

            return this._serializeSummary(created);

        }, transaction);

    }

    /*
     * Historial de predicciones de un lote (sección 6), más reciente
     * primero. Forma plana -- coincide con el ejemplo JSON de la
     * especificación (lista de {id, predictedAt, modelType, ...}).
     */
    async getHistory(batchId) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        const predictions =
            await this.repository.findByBatch(batchId);

        return {

            batchId: Number(batchId),

            predictions: predictions.map(p => this._serializeSummary(p))

        };

    }

    /*
     * Detalle completo de UNA predicción (sección 7): incluye la
     * configuración de modelo exacta que la produjo (con su
     * activatedAt/source, no solo el tipo) y el snapshot de datos de
     * entrada usados, deserializado.
     */
    async getDetail(predictionId) {

        const prediction =
            await this.repository.findById(predictionId);

        if (!prediction) {

            throw new Error("Prediction not found");

        }

        // Entrega 2.6.1.13 -- adición puramente aditiva: el detalle ya
        // existente (2.6.1.12) ahora también incluye la evaluación
        // Predicción vs. Real, para que la vista de detalle no necesite
        // una segunda petición. No modifica ningún campo existente de
        // la predicción.
        const batch =
            await this.batchRepository.findById(prediction.productionBatchId);

        const actualMaturationAt =
            batch ? (batch.finishedAt ?? null) : null;

        const evaluation =
            PredictionEvaluation.evaluatePrediction({

                predictedMaturationAt: prediction.predictedMaturationAt,

                predictedDurationHours: prediction.predictedDurationHours,

                actualMaturationAt

            });

        const modelConfiguration =
            prediction.modelConfiguration;

        let inputs = null;

        if (prediction.inputData) {

            try {

                inputs = JSON.parse(prediction.inputData);

            } catch (err) {

                inputs = null;

            }

        }

        return {

            id: prediction.id,

            batchId: prediction.productionBatchId,

            // Entrega 2.6.1.26, sección 7 -- "La referencia calibrationId
            // debe ser la fuente de verdad": expuesto también como campo
            // raíz (no solo anidado dentro de `calibration`), tal como
            // muestra el ejemplo JSON de la especificación
            // ({id,batchId,predictedHours,calibrationId,calibration:{...}}).
            calibrationId: prediction.calibrationId ?? null,

            model: modelConfiguration
                ? {

                    configurationId: modelConfiguration.id,

                    type: modelConfiguration.modelType,

                    activatedAt: modelConfiguration.activatedAt,

                    source: modelConfiguration.source

                }
                : {

                    configurationId: prediction.modelConfigurationId,

                    type: prediction.modelType,

                    activatedAt: null,

                    source: null

                },

            prediction: {

                predictedAt: prediction.predictedAt,

                predictedMaturationAt: prediction.predictedMaturationAt,

                durationHours: prediction.predictedDurationHours

            },

            inputs,

            notes: prediction.notes,

            isCurrent: prediction.isCurrent,

            actual: { maturationAt: actualMaturationAt },

            evaluation,

            calibration: this._serializeCalibration(prediction)

        };

    }

    /*
     * Entrega 2.6.1.16 -- bloque "Predicción calibrada" (sección 15):
     * nunca esconde la predicción original. `applied` distingue
     * explícitamente "no había calibración ACTIVE" de "el offset
     * aplicado fue 0" -- ambos casos existen y no deben confundirse.
     *
     * Entrega 2.6.1.26, sección 3/4/7 -- extendido (puramente aditivo,
     * ningún campo existente cambia de forma ni de significado) con
     * `record`: la info ACTUAL (no la que tenía en el momento de la
     * predicción) de la calibración referenciada -- id/version/status/
     * createdAt/parentCalibrationId/recipeVersionId, tal como está HOY
     * en `maturation_model_calibrations`. Es intencional que sea la
     * info "en vivo": sección 3 explícitamente contempla que el estado
     * mostrado sea INACTIVE si esa calibración ya fue reemplazada --
     * nunca se congela un snapshot de version/status al momento de
     * generar la predicción (a diferencia de calibrationId/offsetHours/
     * rawPredictedMaturationAt, que sí son inmutables por diseño desde
     * 2.6.1.16, sección 2 de esta entrega). Requiere que el repositorio
     * haya incluido la asociación `calibration` (findById()/
     * findByBatch(), 2.6.1.26) -- si no vino incluida (o no hay
     * calibración aplicada), `record` queda null sin lanzar error.
     */
    _serializeCalibration(prediction) {

        const calibrationRecord =
            prediction.calibration
                ? {

                    id: prediction.calibration.id,

                    version: prediction.calibration.version,

                    status: prediction.calibration.status,

                    createdAt: prediction.calibration.createdAt,

                    parentCalibrationId: prediction.calibration.parentCalibrationId ?? null,

                    recipeVersionId: prediction.calibration.recipeVersionId ?? null

                }
                : null;

        return {

            applied: prediction.calibrationId !== null && prediction.calibrationId !== undefined,

            calibrationId: prediction.calibrationId ?? null,

            rawPredictedMaturationAt: prediction.rawPredictedMaturationAt ?? null,

            offsetHours: prediction.calibrationOffsetHours !== null && prediction.calibrationOffsetHours !== undefined
                ? Number(prediction.calibrationOffsetHours)
                : null,

            finalPredictedMaturationAt: prediction.predictedMaturationAt,

            record: calibrationRecord

        };

    }

    /*
     * Entrega 2.6.1.13 -- Comparación Predicción vs. Maduración Real.
     *
     * Reutiliza el evento de maduración real YA existente
     * (`ProductionBatch.finishedAt`, estampado cuando el usuario
     * finaliza F1 vía `ProductionBatchService.complete()`) en vez de
     * introducir un campo nuevo (sección 2). No persiste ningún
     * resultado: se recalcula bajo demanda a partir de dos hechos
     * inmutables (la predicción y `finishedAt`), así que siempre es
     * reproducible sin riesgo de quedar desincronizado, y nunca toca
     * la fila de MaturationPrediction (sección 10).
     */
    async evaluatePredictionById(predictionId) {

        const prediction =
            await this.repository.findById(predictionId);

        if (!prediction) {

            throw new Error("Prediction not found");

        }

        const batch =
            await this.batchRepository.findById(prediction.productionBatchId);

        const actualMaturationAt =
            batch ? (batch.finishedAt ?? null) : null;

        const evaluation =
            PredictionEvaluation.evaluatePrediction({

                predictedMaturationAt: prediction.predictedMaturationAt,

                predictedDurationHours: prediction.predictedDurationHours,

                actualMaturationAt

            });

        return {

            predictionId: prediction.id,

            batchId: prediction.productionBatchId,

            prediction: { maturationAt: prediction.predictedMaturationAt },

            actual: { maturationAt: actualMaturationAt },

            evaluation,

            calibration: this._serializeCalibration(prediction)

        };

    }

    /*
     * Sección 12: conjunto completo de predicciones de un lote, cada
     * una con su propia evaluación contra la MISMA maduración real
     * (un solo `finishedAt` por lote). Orden cronológico ascendente
     * (primera predicción -> más reciente) para leerse como una línea
     * de tiempo de aprendizaje -- a diferencia de `getHistory()`
     * (2.6.1.12), que ordena más-reciente-primero para la vista de
     * "estado actual".
     *
     * `status` a nivel de lote distingue explícitamente (sección 14):
     *   - "NO_PREDICTION" -- hay maduración real pero nunca se generó
     *     ninguna predicción para este lote (no se fabrica una
     *     evaluación de la nada).
     *   - "PENDING"       -- existen predicciones pero el lote no ha
     *     finalizado F1 todavía (sin actualMaturationAt).
     *   - "EVALUATED"     -- hay al menos una predicción y ya existe
     *     maduración real; cada predicción individual lleva su propio
     *     status/direction.
     */
    async getBatchPredictionAnalysis(batchId) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        const actualMaturationAt =
            batch.finishedAt ?? null;

        const predictions =
            await this.repository.findByBatch(batchId);

        const chronological =
            [...predictions].sort((a, b) =>

                new Date(a.predictedAt).getTime() -
                new Date(b.predictedAt).getTime()

            );

        const evaluatedPredictions =
            chronological.map(p => {

                const evaluation =
                    PredictionEvaluation.evaluatePrediction({

                        predictedMaturationAt: p.predictedMaturationAt,

                        predictedDurationHours: p.predictedDurationHours,

                        actualMaturationAt

                    });

                return {

                    id: p.id,

                    modelType: p.modelType,

                    isCurrent: p.isCurrent,

                    predictedAt: p.predictedAt,

                    predictedMaturationAt: p.predictedMaturationAt,

                    predictedDurationHours: p.predictedDurationHours,

                    errorHours: evaluation.errorHours,

                    absoluteErrorHours: evaluation.absoluteErrorHours,

                    errorPercentage: evaluation.errorPercentage,

                    direction: evaluation.direction,

                    status: evaluation.status,

                    calibration: this._serializeCalibration(p)

                };

            });

        let status;

        if (evaluatedPredictions.length === 0) {

            status = actualMaturationAt ? "NO_PREDICTION" : "PENDING";

        } else {

            status = actualMaturationAt ? "EVALUATED" : "PENDING";

        }

        return {

            batchId: Number(batchId),

            actual: { maturationAt: actualMaturationAt },

            status,

            predictions: evaluatedPredictions

        };

    }

    _serializeSummary(record) {

        return {

            id: record.id,

            batchId: record.productionBatchId,

            // Entrega 2.6.1.26, sección 7 -- ver comentario equivalente
            // en getDetail() arriba.
            calibrationId: record.calibrationId ?? null,

            modelConfigurationId: record.modelConfigurationId,

            modelType: record.modelType,

            predictedAt: record.predictedAt,

            predictedMaturationAt: record.predictedMaturationAt,

            predictedDurationHours: record.predictedDurationHours,

            isCurrent: record.isCurrent,

            calibration: this._serializeCalibration(record)

        };

    }

}

module.exports =
    MaturationPredictionService;
