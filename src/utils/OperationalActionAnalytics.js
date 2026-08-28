const ProductionAlertActionCatalog =
    require("./ProductionAlertActionCatalog");

/*
 * Entrega 2.7.0.7 -- "desglose de acciones". Módulo puro (sin
 * Sequelize/Express) que consolida las acciones operativas registradas
 * en 2.7.0.5 y evaluadas en 2.7.0.6, y produce ÚNICAMENTE estadísticas
 * agregadas -- nunca vuelve a decidir si UNA acción mejoró, empeoró o se
 * resolvió (eso ya lo decidió `ActionEffectiveness.classify()` en el
 * momento en que la acción se evaluó, sección 15: "no debemos modificar
 * lotes/mediciones/predicciones/alertas/acciones/evaluaciones de
 * efectividad" -- esta entrega es exclusivamente de consulta/agregación/
 * visualización).
 *
 * Recibe siempre un array de objetos PLANOS ya filtrados por el
 * servicio (nunca instancias de Sequelize) con, como mínimo,
 * `{type, effectivenessStatus, alertSeverityAtAction}` -- mismo patrón
 * que `RecalibrationProcessAnalysis.summarize()` (2.6.1.33): el módulo
 * puro nunca toca la base de datos, solo agrega lo que ya le entregaron.
 *
 * Regla central (Acción 2/5 del spec): PENDING nunca participa en
 * ningún porcentaje. `evaluated = improved + unchanged + worsened +
 * resolved`, y todos los porcentajes se calculan EXCLUSIVAMENTE sobre
 * `evaluated` -- nunca sobre `total`. Con `evaluated = 0` los
 * porcentajes son `null` (nunca una división entre cero, nunca un 0%
 * que sugiera falsamente "0% de mejora" cuando en realidad no hay
 * ninguna acción evaluada todavía).
 */

// Acción 14 -- "no debemos presentar 100% de mejora como una conclusión
// importante si solamente existe 1 acción evaluada". El spec no da un
// número exacto ("muestra limitada") -- se reutiliza el mismo umbral de
// "muestra pequeña" ya establecido en este proyecto desde 2.6.1.5/2.6.1.7
// (`SMALL_SAMPLE_THRESHOLD`/`MIN_EVALUATED_BATCHES_FOR_COMPARISON`, ambos
// 5) en vez de inventar un número nuevo. Judgment call, flagged.
const MIN_RELIABLE_SAMPLE_SIZE = 5;

// Acción 7 -- orden canónico de severidad, mismo vocabulario/orden que
// `PredictionDeviation.classifySeverityByMinutes()` (2.7.0.3) en todo el
// resto del proyecto.
const SEVERITY_ORDER = ["WARNING", "SIGNIFICANT", "CRITICAL"];

function round(value, decimals = 1) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

/*
 * Acción 5 -- "si evaluated = 0, los porcentajes deben mostrarse como
 * N/A... evitando división entre cero." `null` es la representación
 * interna de "N/A"; el frontend decide el texto exacto a mostrar.
 * Redondeo a 1 decimal, mismo criterio que el resto de módulos de
 * análisis del proyecto (`RecalibrationProcessAnalysis.round()`,
 * default `decimals=1`) -- el mockup de la Acción 12 ("42.9%") y el de
 * la Acción 13 ("45.5%"/"18.2%"/etc.) usan 1 decimal; el texto de la
 * Acción 5 ("42.86%") usa 2, pero se prioriza la consistencia con el
 * resto de este proyecto y con los mockups de interfaz reales sobre el
 * texto explicativo. Judgment call, flagged.
 */
function percentageOf(part, whole) {

    if (!whole) {

        return null;

    }

    return round((part / whole) * 100, 1);

}

/*
 * Acción 2/4 -- conteo base por estado de efectividad. `effectivenessStatus`
 * ausente/nulo (no debería ocurrir -- la columna tiene default "PENDING"
 * desde 2.7.0.6 -- pero se contempla defensivamente) se trata como
 * PENDING, nunca como evaluado.
 */
function buildCounts(actions) {

    const counts = {

        total: actions.length,

        pending: 0,

        improved: 0,

        unchanged: 0,

        worsened: 0,

        resolved: 0

    };

    actions.forEach(action => {

        const status =
            action.effectivenessStatus || "PENDING";

        if (status === "IMPROVED") {

            counts.improved++;

        } else if (status === "UNCHANGED") {

            counts.unchanged++;

        } else if (status === "WORSENED") {

            counts.worsened++;

        } else if (status === "RESOLVED") {

            counts.resolved++;

        } else {

            counts.pending++;

        }

    });

    counts.evaluated =
        counts.improved + counts.unchanged + counts.worsened + counts.resolved;

    return counts;

}

/*
 * Acción 14 -- adjunta porcentajes (sobre `evaluated`, nunca `total`) y
 * la bandera `smallSample` ("Muestra limitada. Resultado descriptivo.")
 * a un objeto de conteos ya construido por `buildCounts()`. Nunca oculta
 * ni bloquea el resultado -- solo lo marca (spec explícito: "no es
 * necesario bloquear ni ocultar los resultados").
 */
function withPercentages(counts) {

    const evaluated =
        counts.evaluated;

    return {

        ...counts,

        percentages: {

            improved: percentageOf(counts.improved, evaluated),

            unchanged: percentageOf(counts.unchanged, evaluated),

            worsened: percentageOf(counts.worsened, evaluated),

            resolved: percentageOf(counts.resolved, evaluated)

        },

        smallSample: evaluated > 0 && evaluated < MIN_RELIABLE_SAMPLE_SIZE

    };

}

/*
 * Acción 4/5 -- resumen general (tarjetas). Único punto de entrada que
 * el servicio necesita para el bloque `summary` del DTO.
 */
function summarize(actions) {

    return withPercentages(buildCounts(actions || []));

}

/*
 * Acción 7 -- agrupación por severidad ORIGINAL de la alerta que
 * disparó la acción (`alertSeverityAtAction`, la fotografía inmutable
 * capturada en 2.7.0.6 -- NUNCA `severityAfter`, que es el resultado
 * posterior, no el origen). Solo se incluyen severidades con al menos
 * una acción -- el selector de filtro de la vista ya ofrece las tres
 * opciones de forma independiente de lo que haya en los datos.
 */
function groupBySeverity(actions) {

    const bySeverityCode =
        {};

    (actions || []).forEach(action => {

        const severity =
            action.alertSeverityAtAction || "UNKNOWN";

        if (!bySeverityCode[severity]) {

            bySeverityCode[severity] =
                [];

        }

        bySeverityCode[severity].push(action);

    });

    const codes =
        Object.keys(bySeverityCode);

    const orderedCodes =
        SEVERITY_ORDER.filter(code => codes.includes(code))
            .concat(codes.filter(code => !SEVERITY_ORDER.includes(code)));

    return orderedCodes.map(severity => ({

        severity,

        ...withPercentages(buildCounts(bySeverityCode[severity]))

    }));

}

/*
 * Acción 6/7 -- agrupación por tipo de acción, en el orden del catálogo
 * (sección 3 de 2.7.0.5) -- nunca un orden inventado (alfabético o por
 * conteo) que no venga de la única fuente de verdad de los tipos.
 * Cada fila incluye, de forma ADITIVA sobre el DTO literal de la
 * Acción 10 (que solo define `byActionType`/`bySeverity` como arreglos
 * planos), un desglose `bySeverity` propio -- necesario para reproducir
 * el ejemplo de la Acción 7 ("Ajuste de temperatura: WARNING Improved
 * 60%, SIGNIFICANT Improved 45%, CRITICAL Improved 20%"), que es
 * inherentemente una tabla cruzada tipo×severidad y no se puede derivar
 * del `bySeverity` plano de nivel superior (ese agrega TODOS los tipos
 * juntos). Judgment call, flagged -- ver resumen de la entrega.
 */
function groupByActionType(actions) {

    const byTypeCode =
        {};

    (actions || []).forEach(action => {

        const type =
            action.type || "UNKNOWN";

        if (!byTypeCode[type]) {

            byTypeCode[type] =
                [];

        }

        byTypeCode[type].push(action);

    });

    const catalogOrder =
        ProductionAlertActionCatalog.ACTION_TYPES.map(t => t.code);

    const presentCodes =
        Object.keys(byTypeCode);

    const orderedCodes =
        catalogOrder.filter(code => presentCodes.includes(code))
            .concat(presentCodes.filter(code => !catalogOrder.includes(code)));

    return orderedCodes.map(type => ({

        type,

        typeLabel: ProductionAlertActionCatalog.typeLabel(type),

        ...withPercentages(buildCounts(byTypeCode[type])),

        bySeverity: groupBySeverity(byTypeCode[type])

    }));

}

/*
 * Acción 10 -- DTO completo, independiente de las entidades de base de
 * datos (solo números/strings planos). El servicio es responsable de
 * filtrar `actions` ANTES de llamar a esta función (Acción 9: "el
 * backend deberá aplicar los filtros antes de realizar las
 * agregaciones") -- este módulo nunca filtra, solo agrega lo que recibe.
 */
function buildAnalyticsDTO(actions) {

    const list =
        actions || [];

    return {

        summary: summarize(list),

        byActionType: groupByActionType(list),

        bySeverity: groupBySeverity(list)

    };

}

module.exports = {

    MIN_RELIABLE_SAMPLE_SIZE,

    SEVERITY_ORDER,

    percentageOf,

    summarize,

    groupByActionType,

    groupBySeverity,

    buildAnalyticsDTO

};
