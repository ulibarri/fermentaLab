const fs =
    require("fs");

const path =
    require("path");

const DATA_PATH =
    path.join(

        __dirname,

        "../data/hydrometerConversion.json"

    );

const catalog =
    JSON.parse(

        fs.readFileSync(DATA_PATH, "utf8")

    );

// Entrega 2.8.0.2, sección 18 -- desde esta entrega, la tabla embebida
// en `hydrometerConversion.json` YA NO es la fuente de verdad usada por
// las conversiones de producción (eso pasa a ser la fila ACTIVE de
// `HydrometerConversionTable` en base de datos, ver
// `HydrometerConversionService`/`HydrometerConversionTableService`).
// Se conserva SOLO como: (a) el catálogo semilla que el seeder de esta
// entrega usa para crear la primera versión ACTIVE en base de datos, y
// (b) el fixture de las pruebas unitarias pre-existentes de este módulo
// (2.6.1.x/2.8.0.1) sobre los métodos "legado" de abajo
// (`fromSG`/`fromBrix`/`fromAlcohol`/`convert()`), que ningún endpoint
// ni servicio de producción vuelve a llamar después de esta entrega.
const LEGACY_POINTS =
    catalog.points

        .map(p => ({

            sg: p.sg,

            brix: p.brix,

            alcohol: p.abv

        }))

        .sort((a, b) => a.sg - b.sg);

const EPSILON = 1e-9;

// Entrega 2.8.0.1, sección 14 -- valores posibles de `method` en el
// resultado de una conversión: coincide exactamente con una fila de la
// tabla (`TABLE_EXACT`, sección 3) o requirió interpolación lineal entre
// dos filas adyacentes (`INTERPOLATED`, secciones 4/5). `MANUAL` (el
// tercer valor de `hydrometerConversionMethod`, sección 10) nunca lo
// produce este módulo -- corresponde a cuando el operador captura las
// tres lecturas directamente, sin pasar por esta conversión en absoluto.
const CONVERSION_METHODS = {

    TABLE_EXACT: "TABLE_EXACT",

    INTERPOLATED: "INTERPOLATED"

};

// Entrega 2.8.0.1, sección 6 -- las tres escalas de entrada soportadas
// por `convert()`. Mismos nombres que usa `interpolateByKey()`
// internamente (sg/brix/alcohol) pero en mayúsculas, para que coincidan
// con el vocabulario del spec (sección 2: "Lectura tomada en: SG / Brix
// / % Alcohol") y con `hydrometerInputScale` (sección 10).
const SCALE_KEY_BY_NAME = {

    SG: "sg",

    BRIX: "brix",

    ALCOHOL: "alcohol"

};

function round(value, decimals) {

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

// Entrega 2.8.0.1, sección 7 -- "manejar internamente la precisión
// necesaria para la interpolación, pero mostrar" SG a 3 decimales y
// Brix/Alcohol a 1 decimal.
function buildResult(point, method) {

    return {

        sg: round(point.sg, 3),

        brix: round(point.brix, 1),

        alcohol: round(point.alcohol, 1),

        method

    };

}

/*
 * Entrega 2.8.0.2, sección 6 -- núcleo de interpolación, ahora
 * PARAMETRIZADO sobre `points` en vez de cerrar sobre una tabla fija
 * embebida en el módulo. Es el ÚNICO lugar de todo el proyecto donde
 * vive la lógica de interpolación/rechazo de extrapolación -- tanto la
 * conversión real (`HydrometerConversionService`, con los puntos de la
 * tabla ACTIVE en base de datos) como la simulación de una tabla
 * todavía no activa (`HydrometerConversionTableService.simulate()`,
 * sección 13) pasan por esta misma función, nunca la reimplementan.
 */
function interpolateByKey(points, key, value) {

    if (!Array.isArray(points) || points.length < 2) {

        throw new Error(

            "La tabla de conversión no tiene suficientes filas para interpolar (se requieren al menos 2)."

        );

    }

    if (typeof value !== "number" || Number.isNaN(value)) {

        throw new Error(
            `El valor debe ser un número (recibido: ${value}).`
        );

    }

    const sorted =
        [...points].sort((a, b) => a[key] - b[key]);

    const min = sorted[0][key];

    const max = sorted[sorted.length - 1][key];

    if (value < min - EPSILON || value > max + EPSILON) {

        throw new Error(

            `El valor ${value} está fuera del rango disponible para este instrumento (${min} a ${max}). No es posible extrapolar.`

        );

    }

    for (const point of sorted) {

        if (Math.abs(point[key] - value) <= EPSILON) {

            return buildResult(point, CONVERSION_METHODS.TABLE_EXACT);

        }

    }

    for (let i = 0; i < sorted.length - 1; i++) {

        const a = sorted[i];

        const b = sorted[i + 1];

        if (value > a[key] && value < b[key]) {

            const t =
                (value - a[key]) / (b[key] - a[key]);

            return buildResult({

                sg: a.sg + t * (b.sg - a.sg),

                brix: a.brix + t * (b.brix - a.brix),

                alcohol: a.alcohol + t * (b.alcohol - a.alcohol)

            }, CONVERSION_METHODS.INTERPOLATED);

        }

    }

    throw new Error(

        `No fue posible interpolar el valor ${value}.`

    );

}

/*
 * Entrega 2.8.0.2 -- punto de entrada puro y genérico: recibe `points`
 * (las filas de CUALQUIER tabla, típicamente la ACTIVE de base de
 * datos, o una tabla todavía en DRAFT/VALIDATED para `simulate()`) y
 * despacha por escala, igual que el `convert()` legado de 2.8.0.1 pero
 * sin depender de la tabla embebida en código (sección 6: "separar
 * tabla y algoritmo").
 */
function convertUsingPoints({ points, scale, value } = {}) {

    const normalizedScale =
        typeof scale === "string" ? scale.trim().toUpperCase() : scale;

    const key =
        SCALE_KEY_BY_NAME[normalizedScale];

    if (!key) {

        throw new Error(

            `scale debe ser una de: ${Object.keys(SCALE_KEY_BY_NAME).join(", ")} (recibido: ${scale}).`

        );

    }

    return interpolateByKey(

        points,

        key,

        typeof value === "string" ? Number(value) : value

    );

}

class HydrometerConverter {

    // --- Métodos legado (2.6.1.x/2.8.0.1) -- operan sobre la tabla
    // embebida en código, ver el comentario de LEGACY_POINTS arriba.

    static fromSG(sg) {

        return interpolateByKey(LEGACY_POINTS, "sg", sg);

    }

    static fromBrix(brix) {

        return interpolateByKey(LEGACY_POINTS, "brix", brix);

    }

    static fromAlcohol(alcohol) {

        return interpolateByKey(LEGACY_POINTS, "alcohol", alcohol);

    }

    static convert({ scale, value } = {}) {

        return convertUsingPoints({ points: LEGACY_POINTS, scale, value });

    }

}

HydrometerConverter.CONVERSION_METHODS =
    CONVERSION_METHODS;

HydrometerConverter.VALID_SCALES =
    Object.keys(SCALE_KEY_BY_NAME);

HydrometerConverter.LEGACY_POINTS =
    LEGACY_POINTS;

HydrometerConverter.convertUsingPoints =
    convertUsingPoints;

module.exports =
    HydrometerConverter;
