/*
 * Entrega 2.8.0.2 -- módulo puro de validación de una tabla de conversión
 * del fabricante (secciones 7, 8, 9, 17). Nunca toca la base de datos ni
 * conoce `HydrometerConversionTable`/`HydrometerConversionTableRow` --
 * recibe filas ya leídas (de un import CSV o de un body JSON) y regresa
 * `{ valid, errors }` con mensajes ESPECÍFICOS por fila, tal como exige
 * el ejemplo de la sección 17:
 *
 *   No se puede activar la tabla.
 *   Errores encontrados:
 *   • SG 1.030 aparece dos veces.
 *   • Falta la fila SG 1.035.
 *   • Alcohol no es numérico en la fila 8.
 *
 * `HydrometerConversionTableService` es responsable de decidir QUÉ hacer
 * con el resultado (marcar VALIDATED o dejar en DRAFT, sección 12) --
 * este módulo solo determina SI la tabla es válida.
 */

const EPSILON = 1e-9;

const MIN_ROWS_FOR_INTERPOLATION = 2;

/*
 * Sección 7 -- "si la tabla requiere incrementos fijos (ej. cada 0.005 de
 * SG)". Este proyecto no recibe el incremento esperado como parámetro
 * externo -- se infiere de los propios datos (el delta más frecuente
 * entre filas consecutivas ordenadas por SG), igual que cualquier tabla
 * de hidrómetro real (Brewer's Elite usa 0.005 en todo su rango, ver
 * src/data/hydrometerConversion.json). Judgment call flagueado en el
 * resumen de la entrega.
 */
function toFiniteNumber(rawValue) {

    if (typeof rawValue === "number") {

        return Number.isFinite(rawValue) ? rawValue : null;

    }

    if (typeof rawValue === "string" && rawValue.trim() !== "") {

        const parsed = Number(rawValue.trim());

        return Number.isFinite(parsed) ? parsed : null;

    }

    return null;

}

function detectModalIncrement(sortedSgValues) {

    if (sortedSgValues.length < 2) {

        return null;

    }

    const deltaCounts = new Map();

    for (let i = 1; i < sortedSgValues.length; i++) {

        const delta = Math.round((sortedSgValues[i] - sortedSgValues[i - 1]) * 1e6) / 1e6;

        deltaCounts.set(delta, (deltaCounts.get(delta) || 0) + 1);

    }

    let modalDelta = null;

    let modalCount = 0;

    for (const [delta, count] of deltaCounts.entries()) {

        if (count > modalCount) {

            modalDelta = delta;

            modalCount = count;

        }

    }

    return modalDelta;

}

/*
 * Sección 7/17 -- valores numéricos. Recibe filas crudas (`rawValue`
 * puede venir como string desde un CSV) y separa las que sí son
 * numéricas ("filas válidas", usadas por las validaciones siguientes) de
 * los errores por fila/columna. `rowNumber` es 1-based sobre las filas
 * de DATOS (sin contar el encabezado), igual convención en todo el
 * módulo y en el parser de import (sección 16).
 */
function validateNumericFields(rows) {

    const errors = [];

    const numericRows = [];

    rows.forEach(row => {

        const sg = toFiniteNumber(row.sg);

        const brix = toFiniteNumber(row.brix);

        const alcohol = toFiniteNumber(row.alcohol);

        if (sg === null) {

            errors.push(`SG no es numérico en la fila ${row.rowNumber}.`);

        }

        if (brix === null) {

            errors.push(`Brix no es numérico en la fila ${row.rowNumber}.`);

        }

        if (alcohol === null) {

            errors.push(`Alcohol no es numérico en la fila ${row.rowNumber}.`);

        }

        if (sg !== null && brix !== null && alcohol !== null) {

            numericRows.push({ rowNumber: row.rowNumber, sg, brix, alcohol });

        }

    });

    return { errors, numericRows };

}

/*
 * Sección 7 -- "valores de SG correctamente ordenados (ascendente, sin
 * filas fuera de orden sin razón explícita)". Este proyecto no tiene
 * ningún mecanismo de "razón explícita" para una fila fuera de orden --
 * un archivo/tabla con SG fuera de orden siempre es un error (judgment
 * call flagueado en el resumen). "Sin razón explícita" se interpreta
 * como "esta tabla no ofrece manera de justificarlo, así que nunca se
 * permite".
 */
function validateAscendingOrder(numericRows) {

    const errors = [];

    for (let i = 1; i < numericRows.length; i++) {

        if (numericRows[i].sg < numericRows[i - 1].sg - EPSILON) {

            errors.push(

                `La fila ${numericRows[i].rowNumber} (SG ${numericRows[i].sg}) está fuera de orden -- debe ser mayor o igual a la fila anterior (SG ${numericRows[i - 1].sg}).`

            );

        }

    }

    return errors;

}

// Sección 7 -- "sin filas de SG duplicadas".
function validateNoDuplicateSg(numericRows) {

    const errors = [];

    const seen = new Map();

    numericRows.forEach(row => {

        const key = row.sg.toFixed(6);

        if (seen.has(key)) {

            errors.push(`SG ${row.sg} aparece dos veces.`);

        } else {

            seen.set(key, true);

        }

    });

    return errors;

}

/*
 * Sección 7 -- "sin huecos si la tabla requiere incrementos fijos". Se
 * calcula el incremento MÁS FRECUENTE entre filas consecutivas (ya
 * ordenadas y sin duplicados) y se reporta cualquier salto que sea un
 * múltiplo mayor a 1 de ese incremento -- ej. incremento modal 0.005 y
 * salto real 0.010 entre dos filas reporta la fila faltante intermedia.
 */
function validateNoGaps(numericRows) {

    const errors = [];

    if (numericRows.length < 3) {

        // No hay suficientes filas para inferir un incremento fijo con
        // confianza -- con 2 filas cualquier delta es "el" incremento,
        // no hay hueco que detectar.
        return errors;

    }

    const sortedSg = numericRows.map(r => r.sg).sort((a, b) => a - b);

    const modalDelta = detectModalIncrement(sortedSg);

    if (!modalDelta || modalDelta <= 0) {

        return errors;

    }

    for (let i = 1; i < sortedSg.length; i++) {

        const delta = Math.round((sortedSg[i] - sortedSg[i - 1]) * 1e6) / 1e6;

        const steps = Math.round(delta / modalDelta);

        const isExactMultiple = Math.abs(delta - steps * modalDelta) < 1e-6;

        if (isExactMultiple && steps > 1) {

            for (let s = 1; s < steps; s++) {

                const missingSg = Math.round((sortedSg[i - 1] + s * modalDelta) * 1e6) / 1e6;

                errors.push(`Falta la fila SG ${missingSg}.`);

            }

        }

    }

    return errors;

}

/*
 * Sección 8 -- "debe ser matemáticamente usable para interpolar en las 3
 * direcciones (SG→Brix+Alcohol, Brix→SG+Alcohol, Alcohol→SG+Brix)".
 * Además de SG (ya validado arriba), Brix y Alcohol también deben ser
 * estrictamente monótonos en el mismo orden que SG -- si no lo son,
 * `HydrometerConversionService.interpolateByKey()` (2.8.0.1, ordena por
 * la clave pedida) no puede ubicar de forma inequívoca "los dos puntos
 * vecinos" al convertir DESDE Brix o DESDE Alcohol.
 */
function validateInterpolationConsistency(numericRows) {

    const errors = [];

    if (numericRows.length < MIN_ROWS_FOR_INTERPOLATION) {

        errors.push(

            `La tabla debe tener al menos ${MIN_ROWS_FOR_INTERPOLATION} filas para poder interpolar (tiene ${numericRows.length}).`

        );

        return errors;

    }

    const checkMonotonic = (key, label) => {

        for (let i = 1; i < numericRows.length; i++) {

            if (numericRows[i][key] <= numericRows[i - 1][key] + EPSILON) {

                errors.push(

                    `La tabla no es válida para interpolar por ${label}: los valores de ${label} no aumentan de forma consistente con el orden de SG (fila ${numericRows[i].rowNumber}).`

                );

                return;

            }

        }

    };

    checkMonotonic("brix", "Brix");

    checkMonotonic("alcohol", "Alcohol");

    return errors;

}

/*
 * Punto de entrada único del módulo (sección 7/8/9/17). `rows` es un
 * arreglo de `{ rowNumber, sg, brix, alcohol }` con valores crudos (el
 * parser de CSV, sección 16, o el body JSON de creación manual, sección
 * 15, son responsables de armar `rowNumber` 1-based sobre filas de
 * datos). Nunca lanza -- siempre regresa `{ valid, errors }`, para que
 * el llamador decida qué hacer (persistir VALIDATED, o dejar DRAFT con
 * los errores visibles, sección 12).
 */
function validateTable(rows) {

    if (!Array.isArray(rows) || rows.length === 0) {

        return {

            valid: false,

            errors: ["La tabla no tiene ninguna fila."]

        };

    }

    const { errors: numericErrors, numericRows } = validateNumericFields(rows);

    // Las validaciones estructurales (orden/duplicados/huecos/
    // consistencia) solo tienen sentido sobre filas ya numéricas --
    // una fila con un valor no numérico ya está reportada arriba y se
    // excluye del resto de los chequeos para no generar ruido derivado
    // (ej. no reportar "fuera de orden" solo porque una fila vecina
    // tenía texto en vez de número).
    const structuralErrors = [

        ...validateAscendingOrder(numericRows),

        ...validateNoDuplicateSg(numericRows),

        ...validateNoGaps(numericRows),

        ...validateInterpolationConsistency(numericRows)

    ];

    const errors = [...numericErrors, ...structuralErrors];

    return {

        valid: errors.length === 0,

        errors

    };

}

module.exports = {

    MIN_ROWS_FOR_INTERPOLATION,

    toFiniteNumber,

    validateTable

};
