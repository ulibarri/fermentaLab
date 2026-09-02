const BaseService =
    require("./BaseService");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const CarbonationCalculator =
    require("../utils/CarbonationCalculator");

const HydrometerConverter =
    require("../utils/HydrometerConverter");

// Entrega 2.8.0.2, sección 18 -- reemplaza la llamada directa a
// `HydrometerConverter.convert()` (2.8.0.1, tabla embebida en código)
// por el servicio que resuelve la tabla ACTIVE en base de datos. El
// comportamiento visible no cambia; `resolveHydrometerValues()` pasa de
// síncrono a asíncrono porque ahora depende de una consulta a base de
// datos (ver comentario ahí mismo).
const HydrometerConversionService =
    require("./HydrometerConversionService");

const MaturationCalculator =
    require("../utils/MaturationCalculator");

const MaturationModelConfigurationRepository =
    require("../repositories/MaturationModelConfigurationRepository");

const MaturationPredictionService =
    require("./MaturationPredictionService");

const ProductionPredictionAlertService =
    require("./ProductionPredictionAlertService");

const ProductionAlertActionService =
    require("./ProductionAlertActionService");

const VALID_PHASES = ["F1", "F2", "FINAL"];

// Entrega 2.8.0.1, sección 2 -- mismas tres escalas que
// `HydrometerConverter.VALID_SCALES`, reexpuesto aquí solo para no
// depender de que el frontend/tests conozcan la forma interna del
// módulo puro (mismo criterio que `VALID_PHASES` de arriba).
const VALID_HYDROMETER_SCALES =
    HydrometerConverter.VALID_SCALES;

class ProductionMeasurementService
    extends BaseService {

    constructor() {

        super(

            new ProductionMeasurementRepository()

        );

        this.batchRepository =
            new ProductionBatchRepository();

        this.modelConfigurationRepository =
            new MaturationModelConfigurationRepository();

        this.predictionService =
            new MaturationPredictionService();

        this.alertService =
            new ProductionPredictionAlertService();

        this.alertActionService =
            new ProductionAlertActionService();

        this.hydrometerConversionService =
            new HydrometerConversionService();

    }

    validate(data) {

        if (!data) {

            throw new Error("No se recibieron datos.");

        }

        if (!data.measurementDate) {

            throw new Error("measurementDate es obligatoria.");

        }

        if (!data.phase) {

            throw new Error("phase es obligatoria.");

        }

        if (!VALID_PHASES.includes(data.phase)) {

            throw new Error(
                `phase debe ser una de: ${VALID_PHASES.join(", ")}.`
            );

        }

        // Entrega 2.8.0.3, sección 12 -- "Rechazar: SG negativo, Brix
        // negativo, Alcohol negativo, valores no numéricos". Antes de
        // esta entrega, un valor no numérico (ej. una cadena que no
        // parsea) pasaba de largo silenciosamente -- `NaN < 0` es
        // `false`, así que las comparaciones de abajo nunca lo
        // atrapaban, y el valor crudo terminaba persistido tal cual.
        // `requireFiniteIfPresent()` cierra ese hueco para los seis
        // campos numéricos de esta entidad, sin cambiar ningún límite
        // ya existente (sigue siendo válido omitir cualquiera de estos
        // campos por completo -- mediciones parciales, ej. una lectura
        // de solo pH, siguen permitidas, sección 13 "conservar
        // completamente mediciones existentes").
        const requireFiniteIfPresent = (value, fieldName) => {

            if (value === undefined || value === null || value === "") {

                return;

            }

            if (!Number.isFinite(Number(value))) {

                throw new Error(`${fieldName} debe ser un número.`);

            }

        };

        requireFiniteIfPresent(data.ph, "ph");
        requireFiniteIfPresent(data.brix, "brix");
        requireFiniteIfPresent(data.brixLafmate, "brixLafmate");
        requireFiniteIfPresent(data.specificGravity, "specificGravity");
        requireFiniteIfPresent(data.estimatedAlcohol, "estimatedAlcohol");
        requireFiniteIfPresent(data.psi, "psi");

        if (data.ph !== undefined && data.ph !== null) {

            if (data.ph < 0 || data.ph > 14) {

                throw new Error("ph debe estar entre 0 y 14.");

            }

        }

        if (data.brix !== undefined && data.brix !== null) {

            if (data.brix < 0) {

                throw new Error("brix debe ser mayor o igual a 0.");

            }

        }

        if (data.brixLafmate !== undefined && data.brixLafmate !== null) {

            if (data.brixLafmate < 0) {

                throw new Error("brixLafmate debe ser mayor o igual a 0.");

            }

        }

        if (data.specificGravity !== undefined && data.specificGravity !== null) {

            if (data.specificGravity <= 0) {

                throw new Error("specificGravity debe ser mayor a 0.");

            }

        }

        // Entrega 2.8.0.3, sección 12 -- "Alcohol negativo" faltaba por
        // completo antes de esta entrega (specificGravity/brix/psi ya
        // se validaban, estimatedAlcohol nunca).
        if (data.estimatedAlcohol !== undefined && data.estimatedAlcohol !== null) {

            if (data.estimatedAlcohol < 0) {

                throw new Error("estimatedAlcohol debe ser mayor o igual a 0.");

            }

        }

        if (data.psi !== undefined && data.psi !== null) {

            if (data.psi < 0) {

                throw new Error("psi debe ser mayor o igual a 0.");

            }

        }

        // Entrega 2.8.0.1, sección 2/6 -- modo automático: si el
        // operador eligió "calcular valores a partir de una lectura",
        // `hydrometerInputScale` debe ser una escala válida y
        // `hydrometerInputValue` debe venir presente y ser numérico. La
        // conversión en sí (incluyendo el rechazo de valores fuera de
        // rango, sección 12) ocurre en `buildValues()` -- aquí solo se
        // valida la FORMA de la solicitud, para fallar rápido antes de
        // tocar la base de datos.
        if (data.hydrometerInputScale !== undefined && data.hydrometerInputScale !== null && data.hydrometerInputScale !== "") {

            const scale =
                String(data.hydrometerInputScale).trim().toUpperCase();

            if (!VALID_HYDROMETER_SCALES.includes(scale)) {

                throw new Error(

                    `hydrometerInputScale debe ser una de: ${VALID_HYDROMETER_SCALES.join(", ")}.`

                );

            }

            const value =
                Number(data.hydrometerInputValue);

            if (data.hydrometerInputValue === undefined || data.hydrometerInputValue === null || data.hydrometerInputValue === "" || Number.isNaN(value)) {

                throw new Error(

                    "hydrometerInputValue debe ser un número cuando se especifica hydrometerInputScale."

                );

            }

        }

    }

    calculateCo2Volumes(phase, psi, ambientTemperature) {

        if (phase !== "F2") {

            return null;

        }

        if (psi === null || psi === undefined) {

            return null;

        }

        if (ambientTemperature === null || ambientTemperature === undefined) {

            return null;

        }

        try {

            const result =
                CarbonationCalculator.calculate({

                    psi,

                    temperature: ambientTemperature

                });

            return result.co2Volumes;

        } catch (err) {

            // No bloqueamos el guardado de la medición si la combinación
            // de PSI/temperatura queda fuera del dominio de la fórmula;
            // simplemente no se puede estimar el CO2 para esa lectura.

            return null;

        }

    }

    /*
     * Entrega 2.8.0.1, secciones 2/6/10 -- resuelve SG/Brix/Alcohol y
     * su trazabilidad. Cuando el operador NO pidió conversión
     * automática (`hydrometerInputScale` ausente), el comportamiento es
     * EXACTAMENTE el de antes de esta entrega: los tres valores se
     * guardan tal como llegaron (sección 2, "esto conserva el
     * comportamiento actual"), y `hydrometerConversionMethod` queda
     * "MANUAL" solo si el operador de verdad capturó al menos uno de
     * los tres (nunca se etiqueta "MANUAL" a una fila F2 que ni
     * siquiera muestra estos campos).
     *
     * Cuando SÍ pidió conversión automática, el servidor NUNCA confía
     * en los valores de `specificGravity`/`brix`/`estimatedAlcohol` que
     * el cliente haya podido enviar -- siempre recalcula desde cero con
     * `HydrometerConversionService` (la MISMA fuente de verdad que
     * `POST /api/hydrometer/convert`, nunca una segunda copia de la
     * lógica de interpolación), igual que `calculateCo2Volumes()` de
     * abajo nunca confía en un `co2Volumes` recibido del cliente. Fuera
     * de rango (sección 12 de 2.8.0.1) se propaga tal cual -- error
     * controlado, nunca una extrapolación silenciosa.
     *
     * Entrega 2.8.0.2, sección 5 -- además de los tres campos de
     * trazabilidad de 2.8.0.1, ahora también resuelve
     * `hydrometerConversionTableId`: CON qué versión de tabla se
     * calculó. `HydrometerConversionService.convert()` ahora consulta
     * la tabla ACTIVE en base de datos, así que este método pasa a ser
     * asíncrono (antes llamaba a un módulo puro en memoria).
     */
    async resolveHydrometerValues(data) {

        const rawScale =
            data.hydrometerInputScale;

        const hasAutoRequest =
            rawScale !== undefined && rawScale !== null && rawScale !== "";

        if (!hasAutoRequest) {

            const hasManualReading =
                data.specificGravity !== undefined && data.specificGravity !== null ||
                data.brix !== undefined && data.brix !== null ||
                data.estimatedAlcohol !== undefined && data.estimatedAlcohol !== null;

            return {

                specificGravity: data.specificGravity ?? null,

                brix: data.brix ?? null,

                estimatedAlcohol: data.estimatedAlcohol ?? null,

                hydrometerInputScale: null,

                hydrometerInputValue: null,

                hydrometerConversionMethod: hasManualReading ? "MANUAL" : null,

                hydrometerConversionTableId: null

            };

        }

        const scale =
            String(rawScale).trim().toUpperCase();

        const value =
            Number(data.hydrometerInputValue);

        const converted =
            await this.hydrometerConversionService.convert({ scale, value });

        return {

            specificGravity: converted.result.sg,

            brix: converted.result.brix,

            estimatedAlcohol: converted.result.alcohol,

            hydrometerInputScale: scale,

            hydrometerInputValue: value,

            hydrometerConversionMethod: converted.method,

            hydrometerConversionTableId: converted.tableId

        };

    }

    async buildValues(data) {

        const isF2 =
            data.phase === "F2";

        const psi =
            isF2 ? (data.psi ?? null) : 0;

        const ambientTemperature =
            data.ambientTemperature ?? null;

        const co2Volumes =
            this.calculateCo2Volumes(

                data.phase,

                psi,

                ambientTemperature

            );

        const hydrometer =
            await this.resolveHydrometerValues(data);

        return {

            measurementDate: data.measurementDate,

            phase: data.phase,

            ph: data.ph ?? null,

            brix: hydrometer.brix,

            // Sección 9 -- el Brix del refractómetro BrixMate/LAFmate es
            // una medición DISTINTA e independiente; nunca se toca ni se
            // deriva de la conversión del hidrómetro.
            brixLafmate: data.brixLafmate ?? null,

            specificGravity: hydrometer.specificGravity,

            estimatedAlcohol: hydrometer.estimatedAlcohol,

            liquidTemperature: data.liquidTemperature ?? null,

            ambientTemperature,

            psi,

            co2Volumes,

            notes: data.notes ?? null,

            hydrometerInputScale: hydrometer.hydrometerInputScale,

            hydrometerInputValue: hydrometer.hydrometerInputValue,

            hydrometerConversionMethod: hydrometer.hydrometerConversionMethod,

            hydrometerConversionTableId: hydrometer.hydrometerConversionTableId

        };

    }

    async findByBatch(batchId) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        return await this.repository.findByBatch(batchId);

    }

    async getMaturationPrediction(batchId, phase = "F1") {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        const recipeVersion =
            batch.recipeVersion;

        if (!recipeVersion || !recipeVersion.maturationMetric) {

            return {

                configured: false,

                message: "Este lote no tiene configurado un objetivo de maduración en su receta."

            };

        }

        const measurements =
            await this.repository.findByBatch(batchId);

        const toNumberOrNull = value =>

            value === null || value === undefined
                ? null
                : Number(value);

        const analysis =
            MaturationCalculator.analyze({

                measurements,

                metric: recipeVersion.maturationMetric,

                targetValue: toNumberOrNull(recipeVersion.maturationTarget),

                rateThreshold: toNumberOrNull(recipeVersion.maturationRateThreshold),

                targetTolerance: toNumberOrNull(recipeVersion.maturationTargetTolerance),

                phase

            });

        // Entrega 2.6.1.11: qué modelo está ACTIVE para esta
        // recipeVersion (sección 12 — "las nuevas predicciones deberán
        // obtener el modelo desde esta configuración", en vez de un
        // `const model = "LINEAR"` fijo en el código). Esto es
        // puramente informativo sobre la MISMA analyze() en vivo de
        // siempre -- no persiste ni recalcula nada, así que no toca
        // predicciones históricas (sección 13). Si todavía no hay
        // ningún modelo activo configurado para esta receta,
        // activeModelStatus queda explícito en "NO_ACTIVE_MODEL"
        // (sección 12) en vez de asumir uno por defecto.
        const activeConfiguration =
            await this.modelConfigurationRepository.findActiveByRecipeVersion(recipeVersion.id);

        const activeModel =
            activeConfiguration ? activeConfiguration.modelType : null;

        const activePrediction =
            activeModel === "LINEAR"
                ? analysis.linear
                : activeModel === "EXPONENTIAL"
                    ? analysis.exponential
                    : null;

        return {

            configured: true,

            ...analysis,

            activeModel,

            activeModelStatus: activeModel ? "ACTIVE_MODEL_CONFIGURED" : "NO_ACTIVE_MODEL",

            activeModelConfigurationId: activeConfiguration ? activeConfiguration.id : null,

            activePrediction

        };

    }

    async getMaturationEvaluation(batchId, phase = "F1") {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        const recipeVersion =
            batch.recipeVersion;

        if (!recipeVersion || !recipeVersion.maturationMetric) {

            return {

                configured: false,

                message: "Este lote no tiene configurado un objetivo de maduración en su receta."

            };

        }

        const measurements =
            await this.repository.findByBatch(batchId);

        const toNumberOrNull = value =>

            value === null || value === undefined
                ? null
                : Number(value);

        const evaluation =
            MaturationCalculator.evaluateHistorical({

                measurements,

                metric: recipeVersion.maturationMetric,

                targetValue: toNumberOrNull(recipeVersion.maturationTarget),

                phase

            });

        return {

            configured: true,

            ...evaluation

        };

    }

    async createForBatch(batchId, data) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        if (batch.status === "PLANNED") {

            throw new Error(
                "No se pueden agregar mediciones a lotes en estado PLANNED."
            );

        }

        this.validate(data);

        const created =
            await this.repository.create({

                productionBatchId: batchId,

                ...(await this.buildValues(data))

            });

        // Entrega 2.6.1.12, sección 9/12: cada medición F1 nueva es el
        // disparador natural de una predicción trazable nueva -- no se
        // genera en cada GET del endpoint en vivo (eso inundaría la
        // tabla con una fila por cada vez que alguien mira la
        // pantalla). generatePrediction() ya hace no-op silencioso
        // (regresa null) cuando falta algún prerequisito (sin modelo
        // activo, sin maturationMetric, etc.) -- pero además se
        // envuelve aquí en try/catch para la garantía dura de que
        // NUNCA se bloquea ni se revierte el registro de una medición
        // por un problema al generar la predicción de auditoría.
        if (created.phase === "F1") {

            try {

                // Entrega 2.7.0.2, sección 2 -- se pasa la medición
                // recién creada como `triggerMeasurement` para que
                // generatePrediction() pueda decidir si es relevante
                // para el modelo (no toda medición F1 dispara un
                // recálculo -- ver PredictionRelevance.js).
                const newPrediction =
                    await this.predictionService.generatePrediction(batchId, { triggerMeasurement: created });

                // Entrega 2.7.0.3, sección 14 -- "Nueva medición ->
                // Actualizar predicción -> Evaluar desviación". Solo se
                // evalúa cuando REALMENTE se generó una predicción nueva
                // (newPrediction no es null) -- si generatePrediction()
                // fue un no-op (medición irrelevante, sin modelo activo,
                // etc.), no hay nada nuevo contra qué comparar y
                // reevaluar sería trabajo redundante sobre exactamente
                // el mismo par actual/anterior ya evaluado la vez
                // pasada. Envuelto en su PROPIO try/catch, independiente
                // del de generatePrediction() -- un fallo al evaluar la
                // desviación nunca debe impedir que la predicción recién
                // generada quede guardada (sección 15: "una alerta
                // jamás debe impedir registrar una medición").
                if (newPrediction) {

                    try {

                        await this.alertService.evaluateForBatch(batchId);

                    } catch (alertErr) {

                        console.error(

                            `[ProductionMeasurementService] No se pudo evaluar la desviación de predicción para el lote ${batchId}:`,

                            alertErr.message

                        );

                    }

                    // Entrega 2.7.0.6, sección 4/14 -- "Nueva medición ->
                    // Predicción actualizada -> Evaluar acción pendiente".
                    // Mismo criterio de siempre: SOLO cuando realmente
                    // hubo una predicción nueva (ya garantizado por estar
                    // dentro de este `if`), y en su PROPIO try/catch,
                    // independiente del de arriba -- un fallo al evaluar
                    // la efectividad de una acción nunca debe impedir que
                    // la predicción ni la evaluación de desviación recién
                    // calculadas queden guardadas (mismo principio que
                    // sección 15 de 2.7.0.3, "una alerta jamás debe
                    // impedir registrar una medición").
                    try {

                        await this.alertActionService.evaluatePendingActionsForBatch(batchId);

                    } catch (actionErr) {

                        console.error(

                            `[ProductionMeasurementService] No se pudo evaluar la efectividad de acciones pendientes para el lote ${batchId}:`,

                            actionErr.message

                        );

                    }

                }

            } catch (err) {

                // Entrega 2.7.0.2, sección 10 -- "se registra el error
                // técnico": esto reemplaza el silencio total de
                // 2.6.1.12 (comentario original: "no se re-lanza ni se
                // registra como error"), un cambio deliberado pedido
                // explícitamente por esta entrega. Las garantías de
                // robustez de siempre NO cambian -- el error nunca se
                // relanza, nunca bloquea ni revierte el guardado de la
                // medición, y nunca sobrescribe la última predicción
                // válida (eso ya lo garantiza la transacción interna de
                // generatePrediction(), que no marca ninguna predicción
                // anterior como no-vigente hasta haber creado con éxito
                // la fila nueva). Solo se agrega la visibilidad que
                // faltaba.
                console.error(

                    `[ProductionMeasurementService] No se pudo generar la predicción para el lote ${batchId} tras la medición ${created.id}:`,

                    err.message

                );

            }

        }

        return created;

    }

    async update(id, data) {

        const measurement =
            await this.repository.findById(id);

        if (!measurement) {

            throw new Error("Measurement not found");

        }

        this.validate(data);

        return await this.repository.update(

            id,

            await this.buildValues(data)

        );

    }

    async delete(id) {

        const measurement =
            await this.repository.findById(id);

        if (!measurement) {

            throw new Error("Measurement not found");

        }

        return await this.repository.delete(id);

    }

}

module.exports =
    ProductionMeasurementService;
