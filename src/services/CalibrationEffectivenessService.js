const MaturationModelCalibrationRepository =
    require("../repositories/MaturationModelCalibrationRepository");

const MaturationPredictionRepository =
    require("../repositories/MaturationPredictionRepository");

const MaturationCalibrationEvaluationRepository =
    require("../repositories/MaturationCalibrationEvaluationRepository");

const ModelAccuracyMetrics =
    require("../utils/ModelAccuracyMetrics");

const PredictionEvaluation =
    require("../utils/PredictionEvaluation");

const CalibrationEffectiveness =
    require("../utils/CalibrationEffectiveness");

const CalibrationHealth =
    require("../utils/CalibrationHealth");

const CalibrationComparison =
    require("../utils/CalibrationComparison");

const PostActivationEvaluation =
    require("../utils/PostActivationEvaluation");

function toNumberOrNull(value) {

    return value === null || value === undefined ? null : Number(value);

}

/*
 * Evaluación de efectividad de la calibración (Entrega 2.6.1.17).
 *
 * Responde "¿la calibración realmente mejora las predicciones?"
 * comparando, SOBRE EXACTAMENTE LOS MISMOS LOTES, el desempeño que
 * hubieran tenido sin calibrar (`rawPredictedMaturationAt`) contra el
 * desempeño con calibración (`predictedMaturationAt`) -- nunca
 * reconstruye una segunda predicción, sección 17: ambos escenarios ya
 * están en la misma fila de MaturationPrediction.
 *
 * El punto crítico del spec (sección 2) es evitar contaminación:
 * jamás evaluar una calibración con los mismos lotes que se usaron
 * para calcular su Bias/offset original. La forma en que esto se
 * garantiza aquí es indirecta pero robusta: `_collectComparisons()`
 * solo mira predicciones con `calibrationId` = esta calibración
 * (ver `MaturationPredictionRepository.findByCalibration()`), y
 * `calibrationId` solo se estampa en el momento de GENERAR una
 * predicción NUEVA con esta calibración ya ACTIVE (2.6.1.16) -- nunca
 * en los lotes históricos que sirvieron de evidencia para *proponer*
 * la calibración (esos lotes nunca tuvieron esta calibración como
 * `calibrationId`, porque en su momento la calibración ni siquiera
 * existía). Esto también resuelve de un solo golpe las cinco
 * exclusiones de la sección 16 (modelType, recipeVersionId, fecha de
 * activación, "usó esta calibración específica") -- ver el comentario
 * de `findByCalibration()`.
 */
class CalibrationEffectivenessService {

    constructor() {

        this.calibrationRepository =
            new MaturationModelCalibrationRepository();

        this.predictionRepository =
            new MaturationPredictionRepository();

        this.evaluationRepository =
            new MaturationCalibrationEvaluationRepository();

    }

    async _requireCalibration(calibrationId) {

        const calibration =
            await this.calibrationRepository.findById(calibrationId);

        if (!calibration) {

            throw new Error("Calibration not found");

        }

        return calibration;

    }

    /*
     * Arma, para cada predicción que usó esta calibración y ya tiene
     * maduración real, DOS evaluaciones pareadas -- Escenario A (sin
     * calibrar, contra `rawPredictedMaturationAt`) y Escenario B (con
     * calibración, contra `predictedMaturationAt`, sección 4). Si
     * cualquiera de los dos escenarios no fuera evaluable para una
     * predicción dada (defensivo -- no debería ocurrir dado el
     * invariante de 2.6.1.16, pero nunca se asume), esa predicción se
     * excluye de AMBAS listas -- nunca se comparan tamaños de muestra
     * distintos entre escenarios (mismo criterio de intersección que
     * `ModelComparisonService`, 2.6.1.7).
     */
    async _collectComparisons(calibrationId) {

        const predictions =
            await this.predictionRepository.findByCalibration(calibrationId);

        const rawEvaluations = [];

        const calibratedEvaluations = [];

        for (const prediction of predictions) {

            const batch =
                prediction.productionBatch;

            const actualMaturationAt =
                batch ? (batch.finishedAt ?? null) : null;

            // Sección 16: solo predicciones con maduración real ya
            // registrada -- un lote todavía en curso no aporta
            // evidencia de efectividad todavía.
            if (!actualMaturationAt) {

                continue;

            }

            const rawEval =
                PredictionEvaluation.evaluatePrediction({

                    predictedMaturationAt: prediction.rawPredictedMaturationAt,

                    predictedDurationHours: null,

                    actualMaturationAt

                });

            const calibratedEval =
                PredictionEvaluation.evaluatePrediction({

                    predictedMaturationAt: prediction.predictedMaturationAt,

                    predictedDurationHours: null,

                    actualMaturationAt

                });

            if (rawEval.status !== "EVALUATED" || calibratedEval.status !== "EVALUATED") {

                continue;

            }

            // Entrega 2.6.1.27, sección 4 -- `finishedAt` es aditivo:
            // ModelAccuracyMetrics.summarizeModelAccuracy() solo lee
            // `errorHours`/`direction` de cada entrada (nunca se
            // desestructura de forma estricta), así que ningún
            // consumidor existente de este método (evaluate()/
            // evaluateAndStore()/getHealth()/getAllActiveHealth(),
            // todos desde 2.6.1.17/18) se ve afectado -- solo
            // getPostActivationEvaluation() (nuevo) lo usa, para poder
            // calcular el "periodo evaluado" (sección 4: fecha del
            // resultado real más reciente disponible) sin una segunda
            // consulta a la base de datos.
            rawEvaluations.push({ errorHours: rawEval.errorHours, direction: rawEval.direction, finishedAt: actualMaturationAt });

            calibratedEvaluations.push({ errorHours: calibratedEval.errorHours, direction: calibratedEval.direction, finishedAt: actualMaturationAt });

        }

        return { rawEvaluations, calibratedEvaluations };

    }

    /*
     * Evaluación EN VIVO (sección 15: GET .../evaluation) -- nunca
     * persiste nada, reproduce exactamente la forma del ejemplo JSON
     * de la sección 10, incluyendo el desglose EARLY/LATE/EXACT de
     * ambos escenarios (que la tabla persistida, sección 11, no
     * guarda -- ver MaturationCalibrationEvaluation).
     */
    async evaluate(calibrationId) {

        const calibration =
            await this._requireCalibration(calibrationId);

        const { rawEvaluations, calibratedEvaluations } =
            await this._collectComparisons(calibrationId);

        const rawSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy("RAW", rawEvaluations);

        const calibratedSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy("CALIBRATED", calibratedEvaluations);

        return CalibrationEffectiveness.buildEvaluation({

            calibrationId: calibration.id,

            modelType: calibration.modelType,

            recipeVersionId: calibration.recipeVersionId,

            raw: rawSummary,

            calibrated: calibratedSummary

        });

    }

    /*
     * Sección 15: POST .../evaluate -- calcula (igual que evaluate())
     * y ADEMÁS guarda una fila en maturation_calibration_evaluations,
     * para poder observar en el historial si la calibración sigue
     * siendo útil conforme llegan más lotes (sección 14). Nunca
     * modifica la calibración ni ninguna predicción (criterio de
     * aceptación explícito, sección 19) -- es una operación de solo
     * lectura + un insert nuevo, nunca un update.
     *
     * Entrega 2.6.1.18 -- además del resultado puntual de 2.6.1.17,
     * ahora también calcula y persiste el estado de SALUD en ese mismo
     * momento (ventana reciente/anterior, tendencia, recomendación de
     * recalibración -- sección 19: "cada evaluación deberá conservar
     * [...] health, trend"). Reutiliza LA MISMA consulta de
     * comparaciones (`_collectComparisons()`) para ambos cálculos --
     * nunca se vuelve a consultar la base de datos dos veces para la
     * misma llamada.
     */
    async evaluateAndStore(calibrationId) {

        const calibration =
            await this._requireCalibration(calibrationId);

        const { rawEvaluations, calibratedEvaluations } =
            await this._collectComparisons(calibrationId);

        const rawSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy("RAW", rawEvaluations);

        const calibratedSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy("CALIBRATED", calibratedEvaluations);

        const evaluation =
            CalibrationEffectiveness.buildEvaluation({

                calibrationId: calibration.id,

                modelType: calibration.modelType,

                recipeVersionId: calibration.recipeVersionId,

                raw: rawSummary,

                calibrated: calibratedSummary

            });

        const healthReport =
            this._buildHealthReport(calibration, rawEvaluations, calibratedEvaluations);

        const stored =
            await this.evaluationRepository.create({

                calibrationId: calibration.id,

                // El período naturalmente empieza en la activación (antes
                // de eso ninguna predicción pudo haber usado esta
                // calibración) y termina en el momento en que se corre
                // esta evaluación -- el spec no define explícitamente
                // estos dos campos más allá de "inicio/fin del período",
                // esta es la lectura más directa.
                evaluationStartedAt: calibration.activatedAt ?? null,

                evaluationEndedAt: new Date(),

                sampleSize: evaluation.evaluationSampleSize,

                rawMaeHours: evaluation.raw ? evaluation.raw.maeHours : null,

                calibratedMaeHours: evaluation.calibrated ? evaluation.calibrated.maeHours : null,

                rawRmseHours: evaluation.raw ? evaluation.raw.rmseHours : null,

                calibratedRmseHours: evaluation.calibrated ? evaluation.calibrated.rmseHours : null,

                rawBiasHours: evaluation.raw ? evaluation.raw.biasHours : null,

                calibratedBiasHours: evaluation.calibrated ? evaluation.calibrated.biasHours : null,

                maeImprovementHours: evaluation.maeImprovementHours,

                maeImprovementPercentage: evaluation.maeImprovementPercentage,

                result: evaluation.result,

                recentSampleSize: healthReport.recent.sampleSize,

                recentMaeHours: healthReport.recent.maeHours,

                recentBiasHours: healthReport.recent.biasHours,

                previousWindowSampleSize: healthReport.previousWindow.sampleSize,

                previousWindowMaeHours: healthReport.previousWindow.maeHours,

                previousWindowBiasHours: healthReport.previousWindow.biasHours,

                maeChangePercentage: healthReport.maeChangePercentage,

                trend: healthReport.trend,

                health: healthReport.health,

                recommendRecalibration: healthReport.recommendRecalibration

            });

        return {

            ...evaluation,

            id: stored.id,

            evaluationStartedAt: stored.evaluationStartedAt,

            evaluationEndedAt: stored.evaluationEndedAt,

            createdAt: stored.createdAt,

            health: healthReport.health,

            trend: healthReport.trend,

            recommendRecalibration: healthReport.recommendRecalibration

        };

    }

    /*
     * Entrega 2.6.1.18 -- estado de salud EN VIVO de una calibración
     * (sección 16: GET .../health). Nunca persiste nada por sí solo --
     * el snapshot solo se congela cuando se corre evaluateAndStore()
     * (sección 17: "el estado puede calcularse bajo demanda", no
     * requiere infraestructura adicional).
     */
    async getHealth(calibrationId) {

        const calibration =
            await this._requireCalibration(calibrationId);

        const { rawEvaluations, calibratedEvaluations } =
            await this._collectComparisons(calibrationId);

        return this._buildHealthReport(calibration, rawEvaluations, calibratedEvaluations);

    }

    /*
     * Sección 16: GET /calibrations/health -- salud de TODAS las
     * calibraciones actualmente ACTIVE (nunca las PROPOSED/APPROVED/
     * REJECTED/INACTIVE -- solo las que de verdad están afectando
     * predicciones nuevas ahora mismo son relevantes para un dashboard
     * de monitoreo). Forma más delgada que getHealth() individual, tal
     * cual el ejemplo JSON de la sección 16.
     */
    async getAllActiveHealth() {

        const activeCalibrations =
            await this.calibrationRepository.findAll({ status: "ACTIVE" });

        const calibrations = [];

        for (const calibration of activeCalibrations) {

            const { rawEvaluations, calibratedEvaluations } =
                await this._collectComparisons(calibration.id);

            const report =
                this._buildHealthReport(calibration, rawEvaluations, calibratedEvaluations);

            calibrations.push({

                calibrationId: report.calibrationId,

                modelType: report.modelType,

                recipeVersionId: report.recipeVersionId,

                health: report.health,

                recentSampleSize: report.recent.sampleSize,

                recentMaeHours: report.recent.maeHours,

                recommendRecalibration: report.recommendRecalibration

            });

        }

        return { calibrations };

    }

    /*
     * Núcleo compartido por getHealth()/getAllActiveHealth()/
     * evaluateAndStore(): arma la ventana móvil (sección 3) a partir de
     * las comparaciones YA calculadas por `_collectComparisons()`
     * (ambos arreglos vienen en orden cronológico ascendente, en el
     * mismo orden y con el mismo largo -- ver esa función). "Reciente"
     * son las últimas `CalibrationHealth.RECENT_WINDOW_SIZE`
     * evaluaciones; "ventana anterior" son las `RECENT_WINDOW_SIZE`
     * inmediatamente previas a esas; "histórico" es el conjunto
     * completo desde la activación (sección 4) -- exactamente lo mismo
     * que `evaluate()` calcula para el escenario calibrado.
     */
    _buildHealthReport(calibration, rawEvaluations, calibratedEvaluations) {

        const total =
            calibratedEvaluations.length;

        const windowSize =
            CalibrationHealth.RECENT_WINDOW_SIZE;

        const recentStart =
            Math.max(0, total - windowSize);

        const previousStart =
            Math.max(0, total - (windowSize * 2));

        const recentCalibrated =
            calibratedEvaluations.slice(recentStart);

        const recentRaw =
            rawEvaluations.slice(recentStart);

        const previousWindowCalibrated =
            calibratedEvaluations.slice(previousStart, recentStart);

        const historicalSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy("CALIBRATED", calibratedEvaluations);

        const recentCalibratedSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy("CALIBRATED", recentCalibrated);

        const recentRawSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy("RAW", recentRaw);

        const previousWindowSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy("CALIBRATED", previousWindowCalibrated);

        return CalibrationHealth.buildHealthReport({

            calibrationId: calibration.id,

            modelType: calibration.modelType,

            recipeVersionId: calibration.recipeVersionId,

            status: calibration.status,

            historical: {

                sampleSize: historicalSummary.sampleSize,

                maeHours: historicalSummary.maeHours,

                biasHours: historicalSummary.biasHours,

                // Entrega 2.6.1.21, criterio 6 ("considere RMSE cuando
                // corresponda") -- campo aditivo. `buildHealthReport()`
                // (2.6.1.18) reenvía este objeto tal cual, nunca lo
                // desestructura más allá de sampleSize/maeHours/
                // biasHours, así que agregar rmseHours aquí no cambia
                // ningún cálculo de salud/tendencia existente, solo lo
                // expone para RecalibrationAlertRules.
                rmseHours: historicalSummary.rmseHours

            },

            recent: {

                sampleSize: recentCalibratedSummary.sampleSize,

                maeHours: recentCalibratedSummary.maeHours,

                biasHours: recentCalibratedSummary.biasHours,

                rmseHours: recentCalibratedSummary.rmseHours

            },

            previousWindow: {

                sampleSize: previousWindowSummary.sampleSize,

                maeHours: previousWindowSummary.maeHours,

                biasHours: previousWindowSummary.biasHours,

                rmseHours: previousWindowSummary.rmseHours

            },

            recentRawMaeHours: recentRawSummary.maeHours

        });

    }

    /*
     * Entrega 2.6.1.24, sección 5 -- ¿la calibración PROPUESTA (todavía
     * nunca ACTIVE, así que nunca generó predicciones propias) de
     * verdad representaría una mejora? No hay nada que "evaluar" en el
     * sentido de evaluate()/getHealth() (esos miden predicciones REALES
     * ya generadas bajo una calibración específica) -- en su lugar, se
     * SIMULA: se toma la MISMA ventana "reciente" de predicciones RAW
     * de la calibración ORIGEN que `_buildHealthReport()` ya usa para
     * su propio cálculo de salud (idéntica población, nunca una
     * muestra distinta -- por eso el sampleSize resultante aquí siempre
     * coincide con el `recent.sampleSize` de `getHealth(sourceCalibrationId)`)
     * y se recalcula cada predicción como si el offset PROPUESTO se
     * hubiera aplicado en vez del offset original de la calibración
     * origen. `PredictionEvaluation`/`ModelAccuracyMetrics` se
     * reutilizan sin ningún cambio -- lo único que cambia es la fecha
     * contra la que se evalúa cada predicción.
     *
     * Judgment call explícito: la sección 5 no especifica CÓMO calcular
     * los números de la columna "PROPUESTA" de su tabla de ejemplo (la
     * propuesta nunca tuvo predicciones reales propias) -- esta
     * simulación es la lectura más honesta y verificable disponible con
     * los datos que existen en este proyecto, y es la que responde
     * directamente a la pregunta que la sección 5 dice perseguir
     * ("que el usuario pueda determinar si la nueva calibración
     * realmente representa una mejora").
     */
    async simulateProposedOffset(sourceCalibrationId, proposedOffsetHours) {

        const predictions =
            await this.predictionRepository.findByCalibration(sourceCalibrationId);

        const evaluable =
            predictions.filter(p => p.productionBatch && p.productionBatch.finishedAt);

        const windowSize =
            CalibrationHealth.RECENT_WINDOW_SIZE;

        const recentStart =
            Math.max(0, evaluable.length - windowSize);

        const recentPredictions =
            evaluable.slice(recentStart);

        const offsetHoursMs =
            Number(proposedOffsetHours) * 3600000;

        const simulatedEvaluations =
            recentPredictions

                .map(p => {

                    const rawBaseMs =
                        new Date(p.rawPredictedMaturationAt).getTime();

                    const simulatedPredictedMaturationAt =
                        new Date(rawBaseMs + offsetHoursMs);

                    return PredictionEvaluation.evaluatePrediction({

                        predictedMaturationAt: simulatedPredictedMaturationAt,

                        predictedDurationHours: null,

                        actualMaturationAt: p.productionBatch.finishedAt

                    });

                })

                .filter(evaluation => evaluation.status === "EVALUATED")

                .map(evaluation => ({ errorHours: evaluation.errorHours, direction: evaluation.direction }));

        return ModelAccuracyMetrics.summarizeModelAccuracy("SIMULATED", simulatedEvaluations);

    }

    /*
     * Entrega 2.6.1.27 -- evaluación EN VIVO post-activación (sección
     * 1-9), nunca persiste nada (mismo criterio que getHealth(),
     * 2.6.1.18: "el estado puede calcularse bajo demanda"). Responde
     * la pregunta central de la entrega -- "¿esta calibración
     * realmente mejoró frente a la que reemplazó, ahora que ya está en
     * producción?" -- distinguiendo tres cosas que el resto del
     * sistema ya sabía calcular por separado pero nunca había juntado:
     *
     *   - `actual`: desempeño REAL post-activación de ESTA calibración
     *     (reutiliza `_collectComparisons()`, 2.6.1.17 -- las mismas
     *     predicciones reales que `evaluate()` ya usa para su columna
     *     "calibrated", solo que aquí se conserva el detalle
     *     min/max/stddev y las fechas para el periodo).
     *   - `simulatedPreActivation`: lo que esta calibración HABRÍA
     *     logrado si se hubiera simulado antes de activarla (reutiliza
     *     `simulateProposedOffset()`, 2.6.1.24, sin cambios -- sección
     *     1: "basada en las mismas predicciones crudas utilizadas por
     *     la calibración anterior"). null si esta calibración no tiene
     *     padre (primera versión, nunca fue una propuesta simulada).
     *   - `previousCalibration`/`comparisonVsPrevious`: el desempeño
     *     REAL post-activación de la calibración padre (secciones 6/8/
     *     11 -- "v3" en los ejemplos), comparado contra `actual` vía
     *     `PostActivationEvaluation.classifyPostActivationResult()`.
     *     Esta es una comparación DISTINTA de `simulatedPreActivation`
     *     -- una es simulación-vs-real (sección 1), la otra es
     *     real-vs-real entre dos calibraciones consecutivas (sección
     *     6) -- nunca se deben confundir ni fusionar en un solo número.
     *
     * Sección 10, criterio de aceptación explícito: este método es de
     * SOLO LECTURA -- no activa, desactiva ni modifica ninguna
     * calibración ni predicción, sin importar qué tan mala sea la
     * evaluación resultante.
     */
    async getPostActivationEvaluation(calibrationId) {

        const calibration =
            await this._requireCalibration(calibrationId);

        const { calibratedEvaluations } =
            await this._collectComparisons(calibrationId);

        const actualSummary =
            ModelAccuracyMetrics.summarizeModelAccuracy("ACTUAL", calibratedEvaluations);

        const evaluationStatus =
            PostActivationEvaluation.classifyEvaluationStatus(actualSummary.sampleSize);

        const period = {

            from: calibration.activatedAt ?? null,

            // Sección 4: el fin del periodo es la fecha del resultado
            // REAL más reciente ya disponible -- nunca "ahora mismo"
            // (a diferencia de `_buildComparisonSummary()`, 2.6.1.19,
            // que sí usa `new Date()` porque esa comparación es sobre
            // TODO lo evaluado desde la activación sin pretender un
            // límite preciso). Aquí el ejemplo de la sección 4
            // ("2026-08-11 -> 2026-08-20") es explícitamente la fecha
            // del último lote con resultado real, no la fecha de hoy.
            to: calibratedEvaluations.reduce(
                (latest, e) => (!latest || new Date(e.finishedAt) > new Date(latest)) ? e.finishedAt : latest,
                null
            )

        };

        // Sección 1 -- SIMULATED PERFORMANCE preactivación, solo tiene
        // sentido si esta calibración reemplazó a otra (una primera
        // versión manual, sin padre, nunca fue una propuesta simulada
        // -- no hay "antes de activarla" que reconstruir).
        const simulatedPreActivation =
            calibration.parentCalibrationId
                ? await this.simulateProposedOffset(calibration.parentCalibrationId, calibration.offsetHours)
                : null;

        // Secciones 6/8/11 -- desempeño REAL post-activación de la
        // calibración padre, calculado exactamente igual que `actual`
        // arriba (misma función, mismo tipo de evidencia -- nunca se
        // compara "real" contra "simulado" en esta sección, ver
        // comentario del método). Defensivo: si el padre ya no existe
        // (nunca debería pasar -- las calibraciones históricas no se
        // borran desde 2.6.1.19, sección 5) se omite en vez de fallar
        // toda la evaluación de la calibración actual.
        let previousCalibration = null;

        let comparisonVsPrevious = null;

        if (calibration.parentCalibrationId) {

            const parent =
                await this.calibrationRepository.findById(calibration.parentCalibrationId);

            if (parent) {

                const { calibratedEvaluations: parentCalibratedEvaluations } =
                    await this._collectComparisons(parent.id);

                const parentActualSummary =
                    ModelAccuracyMetrics.summarizeModelAccuracy("ACTUAL", parentCalibratedEvaluations);

                previousCalibration = {

                    calibrationId: parent.id,

                    version: parent.version,

                    status: parent.status,

                    actual: this._postActivationMetricsBlock(parentActualSummary)

                };

                comparisonVsPrevious =
                    PostActivationEvaluation.classifyPostActivationResult(actualSummary, parentActualSummary);

            }

        }

        return {

            calibrationId: calibration.id,

            modelType: calibration.modelType,

            recipeVersionId: calibration.recipeVersionId,

            version: calibration.version,

            // Sección 7 -- estos dos campos son DELIBERADAMENTE
            // independientes: `status` es el ciclo de vida de siempre
            // (ACTIVE/INACTIVE/...) y nunca lo toca este método;
            // `evaluationStatus` es el concepto nuevo de esta entrega.
            status: calibration.status,

            evaluationStatus,

            parentCalibrationId: calibration.parentCalibrationId ?? null,

            activatedAt: calibration.activatedAt ?? null,

            period,

            actual: this._postActivationMetricsBlock(actualSummary),

            simulatedPreActivation,

            previousCalibration,

            comparisonVsPrevious

        };

    }

    /*
     * Bloque de métricas compartido por `actual`/`previousCalibration.
     * actual` -- superset de `scenarioBlock()` (CalibrationEffectiveness.
     * buildEvaluation(), 2.6.1.17) que además incluye min/max/stddev
     * (sección 2, aditivo desde ModelAccuracyMetrics.summarizeModelAccuracy(),
     * 2.6.1.27).
     */
    _postActivationMetricsBlock(summary) {

        return {

            sampleSize: summary.sampleSize,

            maeHours: summary.maeHours,

            rmseHours: summary.rmseHours,

            biasHours: summary.biasHours,

            minAbsoluteErrorHours: summary.minAbsoluteErrorHours,

            maxAbsoluteErrorHours: summary.maxAbsoluteErrorHours,

            errorStdDevHours: summary.errorStdDevHours,

            earlyPercentage: summary.earlyPercentage,

            latePercentage: summary.latePercentage,

            exactPercentage: summary.exactPercentage

        };

    }

    /*
     * Entrega 2.6.1.19, sección 8-10 -- compara dos calibraciones
     * (típicamente dos versiones de la misma cadena, aunque el método
     * no lo exige) lado a lado: offset, estado, tamaño de muestra
     * REALMENTE evaluado post-activación, MAE/RMSE/Bias (reutilizando
     * `evaluate()`, nunca recalculado aquí) y periodo evaluado
     * (`activatedAt` -> ahora, mismo criterio que
     * `evaluateAndStore()` usa para persistir el período). Delega la
     * clasificación de evidencia/advertencias/resumen en prosa a
     * `CalibrationComparison.js` (módulo puro) -- este método solo
     * junta los datos.
     */
    async compare(idA, idB) {

        if (String(idA) === String(idB)) {

            throw new Error("Selecciona dos calibraciones distintas para comparar.");

        }

        const [calibrationA, calibrationB] = await Promise.all([

            this._requireCalibration(idA),

            this._requireCalibration(idB)

        ]);

        // Sección 14 aplica también aquí, no solo al crear un
        // reemplazo: una tabla comparativa entre modelos/recetas
        // distintos (offsets en escalas y contextos distintos) no es
        // una comparación con sentido -- se rechaza explícitamente en
        // vez de mostrar una tabla engañosa.
        if (calibrationA.modelType !== calibrationB.modelType || Number(calibrationA.recipeVersionId) !== Number(calibrationB.recipeVersionId)) {

            throw new Error("Solo se pueden comparar calibraciones del mismo modelType y la misma versión de receta.");

        }

        const [summaryA, summaryB] = await Promise.all([

            this._buildComparisonSummary(calibrationA),

            this._buildComparisonSummary(calibrationB)

        ]);

        return CalibrationComparison.buildComparison(summaryA, summaryB);

    }

    async _buildComparisonSummary(calibration) {

        const evaluation =
            await this.evaluate(calibration.id);

        return {

            calibrationId: calibration.id,

            version: calibration.version,

            modelType: calibration.modelType,

            recipeVersionId: calibration.recipeVersionId,

            offsetHours: calibration.offsetHours !== null && calibration.offsetHours !== undefined ? Number(calibration.offsetHours) : null,

            status: calibration.status,

            sampleSize: evaluation.evaluationSampleSize,

            evaluationPeriod: {

                from: calibration.activatedAt ?? null,

                to: new Date()

            },

            maeHours: evaluation.calibrated ? evaluation.calibrated.maeHours : null,

            rmseHours: evaluation.calibrated ? evaluation.calibrated.rmseHours : null,

            biasHours: evaluation.calibrated ? evaluation.calibrated.biasHours : null

        };

    }

    /*
     * Sección 14/15: historial de evaluaciones ya guardadas, más
     * reciente primero. Forma más delgada que evaluate() -- solo lo
     * que la tabla persiste (MAE/RMSE/Bias + mejora + resultado, sin
     * EARLY/LATE/EXACT, ver el comentario del modelo).
     */
    async getHistory(calibrationId) {

        await this._requireCalibration(calibrationId);

        const rows =
            await this.evaluationRepository.findByCalibration(calibrationId);

        return rows.map(record => this._serializeHistoryRow(record));

    }

    _serializeHistoryRow(record) {

        return {

            id: record.id,

            calibrationId: record.calibrationId,

            evaluationStartedAt: record.evaluationStartedAt,

            evaluationEndedAt: record.evaluationEndedAt,

            sampleSize: record.sampleSize,

            raw: {

                maeHours: toNumberOrNull(record.rawMaeHours),

                rmseHours: toNumberOrNull(record.rawRmseHours),

                biasHours: toNumberOrNull(record.rawBiasHours)

            },

            calibrated: {

                maeHours: toNumberOrNull(record.calibratedMaeHours),

                rmseHours: toNumberOrNull(record.calibratedRmseHours),

                biasHours: toNumberOrNull(record.calibratedBiasHours)

            },

            maeImprovementHours: toNumberOrNull(record.maeImprovementHours),

            maeImprovementPercentage: toNumberOrNull(record.maeImprovementPercentage),

            result: record.result,

            // Entrega 2.6.1.18 -- snapshot de salud congelado en el
            // momento de esta evaluación (sección 19: auditoría). Filas
            // guardadas ANTES de esta entrega tendrán estos campos en
            // null (la migración los agrega como nullable) -- nunca se
            // fabrica un valor retroactivo para evaluaciones viejas.
            recent: {

                sampleSize: record.recentSampleSize ?? null,

                maeHours: toNumberOrNull(record.recentMaeHours),

                biasHours: toNumberOrNull(record.recentBiasHours)

            },

            previousWindow: {

                sampleSize: record.previousWindowSampleSize ?? null,

                maeHours: toNumberOrNull(record.previousWindowMaeHours),

                biasHours: toNumberOrNull(record.previousWindowBiasHours)

            },

            maeChangePercentage: toNumberOrNull(record.maeChangePercentage),

            trend: record.trend ?? null,

            health: record.health ?? null,

            recommendRecalibration: Boolean(record.recommendRecalibration),

            createdAt: record.createdAt

        };

    }

}

module.exports =
    CalibrationEffectivenessService;
