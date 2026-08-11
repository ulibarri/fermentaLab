/*
 * Análisis de factores de fermentación — temperatura (Entrega 2.6.1.4).
 *
 * Módulo puro (sin Sequelize/Express) que relaciona las temperaturas
 * registradas durante F1 con la velocidad de maduración y el error de
 * predicción. Es deliberadamente descriptivo: calcula promedios,
 * mínimos/máximos y correlaciones de Pearson, y agrupa por rangos de
 * temperatura — NO ajusta ninguna ecuación temperatura → velocidad ni
 * hace machine learning (fuera de alcance de esta entrega).
 *
 * Importante: una correlación no implica causalidad. Todas las funciones
 * que producen texto interpretativo aquí usan deliberadamente el
 * lenguaje "se observa una correlación..." y nunca "la temperatura
 * provoca/causa...". Quien consuma este módulo (servicio/API/interfaz)
 * debe mantener ese mismo cuidado si agrega texto propio.
 *
 * Reutiliza MaturationCalculator.extractPoints()/fitLinearRegression()
 * para la velocidad de fermentación — no se reimplementa el ajuste
 * lineal aquí.
 */

const MaturationCalculator =
    require("./MaturationCalculator");

// pearsonCorrelation/correlateWithLabel/MIN_CORRELATION_SAMPLE_SIZE se
// movieron a Correlation.js en la Entrega 2.6.1.5 para poder reutilizarlos
// también en el análisis de volumen. Se re-exportan aquí con los mismos
// nombres por compatibilidad — este módulo y sus pruebas no cambian de
// comportamiento.
const {
    MIN_CORRELATION_SAMPLE_SIZE,
    pearsonCorrelation,
    correlateWithLabel
} = require("./Correlation");

// Rangos de temperatura por defecto de la Entrega 2.6.1.4. Deliberadamente
// parametrizables — no son una regla rígida del sistema, son el punto de
// partida sugerido por la especificación.
const DEFAULT_TEMPERATURE_RANGES = [

    { label: "< 25 °C", min: -Infinity, max: 25 },

    { label: "25–27 °C", min: 25, max: 27 },

    { label: "27–29 °C", min: 27, max: 29 },

    { label: "> 29 °C", min: 29, max: Infinity }

];

function round(value, decimals = 2) {

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

    const num =
        Number(value);

    return Number.isFinite(num) ? num : null;

}

/*
 * Reduce un arreglo de números a {average, min, max, count}. Con 0
 * valores válidos regresa todo en null salvo count=0 — nunca inventa un
 * promedio de una lista vacía (mismo criterio que MaturationStatistics).
 */
function aggregateReadings(values, decimals = 2) {

    const clean =
        (values || []).filter(
            v => typeof v === "number" && Number.isFinite(v)
        );

    const count =
        clean.length;

    if (count === 0) {

        return { average: null, min: null, max: null, count: 0 };

    }

    const sum =
        clean.reduce((acc, v) => acc + v, 0);

    return {

        average: round(sum / count, decimals),

        min: round(Math.min(...clean), decimals),

        max: round(Math.max(...clean), decimals),

        count

    };

}

/*
 * Temperatura de producto (liquidTemperature) y de ambiente
 * (ambientTemperature) de una fase, mantenidas SIEMPRE por separado
 * (Entrega 2.6.1.4, sección 7: no confundir producto con ambiente).
 * Filtra primero por fase y luego descarta lecturas sin ese campo — los
 * datos faltantes simplemente no entran al promedio, nunca se sustituyen
 * por 0 ni por ningún otro valor artificial.
 */
function computeTemperatureStats(measurements, phase = "F1") {

    const phaseMeasurements =
        (measurements || []).filter(m => m.phase === phase);

    const productValues =
        phaseMeasurements
            .map(m => toNumberOrNull(m.liquidTemperature))
            .filter(v => v !== null);

    const ambientValues =
        phaseMeasurements
            .map(m => toNumberOrNull(m.ambientTemperature))
            .filter(v => v !== null);

    return {

        product: aggregateReadings(productValues),

        ambient: aggregateReadings(ambientValues)

    };

}

/*
 * Velocidad de cambio de la variable de maduración configurada durante
 * una fase (ΔpH/h, ΔSG/h, etc. — la métrica la decide el llamador, no se
 * asume aquí). Usa la pendiente de la regresión lineal completa
 * (fitLinearRegression, ya usada en 2.6.1.1) en vez de solo el último
 * intervalo (calculateRate), porque aquí queremos una velocidad
 * representativa de TODA la fase F1 para poder compararla con la
 * temperatura promedio de esa misma fase — no la tasa más reciente.
 *
 * Regresa null si no hay al menos 2 lecturas de esa métrica en la fase.
 */
function computeFermentationRate(measurements, metric, phase = "F1") {

    const phaseMeasurements =
        (measurements || []).filter(m => m.phase === phase);

    const points =
        MaturationCalculator.extractPoints(phaseMeasurements, metric);

    if (points.length < 2) {

        return null;

    }

    const regression =
        MaturationCalculator.fitLinearRegression(points);

    if (!regression) {

        return null;

    }

    const durationHours =
        round(points[points.length - 1].hours - points[0].hours, 2);

    return {

        // Magnitud de la velocidad (no dirección) — "qué tan rápido
        // cambia", independientemente de si la métrica sube o baja.
        rateAbsolutePerHour: round(Math.abs(regression.slope), 6),

        durationHours,

        pointCount: points.length

    };

}

/*
 * Agrupa filas por lote {productTemperature, fermentationRate,
 * linearErrorHours, exponentialErrorHours} en los rangos de temperatura
 * dados (por defecto, los 4 rangos de la sección 6 de la especificación).
 * Un lote sin productTemperature no puede clasificarse y se omite de la
 * tabla (no se le asigna un rango arbitrario). Los rangos siempre
 * aparecen en el resultado, aunque queden con 0 lotes, para que la
 * tabla sea comparable.
 */
function groupByTemperatureRange(rows, ranges = DEFAULT_TEMPERATURE_RANGES) {

    return ranges.map(range => {

        const matching =
            (rows || []).filter(row =>

                typeof row.productTemperature === "number" &&
                Number.isFinite(row.productTemperature) &&
                row.productTemperature >= range.min &&
                row.productTemperature < range.max

            );

        const rates =
            matching
                .map(r => r.fermentationRate)
                .filter(v => typeof v === "number" && Number.isFinite(v));

        const linearErrors =
            matching
                .map(r => r.linearErrorHours)
                .filter(v => typeof v === "number" && Number.isFinite(v));

        const exponentialErrors =
            matching
                .map(r => r.exponentialErrorHours)
                .filter(v => typeof v === "number" && Number.isFinite(v));

        return {

            label: range.label,

            min: Number.isFinite(range.min) ? range.min : null,

            max: Number.isFinite(range.max) ? range.max : null,

            batchCount: matching.length,

            averageFermentationRate:
                rates.length > 0
                    ? round(rates.reduce((a, b) => a + b, 0) / rates.length, 6)
                    : null,

            averageLinearErrorHours:
                linearErrors.length > 0
                    ? round(linearErrors.reduce((a, b) => a + b, 0) / linearErrors.length, 2)
                    : null,

            averageExponentialErrorHours:
                exponentialErrors.length > 0
                    ? round(exponentialErrors.reduce((a, b) => a + b, 0) / exponentialErrors.length, 2)
                    : null

        };

    });

}

module.exports = {

    MIN_CORRELATION_SAMPLE_SIZE,

    DEFAULT_TEMPERATURE_RANGES,

    aggregateReadings,

    computeTemperatureStats,

    computeFermentationRate,

    pearsonCorrelation,

    correlateWithLabel,

    groupByTemperatureRange

};
