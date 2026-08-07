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

const POINTS =
    catalog.points

        .map(p => ({

            sg: p.sg,

            brix: p.brix,

            alcohol: p.abv

        }))

        .sort((a, b) => a.sg - b.sg);

const EPSILON = 1e-9;

function round(value, decimals) {

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

function buildResult(point) {

    return {

        sg: round(point.sg, 3),

        brix: round(point.brix, 1),

        alcohol: round(point.alcohol, 1)

    };

}

function interpolateByKey(key, value) {

    if (typeof value !== "number" || Number.isNaN(value)) {

        throw new Error(
            `El valor debe ser un número (recibido: ${value}).`
        );

    }

    const sorted =
        [...POINTS].sort((a, b) => a[key] - b[key]);

    const min = sorted[0][key];

    const max = sorted[sorted.length - 1][key];

    if (value < min - EPSILON || value > max + EPSILON) {

        throw new Error(

            `El valor ${value} está fuera del rango disponible en la tabla del fabricante (${min} a ${max}). No es posible extrapolar.`

        );

    }

    for (const point of sorted) {

        if (Math.abs(point[key] - value) <= EPSILON) {

            return buildResult(point);

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

            });

        }

    }

    throw new Error(

        `No fue posible interpolar el valor ${value}.`

    );

}

class HydrometerConverter {

    static fromSG(sg) {

        return interpolateByKey("sg", sg);

    }

    static fromBrix(brix) {

        return interpolateByKey("brix", brix);

    }

    static fromAlcohol(alcohol) {

        return interpolateByKey("alcohol", alcohol);

    }

}

module.exports =
    HydrometerConverter;
