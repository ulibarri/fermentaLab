/*
 * Entrega 2.7.0.9 -- "reporte consolidado predictivo-operativo". Módulo
 * puro (sin Sequelize/Express) que responde "¿cómo está funcionando el
 * sistema predictivo de FermentaLab y cómo se están comportando las
 * fermentaciones en la operación real?" ÚNICAMENTE consolidando DTOs
 * que otros módulos ya calcularon -- nunca reimplementa una fórmula
 * existente (sección 10, regla crítica: "fuente única de verdad").
 *
 * Recibe siempre los DTOs YA PRODUCIDOS por los cuatro servicios de
 * analítica existentes:
 *   - predictionPerformance: salida de ModelAccuracyMetricsService.getMetrics()
 *     (2.6.1.14, con el campo aditivo medianAbsoluteErrorHours de 2.7.0.9).
 *   - calibration: { calibrations, alertsSummary, pendingProposalsCount }
 *     -- calibrations viene de CalibrationEffectivenessService.getAllActiveHealth()
 *     fusionado con MaturationModelCalibrationRepository.findAll({status:"ACTIVE"})
 *     (versión/activatedAt/producto/receta); alertsSummary de
 *     ModelAlertService.getSummary() (2.6.1.22); pendingProposalsCount de
 *     RecalibrationProposalService.list({status:"PROPOSED"}) (2.6.1.24).
 *   - alertTrends: salida de AlertTrendAnalysis.buildTrendDTO() (2.7.0.8).
 *   - actionAnalytics: salida de OperationalActionAnalytics.buildAnalyticsDTO()
 *     (2.7.0.7).
 *
 * Este módulo solo hace TRES cosas nuevas, cada una "claramente
 * identificada" (sección 10) y ninguna duplica una fórmula existente:
 *   1. Selecciona/etiqueta campos YA CALCULADOS (p.ej. "mejor modelo" =
 *      comparison.lowerMae, ya calculado por ModelAccuracyMetrics).
 *   2. Suma valores YA CALCULADOS sobre el período (p.ej. creadas/
 *      resueltas totales = Σ timeline[].created/.resolved).
 *   3. Reordena una lista YA CALCULADA (oldestActive -> priorityAlerts)
 *      con un criterio de prioridad nuevo (CRITICAL primero, luego
 *      antigüedad, luego severidad -- sección 8) que ningún módulo
 *      anterior necesitaba.
 */

// Sección 8 -- orden de prioridad para alertas activas ("qué requiere
// atención primero"). Distinto de SEVERITY_ORDER (WARNING->CRITICAL,
// usado en todo el resto del proyecto para tablas ascendentes) porque
// aquí el criterio es "qué ver primero", no "orden natural de severidad"
// -- se define localmente, con su propio nombre, para no confundir los
// dos usos.
const SEVERITY_PRIORITY_ORDER = ["CRITICAL", "SIGNIFICANT", "WARNING"];

// Sección 15/16 -- tope de alertas prioritarias mostradas. El spec no da
// un número explícito (igual que MAX_OLDEST_ACTIVE_RESULTS en 2.7.0.8);
// como priorityAlerts se construye reordenando `oldestActive` (que ya
// viene acotado a 10, ver AlertTrendAnalysis.MAX_OLDEST_ACTIVE_RESULTS),
// este tope solo protege el caso en que el llamador pase una lista más
// larga desde otro origen. Judgment call, flagged.
const MAX_PRIORITY_ALERTS = 10;

function round(value, decimals = 1) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

/*
 * Sección 8 -- "Priorizadas por: 1. CRITICAL; 2. antigüedad; 3.
 * severidad." Se lee como: separar primero CRITICAL del resto: dentro
 * de cada grupo, ordenar por antigüedad (más antigua primero, ya
 * expresado como `activeMinutes` descendente); `severidad` actúa como
 * desempate final para edades exactamente iguales (SIGNIFICANT antes que
 * WARNING). Nunca decide POR SÍ SOLA cuáles alertas están activas ni
 * calcula `activeMinutes` -- eso ya lo hizo
 * `AlertTrendAnalysis.buildOldestActive()` (2.7.0.8); esta función solo
 * reordena esa misma lista con un criterio de prioridad distinto.
 */
function buildPriorityAlerts(oldestActiveAlerts, { limit = MAX_PRIORITY_ALERTS } = {}) {

    const severityRank = severity => {

        const index =
            SEVERITY_PRIORITY_ORDER.indexOf(severity);

        return index === -1 ? SEVERITY_PRIORITY_ORDER.length : index;

    };

    return (oldestActiveAlerts || [])

        .slice()

        .sort((a, b) => {

            const criticalRank = alert =>
                alert.severity === "CRITICAL" ? 0 : 1;

            if (criticalRank(a) !== criticalRank(b)) {

                return criticalRank(a) - criticalRank(b);

            }

            if (b.activeMinutes !== a.activeMinutes) {

                return b.activeMinutes - a.activeMinutes;

            }

            return severityRank(a.severity) - severityRank(b.severity);

        })

        .slice(0, limit);

}

/*
 * Sección 3 -- "MEJOR MODELO OBSERVADO" / "MODELO CON MAYOR ERROR
 * OBSERVADO", más los conteos "PREDICCIONES REALIZADAS"/"VERIFICADAS".
 * Todo se deriva de campos que `ModelAccuracyMetricsService.getMetrics()`
 * YA expone -- `bestModel`/`worstModel` son sencillamente
 * `comparison.lowerMae` (ya calculado) y "el otro modelo del par", nunca
 * un nuevo cálculo de MAE. `predictionsVerified` = `batchesConsidered`
 * (ya es la suma de `sampleSize` por modelo). `predictionsMade` es una
 * suma adicional (sección 10, "agregación adicional... claramente
 * identificada"): predicciones que SÍ se generaron, evaluables o no
 * (`batchesConsidered + excluded.unavailable`) -- deliberadamente NO
 * incluye `excluded.pending` (el lote aún no maduró, no sabemos si hay
 * predicción) ni `excluded.noPrediction` (no hay predicción). Judgment
 * call, flagged.
 */
function buildPredictionPerformanceSummary(predictionPerformance) {

    if (!predictionPerformance) {

        return null;

    }

    const models =
        predictionPerformance.models || [];

    const comparison =
        predictionPerformance.comparison || { lowerMae: null, lowerRmse: null };

    const bestModel =
        comparison.lowerMae || null;

    const worstModel =
        bestModel
            ? (models.find(m => m.modelType !== bestModel && m.sampleSize > 0) || {}).modelType || null
            : null;

    const predictionsVerified =
        predictionPerformance.batchesConsidered || 0;

    const predictionsMade =
        predictionsVerified + (predictionPerformance.excluded ? predictionPerformance.excluded.unavailable : 0);

    return {

        predictionsMade,

        predictionsVerified,

        bestModel,

        worstModel,

        hasSufficientData: models.some(m => m.sampleSize > 0)

    };

}

/*
 * Sección 5 -- "si no existe una definición previa de tendencia
 * suficientemente sólida, debe mostrarse únicamente el dato... sin
 * inventar una clasificación." Este proyecto no tiene, en ningún otro
 * módulo, una definición de "tendencia de inventario de alertas" con un
 * umbral validado -- así que deliberadamente esta función NUNCA clasifica
 * "aumento"/"disminución": solo suma `created`/`resolved` YA calculados
 * por `AlertTrendAnalysis.buildTimeline()` sobre el período completo.
 */
function buildAlertPeriodTotals(alertTrends) {

    const timeline =
        (alertTrends && alertTrends.timeline) || [];

    const createdInPeriod =
        timeline.reduce((sum, bucket) => sum + (bucket.created || 0), 0);

    const resolvedInPeriod =
        timeline.reduce((sum, bucket) => sum + (bucket.resolved || 0), 0);

    return { createdInPeriod, resolvedInPeriod };

}

/*
 * Sección 7 -- resumen ejecutivo. "Precisión observada" es un único
 * número (a diferencia del bloque 1, que muestra ambos modelos por
 * separado) -- se toma del modelo con MEJOR desempeño observado
 * (`bestModel`, ya seleccionado arriba sin recalcular nada), usando su
 * `exactPercentage` YA CALCULADO (precisión dentro del umbral EXACT de
 * ±15 min, `PredictionEvaluation.EXACT_THRESHOLD_HOURS`). Si no hay un
 * modelo con muestra suficiente para determinar cuál es "mejor", el
 * campo queda `null` -- nunca se promedia entre modelos (mezclaría
 * tamaños de muestra distintos, una fórmula nueva no autorizada).
 * Judgment call, flagged -- documentado también en el resumen de la
 * entrega.
 */
function buildExecutiveSummary({ predictionPerformance, predictionPerformanceSummary, calibration, alertTrends, actionAnalytics }) {

    const models =
        (predictionPerformance && predictionPerformance.models) || [];

    const bestModelRow =
        predictionPerformanceSummary && predictionPerformanceSummary.bestModel
            ? models.find(m => m.modelType === predictionPerformanceSummary.bestModel)
            : null;

    const alertsSummary =
        (calibration && calibration.alertsSummary) || null;

    return {

        predictionsVerified: predictionPerformanceSummary ? predictionPerformanceSummary.predictionsVerified : 0,

        accuracyObservedPercentage: bestModelRow ? bestModelRow.exactPercentage : null,

        accuracyObservedModel: bestModelRow ? bestModelRow.modelType : null,

        activeAlerts: alertTrends ? alertTrends.summary.active : 0,

        criticalAlerts: alertTrends ? alertTrends.summary.critical : 0,

        actionsEvaluated: actionAnalytics ? actionAnalytics.summary.evaluated : 0,

        calibrationAlertsOpen: alertsSummary ? (alertsSummary.open + alertsSummary.acknowledged) : 0

    };

}

/*
 * Sección 14 -- "el DTO debe documentar claramente qué fecha utiliza
 * cada métrica." Texto fijo (documentación, no un cálculo) que refleja
 * las convenciones YA establecidas en cada módulo fuente -- nunca
 * inventa una convención nueva aquí.
 */
function buildDateSources() {

    return [

        { block: "predictionPerformance", field: "batchesConsidered / models[]", dateSource: "Maduración real del lote (ProductionBatch.finishedAt) -- Entrega 2.6.1.14." },

        { block: "calibration", field: "alertsSummary (open/acknowledged/resolved)", dateSource: "Fecha de creación de la alerta de calibración (MaturationModelAlert.createdAt) -- Entrega 2.6.1.22." },

        { block: "calibration", field: "calibrations[].health / recentMaeHours", dateSource: "Estado EN VIVO, no filtrado por período (ventana móvil de predicciones recientes) -- Entrega 2.6.1.18." },

        { block: "calibration", field: "pendingProposalsCount", dateSource: "Fecha de creación de la propuesta (MaturationModelCalibration.createdAt) -- Entrega 2.6.1.24." },

        { block: "alerts", field: "summary.total / active / resolved / critical", dateSource: "Alertas creadas dentro del período (ProductionPredictionAlert.createdAt) -- Entrega 2.7.0.8." },

        { block: "alerts", field: "duration / durationBySeverity", dateSource: "resolvedAt - createdAt, solo alertas resueltas -- Entrega 2.7.0.8." },

        { block: "alerts", field: "timeline.created / createdInPeriod", dateSource: "createdAt de la alerta." },

        { block: "alerts", field: "timeline.resolved / resolvedInPeriod", dateSource: "resolvedAt de la alerta (puede caer en un período distinto al de creación)." },

        { block: "actions", field: "summary (total/evaluated/pending/improved/unchanged/worsened/resolved)", dateSource: "Fecha de registro de la acción (ProductionAlertAction.createdAt) -- Entrega 2.7.0.7." },

        { block: "priorityAlerts", field: "activeMinutes", dateSource: "Calculado contra el momento en que se generó el reporte (now), no contra el fin del período." }

    ];

}

// Sección 16 -- texto metodológico obligatorio. Frases fijas, no
// derivadas de ningún cálculo -- consolidan advertencias que cada módulo
// fuente ya expresa por separado (avisos permanentes de 2.7.0.7/2.7.0.8,
// notas de ModelAccuracyMetricsService) en un solo lugar visible.
function buildMethodologyNotes() {

    return [

        "Todas las métricas de este reporte son descriptivas: resumen lo observado hasta ahora, no constituyen una predicción ni una garantía futura.",

        "Las acciones operativas muestran evolución observada después de la acción -- nunca se afirma que la acción haya causado el resultado (no hay evidencia de causalidad).",

        "Una muestra pequeña (menos de 5 observaciones) puede no representar una tendencia real -- se muestra siempre el tamaño de la muestra junto al dato.",

        "Las predicciones se evalúan contra resultados reales (maduración real del lote), nunca contra sí mismas.",

        "Las alertas muestran desviaciones respecto a reglas y umbrales ya definidos en el sistema -- no son, por sí solas, evidencia de una falla operativa.",

        "Que una alerta se resuelva no significa necesariamente que una acción específica haya tenido éxito -- pueden coincidir por otras razones (cambios naturales del proceso, paso del tiempo, u otra intervención)."

    ];

}

/*
 * Punto de entrada principal -- arma el DTO consolidado tal como lo
 * describe la sección 11 del spec, más los campos aditivos documentados
 * en cada función de arriba. Recibe los CUATRO DTOs ya calculados (o
 * `null` cuando ese bloque no tiene datos para el período -- sección 14:
 * "cada bloque debe funcionar independientemente... no debe fallar el
 * reporte completo").
 */
function buildOperationalReportDTO({ period, predictionPerformance, calibration, alertTrends, actionAnalytics }) {

    const predictionPerformanceSummary =
        buildPredictionPerformanceSummary(predictionPerformance);

    const alertPeriodTotals =
        buildAlertPeriodTotals(alertTrends);

    const priorityAlerts =
        buildPriorityAlerts(alertTrends ? alertTrends.oldestActive : []);

    const executiveSummary =
        buildExecutiveSummary({ predictionPerformance, predictionPerformanceSummary, calibration, alertTrends, actionAnalytics });

    return {

        period: period || { from: null, to: null },

        executiveSummary,

        predictionPerformance: predictionPerformance ? {

            ...predictionPerformance,

            ...predictionPerformanceSummary

        } : null,

        calibration: calibration || null,

        alerts: alertTrends ? {

            ...alertTrends,

            ...alertPeriodTotals

        } : null,

        actions: actionAnalytics || null,

        priorityAlerts,

        dateSources: buildDateSources(),

        methodology: buildMethodologyNotes()

    };

}

module.exports = {

    SEVERITY_PRIORITY_ORDER,

    MAX_PRIORITY_ALERTS,

    buildPriorityAlerts,

    buildPredictionPerformanceSummary,

    buildAlertPeriodTotals,

    buildExecutiveSummary,

    buildDateSources,

    buildMethodologyNotes,

    buildOperationalReportDTO

};
