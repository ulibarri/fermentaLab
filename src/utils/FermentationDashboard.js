/*
 * Entrega 2.7.0.4 -- "Panel operativo de monitoreo de fermentaciones".
 *
 * Módulo puro (sin Sequelize ni Express): NO calcula ninguna predicción
 * ni desviación nueva (sección 15, explícito -- "es exclusivamente una
 * capa de visualización y monitoreo operativo"). Solo transforma datos
 * YA CALCULADOS por 2.7.0.1/2.7.0.2/2.7.0.3 (predicción vigente, alerta
 * activa) en lo que el panel necesita: disponibilidad de predicción,
 * severidad unificada para ordenar/filtrar, y frescura de la última
 * medición.
 */

// Estados de ProductionBatch que el panel considera "monitorizables"
// (sección 8): en curso, esperando iniciar F2, o F2 en curso. Los
// terminales (PLANNED, F2_DONE, F2_SKIPPED, CANCELLED) nunca aparecen
// por defecto -- PLANNED porque todavía no hay nada que monitorear,
// los otros tres porque ya terminaron. COMPLETED se incluye a
// propósito: un lote que terminó F1 y todavía no inició F2 sigue
// siendo una fermentación activa desde la perspectiva operativa del
// spec (sigue sin estar embotellado/listo) -- judgment call, ver
// comentario de FermentationDashboardService.
const MONITORABLE_STATUSES = ["IN_PROGRESS", "COMPLETED", "F2_STARTED"];

// Sección 5 -- a partir de cuántos minutos sin una medición nueva se
// marca la antigüedad con ⚠. Sin número explícito en el spec (solo el
// ejemplo "hace 7 h ⚠" vs. "hace 25 min" sin ⚠) -- 6 horas es un valor
// razonable para el ritmo de mediciones de este proyecto (mediciones
// F1 cada pocas horas), exportado para poder ajustarse con datos
// reales, mismo criterio que el resto de umbrales "configurables" de
// este proyecto (2.7.0.1 sección 6, 2.7.0.3 sección 3).
const DEFAULT_STALE_MEASUREMENT_MINUTES = 360;

// Sección 2 -- orden de prioridad explícito. Los estados "sin
// predicción" (sección 11/12) NUNCA son una desviación -- se ordenan
// después de NORMAL (un lote sin datos suficientes no es más urgente
// que uno normal, pero tampoco debe mezclarse con él silenciosamente).
// Dentro de "sin predicción", ESPERANDO_DATOS (lote recién iniciado,
// esperado) se considera menos urgente que NO_DISPONIBLE (algo impide
// generar predicción pese a haber datos -- más digno de revisión).
const PRIORITY_ORDER = [

    "CRITICAL",

    "SIGNIFICANT",

    "WARNING",

    "NORMAL",

    "NO_DISPONIBLE",

    "ESPERANDO_DATOS"

];

const SEVERITY_META = {

    CRITICAL: { label: "Crítica", emoji: "🔴" },

    SIGNIFICANT: { label: "Desviación", emoji: "🟠" },

    WARNING: { label: "Atención", emoji: "🟡" },

    NORMAL: { label: "Normal", emoji: "🟢" },

    NO_DISPONIBLE: { label: "Predicción no disponible", emoji: "⚪" },

    ESPERANDO_DATOS: { label: "Sin predicción", emoji: "⚪" }

};

class FermentationDashboard {

    /*
     * Secciones 11/12 -- distingue "todavía no hay datos suficientes"
     * (ESPERANDO_DATOS, el caso normal de un lote recién iniciado) de
     * "hay mediciones pero no se pudo generar una predicción"
     * (NO_DISPONIBLE, ej. sin modelo/calibración aplicable). Misma
     * distinción ya introducida en `BatchOperationalPredictionService`
     * (2.7.0.2) -- se reproduce aquí como una función pura de dos
     * booleanos en vez de depender de ese servicio (que hace consultas
     * NO lean, sección 14), para no cargar el historial completo de
     * predicciones/mediciones de cada lote solo para decidir esto.
     */
    static classifyPredictionAvailability({ hasCurrentPrediction, hasF1Measurement }) {

        if (hasCurrentPrediction) {

            return "AVAILABLE";

        }

        return hasF1Measurement ? "NO_DISPONIBLE" : "ESPERANDO_DATOS";

    }

    /*
     * Severidad unificada de una fila del panel -- la MISMA que ya
     * decidió `ProductionPredictionAlertService`/`PredictionDeviation`
     * (2.7.0.3) cuando existe una alerta activa (nunca se recalcula
     * aquí), o NORMAL cuando hay predicción pero ninguna alerta, o el
     * código de disponibilidad (sección 11/12) cuando ni siquiera hay
     * predicción todavía.
     */
    static resolveSeverity({ activeAlertSeverity, predictionAvailability }) {

        if (activeAlertSeverity) {

            return activeAlertSeverity;

        }

        if (predictionAvailability === "AVAILABLE") {

            return "NORMAL";

        }

        return predictionAvailability;

    }

    static severityMeta(severity) {

        return SEVERITY_META[severity] || { label: severity || "—", emoji: "⚪" };

    }

    static priorityRank(severity) {

        const index =
            PRIORITY_ORDER.indexOf(severity);

        return index === -1 ? PRIORITY_ORDER.length : index;

    }

    /*
     * Sección 5 -- antigüedad de la última medición. `minutesAgo` puede
     * ser negativo por relojes ligeramente desincronizados -- se trata
     * como 0 (nunca "antigüedad negativa"). `stale` marca el ⚠ del
     * mockup.
     */
    static classifyActivity({ lastMeasurementDate, now = new Date(), staleThresholdMinutes = DEFAULT_STALE_MEASUREMENT_MINUTES }) {

        if (!lastMeasurementDate) {

            return { minutesAgo: null, stale: false };

        }

        const lastMillis =
            new Date(lastMeasurementDate).getTime();

        const nowMillis =
            new Date(now).getTime();

        if (!Number.isFinite(lastMillis) || !Number.isFinite(nowMillis)) {

            return { minutesAgo: null, stale: false };

        }

        const minutesAgo =
            Math.max(0, Math.round((nowMillis - lastMillis) / (60 * 1000)));

        return {

            minutesAgo,

            stale: minutesAgo >= staleThresholdMinutes

        };

    }

    /*
     * Comparador para el orden por defecto (sección 2): severidad
     * primero (según PRIORITY_ORDER), y dentro del mismo nivel, por
     * antigüedad de la alerta (más antigua primero -- la que lleva más
     * tiempo sin resolverse es la más urgente) cuando ambas filas
     * tienen una alerta activa; si no, por recencia de la última
     * medición (más reciente primero, para no enterrar entre lotes
     * "normales" el que sí está siendo monitoreado activamente).
     */
    static comparePriority(a, b) {

        const rankDiff =
            this.priorityRank(a.severity) - this.priorityRank(b.severity);

        if (rankDiff !== 0) {

            return rankDiff;

        }

        if (a.alertCreatedAt && b.alertCreatedAt) {

            return new Date(a.alertCreatedAt).getTime() - new Date(b.alertCreatedAt).getTime();

        }

        if (a.alertCreatedAt) {

            return -1;

        }

        if (b.alertCreatedAt) {

            return 1;

        }

        const aMinutes =
            a.lastMeasurementMinutesAgo ?? Number.POSITIVE_INFINITY;

        const bMinutes =
            b.lastMeasurementMinutesAgo ?? Number.POSITIVE_INFINITY;

        return aMinutes - bMinutes;

    }

    /*
     * Sección 3 -- tarjetas de resumen, siempre derivadas de `items`
     * (nunca un contador persistido/independiente). El spec solo
     * contempla 3 categorías en el JSON de la sección 13
     * (normal/warning/critical) pese a que la sección 2 define 4
     * niveles de severidad -- se pliega WARNING+SIGNIFICANT dentro de
     * "warning" (ambos son "necesita atención, todavía no crítico",
     * consistente con la tarjeta "ATENCIÓN" única de la sección 3) y se
     * agrega `noPrediction` (aditivo, fuera del JSON literal del spec,
     * sección 13: "la estructura exacta deberá adaptarse") para que
     * `active` siempre sea la suma exacta de las categorías mostradas
     * -- nunca un lote "desaparece" silenciosamente del resumen.
     * Judgment call, documentado también en el servicio.
     */
    static summarize(items) {

        const summary = {

            active: items.length,

            normal: 0,

            warning: 0,

            critical: 0,

            noPrediction: 0

        };

        for (const item of items) {

            if (item.severity === "CRITICAL") {

                summary.critical++;

            } else if (item.severity === "SIGNIFICANT" || item.severity === "WARNING") {

                summary.warning++;

            } else if (item.severity === "NORMAL") {

                summary.normal++;

            } else {

                summary.noPrediction++;

            }

        }

        return summary;

    }

}

FermentationDashboard.MONITORABLE_STATUSES =
    MONITORABLE_STATUSES;

FermentationDashboard.DEFAULT_STALE_MEASUREMENT_MINUTES =
    DEFAULT_STALE_MEASUREMENT_MINUTES;

FermentationDashboard.PRIORITY_ORDER =
    PRIORITY_ORDER;

module.exports =
    FermentationDashboard;
