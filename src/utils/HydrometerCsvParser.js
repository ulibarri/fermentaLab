/*
 * Entrega 2.8.0.2, sección 16 -- "cargable mediante un archivo
 * estructurado (CSV: SG,Brix,Alcohol encabezado + filas)". Módulo puro
 * y deliberadamente separado de `HydrometerTableValidation.js`: este
 * módulo solo entiende el FORMATO del archivo (encabezado correcto,
 * número de columnas por fila) -- nunca decide si los VALORES son
 * válidos para interpolar (orden, duplicados, huecos, consistencia),
 * eso es responsabilidad exclusiva de `HydrometerTableValidation
 * .validateTable()` (secciones 7-9), que se ejecuta sobre el resultado
 * de este parser. Flujo completo (sección 16): IMPORTAR (este módulo)
 * -> VALIDAR (HydrometerTableValidation) -> REVISAR -> ACTIVAR.
 */

const EXPECTED_HEADER = ["sg", "brix", "alcohol"];

function parseHydrometerCsv(csvText) {

    if (typeof csvText !== "string" || csvText.trim() === "") {

        return { rows: [], errors: ["El archivo CSV está vacío."] };

    }

    // Acepta tanto saltos de línea Unix como Windows; ignora líneas
    // completamente vacías (ej. una línea en blanco al final del
    // archivo).
    const lines =
        csvText

            .split(/\r\n|\r|\n/)

            .map(line => line.trim())

            .filter(line => line.length > 0);

    if (lines.length === 0) {

        return { rows: [], errors: ["El archivo CSV está vacío."] };

    }

    const header =
        lines[0].split(",").map(cell => cell.trim().toLowerCase());

    const headerMatches =
        header.length === EXPECTED_HEADER.length &&
        EXPECTED_HEADER.every((expected, i) => header[i] === expected);

    if (!headerMatches) {

        return {

            rows: [],

            errors: [`El encabezado debe ser exactamente "SG,Brix,Alcohol" (recibido: "${lines[0]}").`]

        };

    }

    const dataLines =
        lines.slice(1);

    if (dataLines.length === 0) {

        return { rows: [], errors: ["El archivo CSV no tiene filas de datos, solo el encabezado."] };

    }

    const rows = [];

    const errors = [];

    dataLines.forEach((line, index) => {

        const rowNumber = index + 1;

        const cells = line.split(",").map(cell => cell.trim());

        if (cells.length !== EXPECTED_HEADER.length) {

            errors.push(`La fila ${rowNumber} no tiene 3 columnas (SG,Brix,Alcohol): "${line}".`);

            return;

        }

        rows.push({

            rowNumber,

            sg: cells[0],

            brix: cells[1],

            alcohol: cells[2]

        });

    });

    return { rows, errors };

}

module.exports = {

    EXPECTED_HEADER,

    parseHydrometerCsv

};
