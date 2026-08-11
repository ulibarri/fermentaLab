/*
 * Análisis de volumen y escala de producción (Entrega 2.6.1.5).
 *
 * Módulo puro (sin Sequelize/Express) que agrupa el comportamiento de
 * maduración por volumen PLANEADO del lote (plannedVolume — la
 * referencia principal según la especificación) y correlaciona ese
 * volumen con la velocidad de fermentación y el error de predicción de
 * cada modelo. producedVolume se conserva como dato independiente
 * (promedio informativo por grupo), nunca como criterio de agrupación.
 *
 * No crea categorías rígidas (PEQUEÑO/MEDIANO/GRANDE): trabaja con el
 * volumen numérico tal cual, y dos lotes del mismo plannedVolume caen en
 * el mismo grupo. Es deliberadamente descriptivo — no ajusta ninguna
 * ecuación volumen → velocidad ni corrige ETA por volumen (fuera de
 * alcance de esta entrega).
 *
 * Reutiliza aggregateErrors() de MaturationStatistics.js (2.6.1.3) para
 * el error por modelo dentro de cada grupo de volumen, y
 * correlateWithLabel()/pearsonCorrelation() de Correlation.js (2.6.1.5)
 * para las correlaciones — no se reimplementa ninguno de los dos.
 */

const { aggregateErrors } =
    require("./MaturationStatistics");

const { correlateWithLabel } =
    require("./Correlation");

// Con menos lotes que esto en un grupo de volumen, el promedio de ese
// grupo se muestra igual (la tabla debe ser completa) pero se marca con
// una advertencia explícita — mismo espíritu que el resto del proyecto:
// preferimos avisar que la muestra es chica antes que dejar que un
// número aislado parezca una conclusión.
const SMALL_SAMPLE_THRESHOLD = 5;

function round(value, decimals = 2) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

function average(values, decimals = 2) {

    const clean =
        (values || []).filter(
            v => typeof v === "number" && Number.isFinite(v)
        );

    if (clean.length === 0) {

        return null;

    }

    const sum =
        clean.reduce((acc, v) => acc + v, 0);

    return round(sum / clean.length, decimals);

}

/*
 * Agrupa filas por lote {plannedVolume, producedVolume, fermentationRate,
 * linearErrorHours, exponentialErrorHours, averageProductTemperature,
 * averageAmbientTemperature} por su plannedVolume exacto. Un lote sin
 * plannedVolume no puede agruparse — el llamador debe filtrarlo antes
 * (no se le asigna un volumen arbitrario aquí).
 *
 * Los grupos se regresan ordenados ascendentemente por volumen, cada uno
 * con su propio conteo de lotes y una bandera smallSample cuando ese
 * conteo cae por debajo de SMALL_SAMPLE_THRESHOLD.
 */
function groupByVolume(rows, smallSampleThreshold = SMALL_SAMPLE_THRESHOLD) {

    const groups =
        new Map();

    for (const row of (rows || [])) {

        if (typeof row.plannedVolume !== "number" || !Number.isFinite(row.plannedVolume)) {

            continue;

        }

        const key =
            round(row.plannedVolume, 2);

        if (!groups.has(key)) {

            groups.set(key, []);

        }

        groups.get(key).push(row);

    }

    const volumes =
        Array.from(groups.entries()).map(([volume, groupRows]) => {

            const rates =
                groupRows
                    .map(r => r.fermentationRate)
                    .filter(v => typeof v === "number" && Number.isFinite(v));

            const linearErrors =
                groupRows
                    .map(r => r.linearErrorHours)
                    .filter(v => typeof v === "number" && Number.isFinite(v));

            const exponentialErrors =
                groupRows
                    .map(r => r.exponentialErrorHours)
                    .filter(v => typeof v === "number" && Number.isFinite(v));

            const productTemps =
                groupRows
                    .map(r => r.averageProductTemperature)
                    .filter(v => typeof v === "number" && Number.isFinite(v));

            const ambientTemps =
                groupRows
                    .map(r => r.averageAmbientTemperature)
                    .filter(v => typeof v === "number" && Number.isFinite(v));

            const producedVolumes =
                groupRows
                    .map(r => r.producedVolume)
                    .filter(v => typeof v === "number" && Number.isFinite(v));

            const sampleSize =
                groupRows.length;

            return {

                volume,

                sampleSize,

                averageFermentationRate: average(rates, 6),

                linear: aggregateErrors(linearErrors),

                exponential: aggregateErrors(exponentialErrors),

                averageProductTemperature: average(productTemps, 2),

                averageAmbientTemperature: average(ambientTemps, 2),

                averageProducedVolume: average(producedVolumes, 2),

                smallSample: sampleSize < smallSampleThreshold,

                warning:
                    sampleSize < smallSampleThreshold
                        ? `Tamaño de muestra pequeño (${sampleSize} lote${sampleSize === 1 ? "" : "s"}): interpretar con cautela.`
                        : null

            };

        });

    volumes.sort((a, b) => a.volume - b.volume);

    return volumes;

}

/*
 * Correlaciona el volumen planeado (por lote) con la velocidad de
 * fermentación y el error de predicción de cada modelo — a nivel de
 * lote individual, no de grupo, para conservar toda la variación
 * disponible. Reutiliza correlateWithLabel(), que ya aplica el mínimo de
 * muestra y el lenguaje de correlación (no causalidad).
 */
function computeVolumeCorrelations(rows) {

    const volumeVsRatePairs =
        (rows || []).map(r => ({ x: r.plannedVolume, y: r.fermentationRate }));

    const volumeVsLinearErrorPairs =
        (rows || []).map(r => ({ x: r.plannedVolume, y: r.linearErrorHours }));

    const volumeVsExponentialErrorPairs =
        (rows || []).map(r => ({ x: r.plannedVolume, y: r.exponentialErrorHours }));

    return {

        volumeVsFermentationRate:
            correlateWithLabel(volumeVsRatePairs, "el volumen planeado", "la velocidad de fermentación"),

        volumeVsLinearError:
            correlateWithLabel(volumeVsLinearErrorPairs, "el volumen planeado", "el error de predicción del modelo lineal"),

        volumeVsExponentialError:
            correlateWithLabel(volumeVsExponentialErrorPairs, "el volumen planeado", "el error de predicción del modelo exponencial")

    };

}

module.exports = {

    SMALL_SAMPLE_THRESHOLD,

    groupByVolume,

    computeVolumeCorrelations

};
