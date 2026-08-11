/*
 * Utilidades genéricas de correlación (extraídas de TemperatureAnalysis.js
 * en la Entrega 2.6.1.5 para poder reutilizarlas también en el análisis
 * de volumen, sin duplicar la lógica — refactor puro, sin cambio de
 * comportamiento respecto a como funcionaban dentro de TemperatureAnalysis.js
 * en la 2.6.1.4).
 *
 * Módulo puro (sin Sequelize/Express), deliberadamente agnóstico de qué
 * variables se están correlacionando — temperatura, volumen, o cualquier
 * otra que se agregue después. Mantiene el mismo cuidado de lenguaje:
 * "se observa una correlación...", nunca "causa/provoca...".
 */

// Con menos muestras que esto, un coeficiente de correlación es
// prácticamente un artefacto geométrico (con 2 puntos siempre da ±1) y
// no una señal real. Mismo espíritu que MIN_EXPONENTIAL_FIT_POINTS (2.6.1.0)
// y el mínimo de 5 lotes para recomendar un modelo (2.6.1.3): preferimos
// decir "datos insuficientes" antes que mostrar un número engañoso.
const MIN_CORRELATION_SAMPLE_SIZE = 4;

function round(value, decimals = 2) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

/*
 * Coeficiente de correlación de Pearson sobre pares {x, y} YA filtrados
 * (ambos valores no nulos) por el llamador. Regresa null si no hay
 * suficientes pares o si alguna de las dos variables no tiene varianza
 * (todos los valores iguales) — en ese caso el coeficiente no está
 * definido, y null es más honesto que un 0 o un error.
 */
function pearsonCorrelation(pairs) {

    const clean =
        (pairs || []).filter(

            p =>
                typeof p.x === "number" && Number.isFinite(p.x) &&
                typeof p.y === "number" && Number.isFinite(p.y)

        );

    if (clean.length < 2) {

        return null;

    }

    const n =
        clean.length;

    const meanX =
        clean.reduce((acc, p) => acc + p.x, 0) / n;

    const meanY =
        clean.reduce((acc, p) => acc + p.y, 0) / n;

    let numerator = 0;

    let sumSqX = 0;

    let sumSqY = 0;

    for (const p of clean) {

        const dx = p.x - meanX;

        const dy = p.y - meanY;

        numerator += dx * dy;

        sumSqX += dx * dx;

        sumSqY += dy * dy;

    }

    if (sumSqX === 0 || sumSqY === 0) {

        return null;

    }

    const r =
        numerator / Math.sqrt(sumSqX * sumSqY);

    return round(r, 2);

}

/*
 * Clasifica la intensidad de |r| en bandas descriptivas. Puramente
 * textual — no cambia ningún cálculo, solo ayuda a presentar el número.
 */
function correlationStrengthLabel(r) {

    const abs =
        Math.abs(r);

    if (abs < 0.1) return "muy débil o inexistente";

    if (abs < 0.3) return "débil";

    if (abs < 0.5) return "moderada";

    if (abs < 0.7) return "moderada a fuerte";

    if (abs < 0.9) return "fuerte";

    return "muy fuerte";

}

/*
 * Calcula la correlación entre dos variables (a partir de pares ya
 * emparejados) y produce, en el mismo paso, una descripción en lenguaje
 * de correlación — nunca de causalidad. Con menos de minSampleSize pares
 * válidos, no se reporta ningún coeficiente numérico.
 */
function correlateWithLabel(pairs, labelA, labelB, minSampleSize = MIN_CORRELATION_SAMPLE_SIZE) {

    const validPairs =
        (pairs || []).filter(

            p =>
                typeof p.x === "number" && Number.isFinite(p.x) &&
                typeof p.y === "number" && Number.isFinite(p.y)

        );

    const sampleSize =
        validPairs.length;

    if (sampleSize < minSampleSize) {

        return {

            value: null,

            sampleSize,

            label: `Datos insuficientes para calcular una correlación confiable entre ${labelA} y ${labelB} (se necesitan al menos ${minSampleSize} lotes con ambos datos).`

        };

    }

    const r =
        pearsonCorrelation(validPairs);

    if (r === null) {

        return {

            value: null,

            sampleSize,

            label: `No fue posible calcular una correlación entre ${labelA} y ${labelB} (sin variación suficiente en los datos).`

        };

    }

    const abs =
        Math.abs(r);

    if (abs < 0.1) {

        return {

            value: r,

            sampleSize,

            label: `No se observa una correlación clara entre ${labelA} y ${labelB} con los datos disponibles.`

        };

    }

    const sign =
        r > 0 ? "positiva" : "negativa";

    const strength =
        correlationStrengthLabel(r);

    return {

        value: r,

        sampleSize,

        label: `Se observa una correlación ${sign} ${strength} entre ${labelA} y ${labelB}.`

    };

}

module.exports = {

    MIN_CORRELATION_SAMPLE_SIZE,

    pearsonCorrelation,

    correlateWithLabel

};
