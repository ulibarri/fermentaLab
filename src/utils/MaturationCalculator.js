/*
 * Predicción de maduración (Entrega 2.6.0.7).
 *
 * Módulo puro (sin Sequelize ni Express) que replica, de forma sistemática,
 * el análisis manual que se ha usado para decidir cuándo un lote está
 * cerca de su punto de maduración durante la primera fermentación (F1):
 *
 *   1. Tasa de cambio entre las dos lecturas más recientes de una métrica
 *      (ej. pH), en unidades/hora.
 *   2. Proyección lineal del ETA a un valor objetivo, usando esa tasa.
 *   3. Ajuste de un modelo de decaimiento exponencial hacia una asíntota
 *      sobre TODAS las lecturas disponibles de la fase:
 *
 *          valor(t) = asíntota + (valor0 - asíntota) * e^(-k*t)
 *
 *      usado para proyectar un ETA más estable y para estimar el plateau
 *      biológico al que tiende el lote (lo que permite detectar objetivos
 *      probablemente inalcanzables).
 *   4. Un nivel de confianza basado en cuántas lecturas hay disponibles y
 *      qué tan bien ajusta el modelo exponencial.
 *   5. Evaluación del criterio de maduración: tasa por debajo de un umbral
 *      Y valor dentro de una tolerancia del objetivo, simultáneamente.
 *
 * Este módulo NUNCA decide ni ejecuta transiciones de estado del lote —
 * solo calcula. La decisión de finalizar F1 sigue siendo del usuario.
 */

const VALID_METRICS = ["ph", "brix", "specificGravity"];

// Umbral de error residual (en unidades de la métrica) bajo el cual, con
// 5+ lecturas, se reporta confianza "HIGH" en vez de "MEDIUM". Es un
// criterio razonable, no un valor documentado externamente — puede
// ajustarse si la experiencia de uso sugiere otro corte.
const HIGH_CONFIDENCE_RESIDUAL_ERROR = 0.05;

// Entrega 2.6.1.0: número mínimo de lecturas para siquiera intentar el
// ajuste exponencial (antes era 3; con menos de 4 puntos el ajuste de 2
// parámetros -asíntota y k- queda prácticamente sin grados de libertad
// para validar su propia estabilidad).
const MIN_EXPONENTIAL_FIT_POINTS = 4;

// Cotas de plausibilidad para rechazar un ajuste "matemáticamente
// inestable o con parámetros absurdos" (Entrega 2.6.1.0), en vez de
// aceptar cualquier mínimo cuadrado que la búsqueda en rejilla encuentre:
//   - decayConstant muy cercano a 0 → básicamente no hay curvatura real,
//     la asíntota quedó fijada por el borde de la ventana de búsqueda,
//     no por los datos.
//   - decayConstant enorme → implica una vida media de minutos, no
//     físicamente plausible para fermentaciones medidas en horas.
//   - residualError alto en relación con el rango total de los valores
//     observados (más del 20%) → el modelo no está describiendo una
//     tendencia real, solo persiguiendo ruido.
const MIN_PLAUSIBLE_DECAY_CONSTANT = 1e-4;

const MAX_PLAUSIBLE_DECAY_CONSTANT = 5;

const MAX_RESIDUAL_TO_SPREAD_RATIO = 0.2;

// Entrega 2.6.1.1: para recomendar un modelo sobre otro, el RMSE del
// mejor debe ser al menos esta fracción menor que el del peor (mejora
// relativa). Por debajo de este umbral, la diferencia se considera
// ruido y no se recomienda ningún modelo — evita la "falsa precisión"
// de preferir un modelo por una diferencia mínima de RMSE.
const MIN_SIGNIFICANT_RMSE_IMPROVEMENT = 0.20;

// A partir de esta mejora relativa, la recomendación se reporta con
// confianza "HIGH" en vez de "MEDIUM" (siempre limitada por la propia
// confianza del ajuste exponencial — ver compareModels()).
const HIGH_SIGNIFICANT_RMSE_IMPROVEMENT = 0.50;

const CONFIDENCE_ORDER = ["INSUFFICIENT", "LOW", "MEDIUM", "HIGH"];

function round(value, decimals) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

function toNumberOrNull(value) {

    if (value === null || value === undefined || value === "") {

        return null;

    }

    const num = Number(value);

    return Number.isFinite(num) ? num : null;

}

class MaturationCalculator {

    /*
     * Convierte una lista de mediciones (ya ordenadas cronológicamente,
     * ascendente) en puntos { timestamp, hours, value } para la métrica
     * dada, descartando lecturas sin valor para esa métrica.
     */
    static extractPoints(measurements, metric) {

        if (!Array.isArray(measurements) || measurements.length === 0) {

            return [];

        }

        const withValue =
            measurements
                .map(m => ({

                    timestamp: new Date(m.measurementDate),

                    value: toNumberOrNull(m[metric])

                }))
                .filter(p =>

                    p.value !== null &&
                    !Number.isNaN(p.timestamp.getTime())

                );

        if (withValue.length === 0) {

            return [];

        }

        const t0 =
            withValue[0].timestamp.getTime();

        return withValue.map(p => ({

            timestamp: p.timestamp,

            hours: (p.timestamp.getTime() - t0) / (1000 * 60 * 60),

            value: p.value

        }));

    }

    /*
     * Tasa de cambio entre las dos últimas lecturas disponibles.
     * Regresa { rate, fromTimestamp, toTimestamp } o null si no hay al
     * menos 2 puntos, o si el intervalo de tiempo entre ellos es 0.
     */
    static calculateRate(points) {

        if (!Array.isArray(points) || points.length < 2) {

            return null;

        }

        const previous = points[points.length - 2];

        const current = points[points.length - 1];

        const deltaHours =
            current.hours - previous.hours;

        if (deltaHours <= 0) {

            return null;

        }

        const rate =
            (current.value - previous.value) / deltaHours;

        return {

            rate: round(rate, 6),

            fromTimestamp: previous.timestamp,

            toTimestamp: current.timestamp

        };

    }

    /*
     * Proyección lineal del ETA a targetValue usando la tasa más reciente.
     *
     * Regresa null solo cuando falta algún dato de entrada (no hay
     * corriente/objetivo/tasa/timestamp). Si los datos están completos
     * pero no se puede dar una ETA con sentido, regresa un objeto con
     * hoursRemaining/eta en null y una bandera explicando por qué —
     * nunca un número inventado (Entrega 2.6.0.9):
     *
     *   - divergent: true  → la tendencia actual se aleja del objetivo
     *     (ej. currentValue > targetValue pero rate > 0). Reportar una
     *     ETA aquí sería engañoso, así que no se reporta.
     *   - tasa esencialmente 0 → sin tendencia, tampoco hay ETA.
     *   - currentValue ya está en targetValue → hoursRemaining 0.
     */
    static linearProjection(currentValue, targetValue, rate, lastTimestamp) {

        if (

            currentValue === null || currentValue === undefined ||
            targetValue === null || targetValue === undefined ||
            rate === null || rate === undefined ||
            !lastTimestamp

        ) {

            return null;

        }

        const difference =
            round(currentValue - targetValue, 6);

        if (Math.abs(difference) < 1e-9) {

            return {

                difference: 0,

                hoursRemaining: 0,

                eta: lastTimestamp.toISOString(),

                divergent: false

            };

        }

        if (Math.abs(rate) < 1e-9) {

            return {

                difference,

                hoursRemaining: null,

                eta: null,

                divergent: false

            };

        }

        // El valor debe moverse en la dirección correcta para acercarse
        // al objetivo: si currentValue > targetValue, rate debe ser
        // negativo; si currentValue < targetValue, rate debe ser
        // positivo. Si no, la tendencia se aleja del objetivo.
        const needsToDecrease =
            difference > 0;

        const isMovingTowardTarget =
            needsToDecrease ? rate < 0 : rate > 0;

        if (!isMovingTowardTarget) {

            return {

                difference,

                hoursRemaining: null,

                eta: null,

                divergent: true

            };

        }

        const hoursRemaining =
            Math.abs(difference) / Math.abs(rate);

        const eta =
            new Date(
                lastTimestamp.getTime() +
                hoursRemaining * 60 * 60 * 1000
            );

        return {

            difference,

            hoursRemaining: round(hoursRemaining, 2),

            eta: eta.toISOString(),

            divergent: false

        };

    }

    /*
     * Regresión lineal simple: y = intercept + slope * x.
     * Regresa { slope, intercept } o null si no se puede resolver
     * (varianza de x es 0).
     */
    static _linearRegression(x, y) {

        const n = x.length;

        const meanX =
            x.reduce((a, b) => a + b, 0) / n;

        const meanY =
            y.reduce((a, b) => a + b, 0) / n;

        let num = 0;

        let den = 0;

        for (let i = 0; i < n; i++) {

            num += (x[i] - meanX) * (y[i] - meanY);

            den += (x[i] - meanX) * (x[i] - meanX);

        }

        if (den === 0) {

            return null;

        }

        const slope = num / den;

        const intercept = meanY - slope * meanX;

        return { slope, intercept };

    }

    /*
     * RMSE y R² de un modelo (cualquiera) contra los puntos observados,
     * dada una función que predice el valor esperado en cada `hours`.
     * Se usa tanto para el modelo lineal como para el exponencial
     * (Entrega 2.6.1.1), para garantizar que ambos se evalúan de forma
     * idéntica y comparable — no solo por su ETA.
     *
     * R² = 1 - SSres/SStot. Si SStot es 0 (todos los valores observados
     * son idénticos) R² no está definido matemáticamente y regresa null.
     */
    static _computeFitMetrics(points, predictFn) {

        const n = points.length;

        if (n === 0) {

            return { rmse: null, r2: null };

        }

        const y = points.map(p => p.value);

        const mean =
            y.reduce((a, b) => a + b, 0) / n;

        let ssRes = 0;

        let ssTot = 0;

        for (let i = 0; i < n; i++) {

            const predicted =
                predictFn(points[i].hours);

            ssRes += (y[i] - predicted) * (y[i] - predicted);

            ssTot += (y[i] - mean) * (y[i] - mean);

        }

        const rmse =
            Math.sqrt(ssRes / n);

        const r2 =
            ssTot > 0 ? 1 - ssRes / ssTot : null;

        return {

            rmse: round(rmse, 4),

            r2: r2 === null ? null : round(r2, 4)

        };

    }

    /*
     * Regresión lineal simple de valor vs. horas sobre TODOS los puntos
     * disponibles de la fase (a diferencia de linearProjection(), que
     * usa solo la tasa entre las dos últimas lecturas para el ETA
     * "operativo"). Esta regresión es la que se usa para poder comparar
     * en igualdad de condiciones al modelo lineal contra el exponencial
     * (Entrega 2.6.1.1: RMSE/R² de ambos, sobre las mismas mediciones).
     *
     * Requiere al menos 2 puntos. Regresa { slope, intercept, rmse, r2 }
     * o null si no se puede ajustar.
     */
    static fitLinearRegression(points) {

        if (!Array.isArray(points) || points.length < 2) {

            return null;

        }

        const t = points.map(p => p.hours);

        const y = points.map(p => p.value);

        const regression =
            this._linearRegression(t, y);

        if (!regression) {

            return null;

        }

        const metrics =
            this._computeFitMetrics(

                points,

                hours => regression.intercept + regression.slope * hours

            );

        return {

            slope: round(regression.slope, 6),

            intercept: round(regression.intercept, 4),

            rmse: metrics.rmse,

            r2: metrics.r2

        };

    }

    /*
     * Dado un candidato de asíntota A, linealiza el modelo exponencial
     * (ln|valor - A| = ln|valor0 - A| - k*t) y ajusta por regresión
     * lineal. Regresa { k, sse } o null si A no es un candidato válido
     * para estos datos (algún punto cruza la asíntota, o el decaimiento
     * resultante no tiene sentido físico).
     */
    static _fitForAsymptote(t, y, asymptote) {

        const diffs =
            y.map(v => v - asymptote);

        const sign = Math.sign(diffs[0]);

        if (sign === 0) {

            return null;

        }

        for (const d of diffs) {

            if (d === 0 || Math.sign(d) !== sign) {

                return null;

            }

        }

        const logY =
            diffs.map(d => Math.log(Math.abs(d)));

        const regression =
            this._linearRegression(t, logY);

        if (!regression) {

            return null;

        }

        const k = -regression.slope;

        if (!(k > 0) || !Number.isFinite(k)) {

            return null;

        }

        const v0Abs =
            Math.exp(regression.intercept);

        let sse = 0;

        for (let i = 0; i < t.length; i++) {

            const fitted =
                asymptote + sign * v0Abs * Math.exp(-k * t[i]);

            sse += (y[i] - fitted) * (y[i] - fitted);

        }

        return { k, v0Abs, sign, sse };

    }

    /*
     * Chequeo de plausibilidad del mejor ajuste encontrado (Entrega
     * 2.6.1.0): rechaza un ajuste con una constante de decaimiento fuera
     * de un rango físicamente razonable, o con un error residual que ya
     * no explica mejor los datos que una línea plana.
     */
    static _isPlausibleFit(decayConstant, residualError, spread) {

        if (!(decayConstant >= MIN_PLAUSIBLE_DECAY_CONSTANT) ||
            !(decayConstant <= MAX_PLAUSIBLE_DECAY_CONSTANT)) {

            return false;

        }

        if (!(residualError <= spread * MAX_RESIDUAL_TO_SPREAD_RATIO)) {

            return false;

        }

        return true;

    }

    /*
     * Ajusta el modelo de decaimiento exponencial hacia una asíntota
     * sobre todos los puntos disponibles, buscando la asíntota que
     * minimiza el error cuadrático (búsqueda en rejilla, refinada en
     * varias pasadas — no requiere dependencias externas de optimización
     * no lineal).
     *
     * Requiere al menos MIN_EXPONENTIAL_FIT_POINTS puntos con una
     * tendencia clara (no plana), y que el mejor ajuste encontrado pase
     * un chequeo de plausibilidad (Entrega 2.6.1.0) — si no, se
     * considera que el ajuste es matemáticamente inestable y se
     * descarta en vez de reportar una asíntota/ETA poco confiable.
     * Regresa { asymptote, decayConstant, initialValueFit, residualError }
     * o null si no se pudo ajustar.
     */
    static fitExponential(points) {

        if (!Array.isArray(points) || points.length < MIN_EXPONENTIAL_FIT_POINTS) {

            return null;

        }

        const t = points.map(p => p.hours);

        const y = points.map(p => p.value);

        const first = y[0];

        const last = y[y.length - 1];

        if (first === last) {

            return null;

        }

        const decreasing = last < first;

        const minY = Math.min(...y);

        const maxY = Math.max(...y);

        const spread = Math.max(maxY - minY, 0.01);

        let low = decreasing
            ? minY - spread * 3
            : maxY + 1e-6;

        let high = decreasing
            ? minY - 1e-6
            : maxY + spread * 3;

        let best = null;

        let bestAsymptote = null;

        const PASSES = 4;

        const STEPS = 200;

        for (let pass = 0; pass < PASSES; pass++) {

            const stepSize = (high - low) / STEPS;

            if (stepSize <= 0) {

                break;

            }

            for (let i = 0; i <= STEPS; i++) {

                const candidate = low + i * stepSize;

                const fit =
                    this._fitForAsymptote(t, y, candidate);

                if (fit && (best === null || fit.sse < best.sse)) {

                    best = fit;

                    bestAsymptote = candidate;

                }

            }

            if (bestAsymptote === null) {

                break;

            }

            const margin = stepSize * 2;

            low = bestAsymptote - margin;

            high = bestAsymptote + margin;

        }

        if (best === null || bestAsymptote === null) {

            return null;

        }

        const metrics =
            this._computeFitMetrics(

                points,

                hours => bestAsymptote + best.sign * best.v0Abs * Math.exp(-best.k * hours)

            );

        if (!this._isPlausibleFit(best.k, metrics.rmse, spread)) {

            return null;

        }

        return {

            asymptote: round(bestAsymptote, 4),

            decayConstant: round(best.k, 6),

            initialValueFit: round(bestAsymptote + best.sign * best.v0Abs, 4),

            residualError: metrics.rmse,

            rmse: metrics.rmse,

            r2: metrics.r2,

            _sign: best.sign,

            _v0Abs: best.v0Abs,

            _k: best.k,

            _asymptoteRaw: bestAsymptote

        };

    }

    /*
     * Determina si targetValue es alcanzable dado el ajuste exponencial,
     * y de ser así, el ETA (fecha) en la que se alcanzaría.
     * Regresa { reachable, eta } — eta es null si no es alcanzable o no
     * se pudo calcular.
     */
    static exponentialProjection(fit, points, targetValue) {

        if (!fit || targetValue === null || targetValue === undefined) {

            return null;

        }

        const decreasing =
            fit._sign > 0;
        // sign > 0 significa valor0 > asíntota (curva decreciente hacia
        // la asíntota); sign < 0 significa curva creciente.

        const reachable =
            decreasing
                ? targetValue >= fit.asymptote
                : targetValue <= fit.asymptote;

        if (!reachable) {

            return { reachable: false, eta: null };

        }

        const ratio =
            (targetValue - fit._asymptoteRaw) / (fit._sign * fit._v0Abs);

        if (!(ratio > 0) || !Number.isFinite(ratio)) {

            return { reachable: false, eta: null };

        }

        const tTarget =
            -Math.log(ratio) / fit._k;

        if (!Number.isFinite(tTarget)) {

            return { reachable: true, eta: null };

        }

        const firstTimestamp =
            points[0].timestamp;

        const eta =
            new Date(
                firstTimestamp.getTime() +
                tTarget * 60 * 60 * 1000
            );

        return { reachable: true, eta: eta.toISOString() };

    }

    /*
     * Nivel de confianza según cuántos puntos hay disponibles y, con 5+,
     * qué tan bien ajustó el modelo exponencial.
     *
     * Este método asume que ya existe un ajuste válido (fitExponential
     * no regresó null) — no debe usarse para decidir la confianza
     * cuando no hay ajuste en absoluto; en ese caso la confianza es
     * siempre "INSUFFICIENT" independientemente de cuántas lecturas
     * haya (ver analyze()), porque "muchas lecturas" no es lo mismo que
     * "el modelo ajustó razonablemente" (Entrega 2.6.1.0).
     */
    static determineConfidence(pointCount, residualError) {

        if (pointCount < MIN_EXPONENTIAL_FIT_POINTS) {

            return "INSUFFICIENT";

        }

        if (pointCount === MIN_EXPONENTIAL_FIT_POINTS) {

            return "LOW";

        }

        if (residualError === null || residualError === undefined) {

            return "MEDIUM";

        }

        return residualError <= HIGH_CONFIDENCE_RESIDUAL_ERROR
            ? "HIGH"
            : "MEDIUM";

    }

    /*
     * Evalúa el criterio de maduración de dos condiciones simultáneas:
     *   A) |rate| <= rateThreshold
     *   B) |currentValue - targetValue| <= targetTolerance
     * Regresa { rateConditionMet, targetConditionMet, readyForF1Finish,
     * status } donde status es "READY" | "APPROACHING" | "ACTIVE".
     */
    static evaluateReadiness(rate, currentValue, targetValue, rateThreshold, targetTolerance) {

        const canEvaluateRate =
            rate !== null && rate !== undefined &&
            rateThreshold !== null && rateThreshold !== undefined;

        const canEvaluateTarget =
            currentValue !== null && currentValue !== undefined &&
            targetValue !== null && targetValue !== undefined &&
            targetTolerance !== null && targetTolerance !== undefined;

        const rateConditionMet =
            canEvaluateRate && Math.abs(rate) <= rateThreshold;

        const targetConditionMet =
            canEvaluateTarget && Math.abs(currentValue - targetValue) <= targetTolerance;

        const readyForF1Finish =
            rateConditionMet && targetConditionMet;

        let status = "ACTIVE";

        if (readyForF1Finish) {

            status = "READY";

        } else if (rateConditionMet || targetConditionMet) {

            status = "APPROACHING";

        }

        return {

            rateConditionMet,

            targetConditionMet,

            readyForF1Finish,

            status

        };

    }

    /*
     * Entre dos niveles de confianza del vocabulario ya establecido
     * (INSUFFICIENT < LOW < MEDIUM < HIGH), regresa el más débil de los
     * dos. Se usa para que la confianza de una recomendación nunca sea
     * mayor que la confianza del propio ajuste en el que se basa.
     */
    static _weakerConfidence(a, b) {

        const indexA = CONFIDENCE_ORDER.indexOf(a);

        const indexB = CONFIDENCE_ORDER.indexOf(b);

        if (indexA === -1) {

            return b;

        }

        if (indexB === -1) {

            return a;

        }

        return indexA <= indexB ? a : b;

    }

    /*
     * Compara el modelo lineal (regresión completa) contra el
     * exponencial usando RMSE (Entrega 2.6.1.1) — nunca solo su ETA.
     *
     * Regresa { recommendedModel, confidence } donde recommendedModel
     * es "LINEAR" | "EXPONENTIAL" | null. Es null cuando falta alguno
     * de los dos RMSE (datos insuficientes para comparar) o cuando la
     * mejora relativa del mejor modelo sobre el peor no supera
     * MIN_SIGNIFICANT_RMSE_IMPROVEMENT — evita recomendar un modelo por
     * una diferencia de RMSE que bien podría ser ruido.
     *
     * La confianza de la recomendación nunca es mayor que la propia
     * confianza del ajuste exponencial: una diferencia de RMSE grande
     * calculada sobre un ajuste apenas aceptable (ej. 4-5 lecturas)
     * no debe reportarse como "HIGH".
     */
    static compareModels(linearRmse, exponentialRmse, exponentialConfidence) {

        if (

            linearRmse === null || linearRmse === undefined ||
            exponentialRmse === null || exponentialRmse === undefined

        ) {

            return { recommendedModel: null, confidence: "INSUFFICIENT" };

        }

        const betterRmse =
            Math.min(linearRmse, exponentialRmse);

        const worseRmse =
            Math.max(linearRmse, exponentialRmse);

        if (worseRmse <= 0) {

            // Ambos modelos ajustan perfectamente (o RMSE 0) — no hay
            // base numérica para preferir uno sobre el otro.
            return { recommendedModel: null, confidence: "LOW" };

        }

        const improvement =
            (worseRmse - betterRmse) / worseRmse;

        if (improvement < MIN_SIGNIFICANT_RMSE_IMPROVEMENT) {

            return { recommendedModel: null, confidence: "LOW" };

        }

        const better =
            exponentialRmse <= linearRmse ? "EXPONENTIAL" : "LINEAR";

        const gapTier =
            improvement >= HIGH_SIGNIFICANT_RMSE_IMPROVEMENT ? "HIGH" : "MEDIUM";

        const confidence =
            this._weakerConfidence(gapTier, exponentialConfidence || "INSUFFICIENT");

        return { recommendedModel: better, confidence };

    }

    /*
     * Punto de entrada principal: calcula el análisis completo de
     * maduración para una fase dada de un lote.
     *
     * params:
     *   measurements   — mediciones del lote (cualquier fase, se filtran
     *                    internamente por `phase`), ordenadas
     *                    cronológicamente ascendente.
     *   metric         — "ph" | "brix" | "specificGravity"
     *   targetValue, rateThreshold, targetTolerance — configuración de
     *                    maduración (pueden ser null si no está
     *                    configurada).
     *   phase          — fase a analizar (default "F1").
     */
    static analyze({ measurements, metric, targetValue, rateThreshold, targetTolerance, phase = "F1" }) {

        if (!VALID_METRICS.includes(metric)) {

            throw new Error(

                `Métrica de maduración no soportada: "${metric}". Valores permitidos: ${VALID_METRICS.join(", ")}.`

            );

        }

        const phaseMeasurements =
            (measurements || []).filter(m => m.phase === phase);

        const points =
            this.extractPoints(phaseMeasurements, metric);

        const currentValue =
            points.length > 0
                ? points[points.length - 1].value
                : null;

        const lastTimestamp =
            points.length > 0
                ? points[points.length - 1].timestamp
                : null;

        const rateResult =
            this.calculateRate(points);

        const rate =
            rateResult ? rateResult.rate : null;

        const linearProjectionResult =
            this.linearProjection(currentValue, targetValue, rate, lastTimestamp);

        // Regresión lineal completa sobre TODAS las mediciones de la
        // fase (independiente de la tasa/ETA "operativa" de arriba) —
        // es la que permite calcular RMSE/R² comparables contra el
        // modelo exponencial (Entrega 2.6.1.1).
        const linearRegression =
            this.fitLinearRegression(points);

        let linear = linearProjectionResult;

        if (linearRegression) {

            linear = linear
                ? { ...linear, rmse: linearRegression.rmse, r2: linearRegression.r2 }
                : {

                    difference: null,

                    hoursRemaining: null,

                    eta: null,

                    divergent: null,

                    rmse: linearRegression.rmse,

                    r2: linearRegression.r2

                };

        }

        const fit =
            this.fitExponential(points);

        // Si no hay ajuste (pocas lecturas, tendencia plana, o el
        // ajuste resultó matemáticamente inestable/absurdo — Entrega
        // 2.6.1.0), la confianza es siempre INSUFFICIENT. No debemos
        // confundir "muchas lecturas" con "el modelo ajustó bien".
        const confidence =
            fit
                ? this.determineConfidence(points.length, fit.residualError)
                : "INSUFFICIENT";

        let exponential = {

            asymptote: null,

            decayConstant: null,

            initialValueFit: null,

            eta: null,

            residualError: null,

            rmse: null,

            r2: null,

            reachable: null,

            confidence

        };

        if (fit) {

            const projection =
                this.exponentialProjection(fit, points, targetValue);

            exponential = {

                asymptote: fit.asymptote,

                // decayConstant/initialValueFit se exponen para que un
                // consumidor (ej. la gráfica de la Entrega 2.6.0.8) pueda
                // dibujar la curva ya ajustada por este módulo —
                // evaluando la misma fórmula con estos parámetros — sin
                // tener que reajustar el modelo de forma independiente.
                decayConstant: fit.decayConstant,

                initialValueFit: fit.initialValueFit,

                eta: projection ? projection.eta : null,

                // residualError se mantiene por compatibilidad con
                // 2.6.0.7-2.6.1.0; rmse es el mismo valor con el nombre
                // que usa la comparación de modelos de la Entrega 2.6.1.1.
                residualError: fit.residualError,

                rmse: fit.rmse,

                r2: fit.r2,

                reachable: projection ? projection.reachable : null,

                confidence

            };

        }

        // Entrega 2.6.1.1: comparación de modelos — nunca usando
        // únicamente el ETA de cada uno, siempre a partir del RMSE de
        // ambos sobre las mismas mediciones.
        const comparison =
            this.compareModels(

                linearRegression ? linearRegression.rmse : null,

                fit ? fit.rmse : null,

                confidence

            );

        const readiness =
            this.evaluateReadiness(rate, currentValue, targetValue, rateThreshold, targetTolerance);

        return {

            phase,

            metric,

            pointCount: points.length,

            currentValue,

            targetValue: targetValue ?? null,

            rate,

            rateThreshold: rateThreshold ?? null,

            targetTolerance: targetTolerance ?? null,

            linear,

            exponential,

            comparison,

            readyForF1Finish: readiness.readyForF1Finish,

            readinessStatus: readiness.status

        };

    }

}

module.exports =
    MaturationCalculator;
