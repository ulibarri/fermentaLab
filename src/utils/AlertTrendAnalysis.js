/*
 * Entrega 2.7.0.8 -- "tendencias y evolución histórica de alertas".
 * Módulo puro (sin Sequelize/Express) que consolida el historial de
 * `ProductionPredictionAlert` (2.7.0.3) en analítica descriptiva:
 * frecuencia, severidad, duración, resolución y distribución por
 * producto. Nunca decide si UNA alerta es válida ni la crea/actualiza/
 * resuelve -- eso sigue siendo exclusivo de `ProductionPredictionAlertService`
 * (2.7.0.3); esta entrega solo CONSULTA lo que ya existe (sección de
 * alcance: "no modificará predicciones/calibraciones/modelos/lotes/
 * mediciones/reglas de generación de alertas/acciones operativas").
 *
 * Recibe siempre un array de objetos PLANOS ya filtrados por el
 * servicio (nunca instancias de Sequelize), mismo criterio que
 * `OperationalActionAnalytics.js` (2.7.0.7) y `RecalibrationProcessAnalysis.js`
 * (2.6.1.33): `{id, status, severity, createdAt, resolvedAt, batchId,
 * batchNumber, productId, productName}`.
 */

// Sección 6/9 -- mismo vocabulario/orden que `PredictionDeviation.
// classifySeverityByMinutes()` (2.7.0.3) y `OperationalActionAnalytics.js`
// (2.7.0.7) en todo el resto del proyecto.
const SEVERITY_ORDER = ["WARNING", "SIGNIFICANT", "CRITICAL"];

// Sección 18 -- "en todas las métricas comparativas debe mostrarse el
// tamaño de la muestra". Mismo umbral de "muestra pequeña" ya
// establecido en 2.6.1.5/2.6.1.7/2.7.0.7 (`MIN_RELIABLE_SAMPLE_SIZE`),
// reutilizado aquí en vez de inventar un cuarto número. Judgment call,
// flagged.
const MIN_RELIABLE_SAMPLE_SIZE = 5;

// Sección 10 -- "mostrar una LISTA de las alertas activas más
// antiguas", sin un número explícito. Se limita a un tope razonable
// para que la sección siga siendo un "acceso operativo útil" (texto del
// propio spec) y no una segunda tabla completa de todas las activas.
// Judgment call, flagged.
const MAX_OLDEST_ACTIVE_RESULTS = 10;

// Sección 4 -- agrupamiento temporal por defecto cuando el llamador no
// especifica uno explícito. El spec no fija un default ("puede existir
// una opción explícita") -- se elige el punto medio de las tres
// opciones (día/semana/mes) como el más generalmente útil. Judgment
// call, flagged.
const DEFAULT_GROUP_BY = "WEEK";

const GROUP_BY_VALUES = ["DAY", "WEEK", "MONTH"];

function round(value, decimals = 1) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

// Sección 12 -- "la interfaz deberá mostrar claramente el denominador
// utilizado... evitando una tasa engañosa". `null` (nunca una división
// entre cero) cuando el denominador es 0 -- mismo criterio que
// `OperationalActionAnalytics.percentageOf()` (2.7.0.7).
function percentageOf(part, whole) {

    if (!whole) {

        return null;

    }

    return round((part / whole) * 100, 1);

}

function mean(values) {

    if (!values || values.length === 0) {

        return null;

    }

    const sum =
        values.reduce((total, value) => total + value, 0);

    return round(sum / values.length, 1);

}

function median(values) {

    if (!values || values.length === 0) {

        return null;

    }

    const sorted =
        values.slice().sort((a, b) => a - b);

    const mid =
        Math.floor(sorted.length / 2);

    const value =
        sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    return round(value, 1);

}

// --- Sección 4/14 -- agrupamiento temporal ------------------------------
//
// Los tres cortes (día/semana/mes) usan UTC de forma consistente para
// que el mismo timestamp siempre caiga en el mismo bucket sin importar
// en qué zona horaria corra el proceso Node -- criterio explícito de
// "consistencia en todo el backend" de la sección 14.

function startOfUtcDay(date) {

    const d =
        new Date(date);

    d.setUTCHours(0, 0, 0, 0);

    return d;

}

// Semana ISO -- inicia en lunes, mismo estándar usado implícitamente
// por el resto del proyecto (nunca domingo).
function startOfIsoWeek(date) {

    const d =
        startOfUtcDay(date);

    const day =
        d.getUTCDay();

    const diffToMonday =
        day === 0 ? -6 : 1 - day;

    d.setUTCDate(d.getUTCDate() + diffToMonday);

    return d;

}

function startOfUtcMonth(date) {

    const d =
        new Date(date);

    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

}

function bucketStart(date, groupBy) {

    if (groupBy === "DAY") {

        return startOfUtcDay(date);

    }

    if (groupBy === "MONTH") {

        return startOfUtcMonth(date);

    }

    return startOfIsoWeek(date);

}

function isoDateOnly(date) {

    return date.toISOString().slice(0, 10);

}

function emptySeverityCounts() {

    return { WARNING: 0, SIGNIFICANT: 0, CRITICAL: 0 };

}

/*
 * Secciones 4/5/7 -- una sola pasada de bucketing que produce, por
 * período, tanto "creadas vs. resueltas" (secciones 4/5) como la
 * evolución de severidad de las alertas CREADAS en ese período (sección
 * 7) -- de forma ADITIVA sobre un único array `timeline`, en vez de tres
 * estructuras separadas que requerirían recorrer las alertas tres
 * veces y podrían desalinearse entre sí. Judgment call, flagged.
 *
 * "Creadas" se contabiliza en el bucket de `createdAt`; "resueltas" se
 * contabiliza en el bucket de `resolvedAt` (sección 14: fuentes de
 * fecha distintas y explícitas) -- una alerta puede aportar una unidad
 * a un bucket como creada y, más adelante, otra unidad a un bucket
 * DISTINTO como resuelta.
 */
function buildTimeline(alerts, groupBy = DEFAULT_GROUP_BY) {

    const normalizedGroupBy =
        GROUP_BY_VALUES.includes(groupBy) ? groupBy : DEFAULT_GROUP_BY;

    const buckets =
        {};

    function ensureBucket(date) {

        const start =
            bucketStart(date, normalizedGroupBy);

        const key =
            isoDateOnly(start);

        if (!buckets[key]) {

            buckets[key] = {

                periodStart: key,

                groupBy: normalizedGroupBy,

                created: 0,

                resolved: 0,

                bySeverity: emptySeverityCounts()

            };

        }

        return buckets[key];

    }

    (alerts || []).forEach(alert => {

        if (alert.createdAt) {

            const createdBucket =
                ensureBucket(new Date(alert.createdAt));

            createdBucket.created++;

            if (createdBucket.bySeverity[alert.severity] !== undefined) {

                createdBucket.bySeverity[alert.severity]++;

            }

        }

        if (alert.resolvedAt) {

            const resolvedBucket =
                ensureBucket(new Date(alert.resolvedAt));

            resolvedBucket.resolved++;

        }

    });

    return Object.values(buckets).sort((a, b) => a.periodStart.localeCompare(b.periodStart));

}

// --- Sección 3/12 -- resumen general -------------------------------------

function buildSummary(alerts) {

    const total =
        alerts.length;

    const active =
        alerts.filter(a => a.status === "ACTIVE").length;

    const resolved =
        alerts.filter(a => a.status === "RESOLVED").length;

    const critical =
        alerts.filter(a => a.severity === "CRITICAL").length;

    return {

        total,

        active,

        resolved,

        critical,

        // Sección 12 -- ejemplo literal 79/86 = 91.9%. En este sistema
        // una alerta solo puede estar ACTIVE o RESOLVED (no existe un
        // tercer estado terminal), así que `resolved + active === total`
        // siempre -- se usa `total` como denominador (reproduce el
        // número exacto del ejemplo de la sección 3) y el frontend
        // muestra el conteo de activas por separado (sección 12: "7
        // alertas permanecen activas"), nunca implícito dentro de la
        // tasa. Judgment call, flagged -- ver resumen de la entrega.
        resolutionRate: percentageOf(resolved, total)

    };

}

// --- Sección 8/17/18 -- duración de alertas resueltas --------------------

function buildDuration(resolvedAlerts) {

    const minutesList =
        (resolvedAlerts || [])

            .map(a => (new Date(a.resolvedAt).getTime() - new Date(a.createdAt).getTime()) / 60000)

            .filter(v => Number.isFinite(v) && v >= 0);

    const sampleSize =
        minutesList.length;

    return {

        sampleSize,

        averageMinutes: mean(minutesList),

        medianMinutes: median(minutesList),

        minMinutes: sampleSize ? round(Math.min(...minutesList), 1) : null,

        maxMinutes: sampleSize ? round(Math.max(...minutesList), 1) : null,

        // Sección 17/18 -- "la mediana y el promedio serán válidos, pero
        // deberá mostrarse el tamaño de la muestra". Nunca oculta ni
        // bloquea, solo marca (mismo criterio que `smallSample` en
        // `OperationalActionAnalytics.js`, 2.7.0.7).
        smallSample: sampleSize > 0 && sampleSize < MIN_RELIABLE_SAMPLE_SIZE

    };

}

// --- Sección 9 -- duración por severidad ---------------------------------

function buildDurationBySeverity(resolvedAlerts) {

    const bySeverityCode =
        {};

    (resolvedAlerts || []).forEach(alert => {

        const severity =
            alert.severity || "UNKNOWN";

        if (!bySeverityCode[severity]) {

            bySeverityCode[severity] =
                [];

        }

        bySeverityCode[severity].push(alert);

    });

    const codes =
        Object.keys(bySeverityCode);

    const orderedCodes =
        SEVERITY_ORDER.filter(code => codes.includes(code))
            .concat(codes.filter(code => !SEVERITY_ORDER.includes(code)));

    return orderedCodes.map(severity => ({

        severity,

        ...buildDuration(bySeverityCode[severity])

    }));

}

// --- Sección 6 -- distribución por severidad (todas las alertas) --------

function buildSeverityDistribution(alerts) {

    const total =
        alerts.length;

    const countsBySeverity =
        {};

    alerts.forEach(alert => {

        const severity =
            alert.severity || "UNKNOWN";

        countsBySeverity[severity] =
            (countsBySeverity[severity] || 0) + 1;

    });

    const codes =
        Object.keys(countsBySeverity);

    const orderedCodes =
        SEVERITY_ORDER.filter(code => codes.includes(code))
            .concat(codes.filter(code => !SEVERITY_ORDER.includes(code)));

    return orderedCodes.map(severity => ({

        severity,

        count: countsBySeverity[severity],

        percentage: percentageOf(countsBySeverity[severity], total)

    }));

}

// --- Sección 11 -- alertas por producto/receta ---------------------------
//
// Sección 11, "importante": "no se deben comparar productos por número
// absoluto si tienen diferente número de lotes... la normalización
// puede quedar como mejora posterior". Esta función deliberadamente NO
// normaliza (alertas/lote, alertas/100 lotes) -- solo cuenta, tal como
// el spec autoriza explícitamente para esta primera entrega.
function buildByProduct(alerts) {

    const byProductId =
        {};

    (alerts || []).forEach(alert => {

        const key =
            alert.productId !== null && alert.productId !== undefined ? String(alert.productId) : "UNKNOWN";

        if (!byProductId[key]) {

            byProductId[key] = {

                productId: alert.productId ?? null,

                productName: alert.productName || "Sin producto identificado",

                items: []

            };

        }

        byProductId[key].items.push(alert);

    });

    return Object.values(byProductId)

        .map(group => {

            const total =
                group.items.length;

            const resolved =
                group.items.filter(a => a.status === "RESOLVED").length;

            const active =
                total - resolved;

            const critical =
                group.items.filter(a => a.severity === "CRITICAL").length;

            return {

                productId: group.productId,

                productName: group.productName,

                total,

                resolved,

                active,

                critical

            };

        })

        // Mockup de la sección 11 -- ordenado de mayor a menor volumen
        // de alertas, el producto que más alertas generó primero.
        .sort((a, b) => b.total - a.total);

}

// --- Sección 10 -- alertas activas más antiguas --------------------------

function buildOldestActive(alerts, { limit = MAX_OLDEST_ACTIVE_RESULTS, now = new Date() } = {}) {

    return (alerts || [])

        .filter(a => a.status === "ACTIVE")

        .slice()

        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

        .slice(0, limit)

        .map(alert => ({

            id: alert.id,

            batchId: alert.batchId ?? null,

            batchNumber: alert.batchNumber ?? null,

            severity: alert.severity,

            createdAt: alert.createdAt,

            activeMinutes: Math.max(0, Math.round((now.getTime() - new Date(alert.createdAt).getTime()) / 60000))

        }));

}

/*
 * Sección 16 -- DTO completo, independiente de las entidades de base de
 * datos. `durationBySeverity` es aditivo sobre el DTO conceptual del
 * spec (que solo lista `duration` plano) -- necesario para la sección 9
 * ("¿la duración cambia según la severidad?"), imposible de derivar del
 * `duration` agregado de nivel superior.
 */
function buildTrendDTO(alerts, { groupBy = DEFAULT_GROUP_BY, now = new Date() } = {}) {

    const list =
        alerts || [];

    const resolvedAlerts =
        list.filter(a => a.status === "RESOLVED" && a.resolvedAt);

    return {

        summary: buildSummary(list),

        duration: buildDuration(resolvedAlerts),

        durationBySeverity: buildDurationBySeverity(resolvedAlerts),

        timeline: buildTimeline(list, groupBy),

        bySeverity: buildSeverityDistribution(list),

        byProduct: buildByProduct(list),

        oldestActive: buildOldestActive(list, { now })

    };

}

module.exports = {

    SEVERITY_ORDER,

    GROUP_BY_VALUES,

    DEFAULT_GROUP_BY,

    MIN_RELIABLE_SAMPLE_SIZE,

    MAX_OLDEST_ACTIVE_RESULTS,

    percentageOf,

    buildSummary,

    buildDuration,

    buildDurationBySeverity,

    buildTimeline,

    buildSeverityDistribution,

    buildByProduct,

    buildOldestActive,

    buildTrendDTO

};
