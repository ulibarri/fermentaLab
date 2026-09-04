/*
 * Entrega 2.8.0.4 -- "Auditoría y comparación: mediciones
 * instrumentales vs. valores derivados".
 *
 * Módulo puro (sin dependencias de Sequelize/Express, sin acceso a
 * base de datos) que calcula la comparación entre:
 *   - el Brix DERIVADO por la conversión del hidrómetro (tabla del
 *     fabricante, secciones 2.8.0.1/2.8.0.2/2.8.0.3), y
 *   - el Brix REAL medido directamente por el Brixómetro
 *     (BrixMate/LAFmate, campo `brixLafmate`).
 *
 * Sección 3/14 del spec: "Nunca debemos reemplazar 7.00 por 7.20 ni
 * viceversa" -- este módulo SOLO lee y compara, nunca escribe ni
 * recalcula ninguno de los dos valores originales.
 */

// Sección 9 -- "Los límites deberán ser configurables, no valores
// rígidos incrustados en el frontend." Todavía no existe un mecanismo
// de configuración en base de datos/UI para reglas de negocio en este
// proyecto (ver `HydrometerAuditService` -- el mismo criterio ya
// usado por `DegradationDetection.DEFAULT_DEGRADATION_THRESHOLD_PERCENTAGE`),
// así que por ahora viven aquí como constantes de backend,
// explícitamente documentadas como PARÁMETROS TEMPORALES (spec,
// sección 9: "pueden definirse inicialmente como constantes de
// backend, dejando claramente documentado que son parámetros
// temporales"). Elegidas para que el propio ejemplo del spec (sección
// 10: ΔBrix +0.15 -> 🟢, +0.20 -> 🟡, +0.05 -> 🟢) sea reproducible
// exactamente.
const DEFAULT_ACCEPTABLE_ABSOLUTE_ERROR = 0.15;
const DEFAULT_WARNING_ABSOLUTE_ERROR = 0.30;

const NOT_COMPARABLE_REASONS = {

    NO_DERIVED_BRIX: "NO_DERIVED_BRIX",

    NO_BRIX_MATE: "NO_BRIX_MATE",

    INCOMPATIBLE_PHASE: "INCOMPATIBLE_PHASE"

};

// Sección 2 ("No incluye... Cambios en F2") / sección 12 ("la
// medición pertenece a una fase incompatible") -- F2 nunca ofrece el
// panel de hidrómetro (2.8.0.3, sección 1), así que nunca puede tener
// un Brix "derivado" legítimo; se excluye explícitamente en vez de
// dejar que simplemente falle el chequeo de NO_DERIVED_BRIX, para que
// quede una razón más específica y auditable.
const COMPARABLE_PHASES = [

    "F1",

    "FINAL"

];

const STATUS = {

    OK: "OK",

    WARNING: "WARNING",

    HIGH: "HIGH"

};

function isFiniteNumber(value) {

    if (value === null || value === undefined || value === "") {

        return false;

    }

    return Number.isFinite(Number(value));

}

/*
 * Sección 3/6/11 -- un Brix "DERIVADO" es específicamente el que
 * salió de la tabla del fabricante vía conversión
 * (hydrometerConversionMethod INTERPOLATED/TABLE_EXACT), nunca un
 * valor de hidrómetro tecleado a mano (MANUAL). Un valor manual no
 * tiene tabla/versión que trazabilizar (sección 11 exige "tabla,
 * versión, método"), y comparar un valor manual contra BrixMate no
 * respondería la pregunta que esta entrega busca responder: "¿qué tan
 * bien reproduce la TABLA el valor real?"
 */
function hasDerivedBrix(measurement) {

    const method =
        measurement.hydrometerConversionMethod;

    const wasDerivedFromTable =
        method === "INTERPOLATED" || method === "TABLE_EXACT";

    return wasDerivedFromTable && isFiniteNumber(measurement.brix);

}

function hasBrixMate(measurement) {

    // Sección 13, caso especial -- BrixMate = 0 SÍ es un valor válido
    // y comparable (solo se omite el error relativo, no la
    // comparación completa). `isFiniteNumber` acepta 0.
    return isFiniteNumber(measurement.brixLafmate);

}

/*
 * Sección 12 -- decide si una medición puede compararse, y si no, por
 * qué. "No debe interpretarse como error del hidrómetro."
 */
function evaluateComparability(measurement) {

    if (!COMPARABLE_PHASES.includes(measurement.phase)) {

        return {

            comparable: false,

            reason: NOT_COMPARABLE_REASONS.INCOMPATIBLE_PHASE

        };

    }

    if (!hasDerivedBrix(measurement)) {

        return {

            comparable: false,

            reason: NOT_COMPARABLE_REASONS.NO_DERIVED_BRIX

        };

    }

    if (!hasBrixMate(measurement)) {

        return {

            comparable: false,

            reason: NOT_COMPARABLE_REASONS.NO_BRIX_MATE

        };

    }

    return {

        comparable: true,

        reason: null

    };

}

function round(value, decimals = 2) {

    if (value === null || value === undefined || !Number.isFinite(value)) {

        return value;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

/*
 * Sección 4 -- modelo de comparación.
 *   ΔBrix   = Brix_derivado - Brix_real   (CONSERVA el signo --
 *             sección 4: "nos interesa saber si el hidrómetro
 *             sobreestima o subestima")
 *   Error   = |ΔBrix|
 *   Error % = (Error / Brix_real) x 100
 *
 * Sección 13, caso especial -- BrixMate = 0: nunca se calcula
 * relativeError (división entre cero), pero SÍ se conserva
 * deltaBrix/absoluteError.
 */
function computeComparison(derivedBrix, measuredBrix) {

    const derived =
        Number(derivedBrix);

    const measured =
        Number(measuredBrix);

    const deltaBrix =
        round(derived - measured, 2);

    const absoluteError =
        round(Math.abs(deltaBrix), 2);

    const relativeError =
        measured === 0
            ? null
            : round((absoluteError / Math.abs(measured)) * 100, 2);

    return {

        deltaBrix,

        absoluteError,

        relativeError

    };

}

/*
 * Sección 9 -- estado visual 🟢/🟡/🔴 según el error absoluto.
 * `thresholds` es opcional -- si no se pasa, usa las constantes
 * temporales de backend de este mismo módulo.
 */
function classifyStatus(absoluteError, thresholds = {}) {

    const acceptable =
        thresholds.acceptableAbsoluteError ?? DEFAULT_ACCEPTABLE_ABSOLUTE_ERROR;

    const warning =
        thresholds.warningAbsoluteError ?? DEFAULT_WARNING_ABSOLUTE_ERROR;

    if (absoluteError <= acceptable) {

        return STATUS.OK;

    }

    if (absoluteError <= warning) {

        return STATUS.WARNING;

    }

    return STATUS.HIGH;

}

/*
 * Sección 8 -- resumen estadístico. `comparableEntries` debe ser la
 * lista YA FILTRADA de comparaciones comparables (cada una con un
 * `.comparison.{deltaBrix,absoluteError,relativeError}`); las no
 * comparables nunca deben llegar aquí, para no contaminar los
 * promedios (sección 12).
 */
function buildSummary(comparableEntries) {

    const count =
        comparableEntries.length;

    if (count === 0) {

        return {

            comparisons: 0,

            averageAbsoluteError: null,

            averageRelativeError: null,

            maxAbsoluteError: null,

            minAbsoluteError: null,

            averageBias: null

        };

    }

    const absoluteErrors =
        comparableEntries.map(entry => entry.comparison.absoluteError);

    const deltas =
        comparableEntries.map(entry => entry.comparison.deltaBrix);

    // Sección 13 -- BrixMate=0 aporta absoluteError/deltaBrix a los
    // promedios de arriba, pero su relativeError es `null` y se
    // excluye del promedio de error relativo (no se trata como 0%).
    const relativeErrors =
        comparableEntries
            .map(entry => entry.comparison.relativeError)
            .filter(value => value !== null && value !== undefined);

    const average = values =>
        round(values.reduce((sum, value) => sum + value, 0) / values.length, 2);

    return {

        comparisons: count,

        averageAbsoluteError: average(absoluteErrors),

        averageRelativeError: relativeErrors.length > 0 ? average(relativeErrors) : null,

        maxAbsoluteError: round(Math.max(...absoluteErrors), 2),

        minAbsoluteError: round(Math.min(...absoluteErrors), 2),

        // Sección 8 -- "Sesgo promedio = promedio(Brix_derivado -
        // Brix_real)". Se muestra únicamente como información
        // descriptiva; sección 8 misma aclara "en esta entrega
        // solamente se muestra el sesgo; no se utiliza todavía para
        // recalibrar."
        averageBias: average(deltas)

    };

}

module.exports = {

    DEFAULT_ACCEPTABLE_ABSOLUTE_ERROR,

    DEFAULT_WARNING_ABSOLUTE_ERROR,

    NOT_COMPARABLE_REASONS,

    COMPARABLE_PHASES,

    STATUS,

    isFiniteNumber,

    hasDerivedBrix,

    hasBrixMate,

    evaluateComparability,

    computeComparison,

    classifyStatus,

    buildSummary,

    round

};
