/*
 * Métricas agregadas de precisión por modelo (Entrega 2.6.1.14).
 *
 * Módulo puro (sin Sequelize ni Express) que da el siguiente paso
 * sobre la Entrega 2.6.1.13: en vez de preguntar "¿cuánto se equivocó
 * ESTA predicción?", agrega el errorHours con signo de TODAS las
 * predicciones ya evaluadas (PredictionEvaluation, status EVALUATED)
 * de un modelo para responder "¿qué tan bueno es este modelo en
 * general?" -- MAE (magnitud), RMSE (penaliza errores grandes), Bias
 * (tendencia sistemática), y la distribución EARLY/LATE/EXACT.
 *
 * Solo consume evaluaciones ya calculadas (errorHours/direction) --
 * nunca recalcula ni modifica una predicción o evaluación individual
 * (sección 15): PredictionEvaluation → Query → Aggregation, nunca al
 * revés.
 */

// Sección 10: por debajo de este tamaño de muestra, la métrica no debe
// presentarse como evidencia concluyente -- se define aquí de forma
// independiente (aunque coincide numéricamente con
// MIN_EVALUATED_BATCHES_FOR_COMPARISON de 2.6.1.3/2.6.1.7) porque el
// propio spec de esta entrega especifica el corte explícitamente.
const MIN_SUFFICIENT_SAMPLE = 5;

// Entrega 2.6.1.27, sección 2 -- desviación poblacional (÷N, no N-1),
// mismo criterio ya establecido por TemporalStability.standardDeviation()
// (2.6.1.10): con muestras tan pequeñas (5-20 predicciones típicamente)
// estamos describiendo la dispersión de ESAS observaciones concretas,
// no estimando un parámetro poblacional más amplio. Se reutiliza esa
// misma función en vez de reimplementarla -- ambos módulos son puros,
// sin dependencia circular entre ellos.
const { standardDeviation } =
    require("./TemporalStability");

function round(value, decimals) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

class ModelAccuracyMetrics {

    /*
     * MAE = Σ|errorHours| / N (sección 2). Magnitud del error, sin
     * importar la dirección.
     */
    static computeMAE(errorHoursList) {

        if (!Array.isArray(errorHoursList) || errorHoursList.length === 0) {

            return null;

        }

        const sum =
            errorHoursList.reduce((acc, e) => acc + Math.abs(e), 0);

        return sum / errorHoursList.length;

    }

    /*
     * RMSE = √(Σerror² / N) (sección 3). Penaliza más los errores
     * grandes que el MAE -- útil para detectar modelos que aciertan en
     * promedio pero ocasionalmente fallan mucho.
     */
    static computeRMSE(errorHoursList) {

        if (!Array.isArray(errorHoursList) || errorHoursList.length === 0) {

            return null;

        }

        const sumSquares =
            errorHoursList.reduce((acc, e) => acc + (e * e), 0);

        return Math.sqrt(sumSquares / errorHoursList.length);

    }

    /*
     * Bias = Σerrorhours / N (sección 4, CON signo -- a diferencia del
     * MAE). Positivo => el modelo tiende a predecir ANTES de la
     * maduración real (EARLY sistemático); negativo => tiende a
     * predecir DESPUÉS (LATE sistemático).
     */
    static computeBias(errorHoursList) {

        if (!Array.isArray(errorHoursList) || errorHoursList.length === 0) {

            return null;

        }

        const sum =
            errorHoursList.reduce((acc, e) => acc + e, 0);

        return sum / errorHoursList.length;

    }

    /*
     * Sección 10: por debajo de MIN_SUFFICIENT_SAMPLE, la métrica no
     * debe presentarse como evidencia fuerte -- nunca oculta el
     * número, solo lo acompaña con una clasificación explícita.
     */
    static classifySampleSize(n) {

        return n >= MIN_SUFFICIENT_SAMPLE
            ? "SUFFICIENT_SAMPLE"
            : "LOW_SAMPLE";

    }

    /*
     * Punto de entrada principal: agrega un conjunto de evaluaciones ya
     * calculadas (status EVALUATED únicamente -- sección 6: nunca
     * PENDING/NO_PREDICTION, nunca error 0) de UN modelo.
     *
     * `evaluations` es un arreglo de { errorHours, direction } --
     * exactamente los campos que PredictionEvaluation.evaluatePrediction()
     * ya calculó para cada predicción evaluada (sección 15: se
     * consumen, no se recalculan desde cero).
     */
    static summarizeModelAccuracy(modelType, evaluations) {

        const list =
            Array.isArray(evaluations) ? evaluations : [];

        const sampleSize =
            list.length;

        const errorHoursList =
            list.map(e => e.errorHours);

        const maeHours =
            round(this.computeMAE(errorHoursList), 2);

        const rmseHours =
            round(this.computeRMSE(errorHoursList), 2);

        const biasHours =
            round(this.computeBias(errorHoursList), 2);

        // Entrega 2.6.1.27, sección 2 -- "error mínimo"/"error máximo"
        // se leen en la misma unidad que el MAE (magnitud, |errorHours|):
        // responden "en el mejor/peor caso, ¿cuánto nos equivocamos?",
        // no "¿cuál fue el error con signo más extremo?". La desviación
        // SÍ se calcula sobre el error CON signo (no el absoluto) --
        // complementa al Bias mostrando qué tan consistente es esa
        // tendencia sistemática, mismo par Bias+dispersión que
        // TemporalStability ya usa para MAE+stddev por ventana.
        const absoluteErrorHoursList =
            errorHoursList.map(e => Math.abs(e));

        const minAbsoluteErrorHours =
            round(absoluteErrorHoursList.length > 0 ? Math.min(...absoluteErrorHoursList) : null, 2);

        const maxAbsoluteErrorHours =
            round(absoluteErrorHoursList.length > 0 ? Math.max(...absoluteErrorHoursList) : null, 2);

        const errorStdDevHours =
            standardDeviation(errorHoursList);

        let earlyCount = 0;

        let lateCount = 0;

        let exactCount = 0;

        for (const e of list) {

            if (e.direction === "EARLY") earlyCount++;

            else if (e.direction === "LATE") lateCount++;

            else if (e.direction === "EXACT") exactCount++;

        }

        const percentage = count =>

            sampleSize > 0
                ? round((count / sampleSize) * 100, 2)
                : null;

        return {

            modelType,

            sampleSize,

            maeHours,

            rmseHours,

            biasHours,

            // Entrega 2.6.1.27 -- aditivo, ver comentario arriba.
            minAbsoluteErrorHours,

            maxAbsoluteErrorHours,

            errorStdDevHours,

            earlyCount,

            lateCount,

            exactCount,

            earlyPercentage: percentage(earlyCount),

            latePercentage: percentage(lateCount),

            exactPercentage: percentage(exactCount),

            sampleClassification: this.classifySampleSize(sampleSize)

        };

    }

    /*
     * Sección 13: "Comparación directa" -- SOLO señala cuál modelo tuvo
     * menor MAE/RMSE en los lotes evaluados, nunca convierte esto en
     * una recomendación (eso sigue siendo trabajo exclusivo de
     * ModelRecommendation.js / 2.6.1.10, sección 14: "no debemos
     * modificar todavía las reglas de recomendación"). Regresa null en
     * cada campo cuando falta algún dato o hay empate -- nunca se
     * inventa un "ganador" de un empate o de datos incompletos.
     */
    static buildComparison(models) {

        const list =
            Array.isArray(models) ? models : [];

        if (list.length !== 2) {

            return { lowerMae: null, lowerRmse: null };

        }

        const [a, b] = list;

        const bothHaveSamples =
            a.sampleSize > 0 && b.sampleSize > 0;

        const lowerMae =
            bothHaveSamples && a.maeHours !== null && b.maeHours !== null && a.maeHours !== b.maeHours
                ? (a.maeHours < b.maeHours ? a.modelType : b.modelType)
                : null;

        const lowerRmse =
            bothHaveSamples && a.rmseHours !== null && b.rmseHours !== null && a.rmseHours !== b.rmseHours
                ? (a.rmseHours < b.rmseHours ? a.modelType : b.modelType)
                : null;

        return { lowerMae, lowerRmse };

    }

    /*
     * Sección 12: interpretación sencilla y literal, generada aquí (no
     * en el frontend) para que el lenguaje quede centralizado y
     * controlado -- igual que las razones de ModelRecommendation.js
     * (2.6.1.10). Deliberadamente NUNCA genera frases como "es
     * estadísticamente mejor" (sección 12, explícito): solo describe
     * comparaciones puntuales (menor MAE) y tendencias (Bias con
     * signo), sin traducirlas en una conclusión de superioridad.
     */
    static buildInterpretation(models) {

        const list =
            Array.isArray(models) ? models : [];

        const sentences = [];

        const comparison =
            this.buildComparison(list);

        if (comparison.lowerMae) {

            const other =
                list.find(m => m.modelType !== comparison.lowerMae);

            sentences.push(

                `${comparison.lowerMae} presenta menor MAE que ${other ? other.modelType : "el otro modelo"} en los lotes evaluados.`

            );

        }

        // Umbral de 0.1h: un bias casi nulo no amerita una frase de
        // "tendencia" -- sería ruido, no una tendencia sistemática
        // real (mismo espíritu que el umbral EXACT de 2.6.1.13).
        const BIAS_MENTION_THRESHOLD_HOURS = 0.1;

        for (const model of list) {

            if (model.sampleSize > 0 && model.biasHours !== null && Math.abs(model.biasHours) > BIAS_MENTION_THRESHOLD_HOURS) {

                const direction =
                    model.biasHours > 0 ? "positivo" : "negativo";

                const tendency =
                    model.biasHours > 0 ? "antes" : "después";

                sentences.push(

                    `${model.modelType} presenta un Bias ${direction}, lo que indica una tendencia a predecir ${tendency} de la maduración real.`

                );

            }

        }

        return sentences;

    }

}

ModelAccuracyMetrics.MIN_SUFFICIENT_SAMPLE =
    MIN_SUFFICIENT_SAMPLE;

module.exports =
    ModelAccuracyMetrics;
