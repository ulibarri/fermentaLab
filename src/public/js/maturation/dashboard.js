/*
 * Página "Dashboard de desempeño del modelo" (Entrega 2.6.1.20).
 *
 * Puramente de lectura/visualización -- nunca llama a ningún endpoint
 * de escritura (crear/aprobar/activar/desactivar/evaluar). Todo el
 * contenido viene de un único endpoint,
 * GET /api/maturation/models/:modelId/dashboard, salvo el selector
 * "Modelo de maduración" (poblado con GET /api/maturation/models/status,
 * reutilizado tal cual de 2.6.1.11 -- nunca reimplementado aquí).
 */

const CALIBRATION_STATUS_BADGES = {

    PROPOSED: "secondary",

    APPROVED: "info",

    ACTIVE: "success",

    INACTIVE: "dark",

    REJECTED: "danger"

};

const HEALTH_BADGES = {

    HEALTHY: "success",

    WARNING: "warning",

    DEGRADED: "danger",

    INSUFFICIENT_DATA: "secondary"

};

// Sección 8: semáforo GOOD/WARNING/POOR/INSUFFICIENT_DATA, exactamente
// los cuatro íconos del mockup.
const INDICATOR_META = {

    GOOD: { badge: "success", icon: "🟢" },

    WARNING: { badge: "warning", icon: "🟡" },

    POOR: { badge: "danger", icon: "🔴" },

    INSUFFICIENT_DATA: { badge: "secondary", icon: "⚪" }

};

// Ventana móvil SOLO para la gráfica de evolución temporal (sección 3)
// -- nunca se usa para las métricas oficiales de arriba (esas siempre
// son el agregado completo que ya calculó el backend). Mismo mínimo de
// muestra (5) que el resto del proyecto.
const TEMPORAL_ROLLING_WINDOW = 5;

// Entrega 2.6.1.21 -- alertas y recomendaciones de recalibración.
const ALERT_SEVERITY_BADGES = {

    WARNING: "warning",

    CRITICAL: "danger",

    INSUFFICIENT_DATA: "secondary"

};

const ALERT_SEVERITY_ICONS = {

    WARNING: "🟡",

    CRITICAL: "🔴",

    INSUFFICIENT_DATA: "⚪"

};

function round2(value) {

    if (value === null || value === undefined || !Number.isFinite(value)) {

        return null;

    }

    return Math.round(value * 100) / 100;

}

function rollingSeries(values, windowSize, aggregator) {

    const result = [];

    for (let i = 0; i < values.length; i++) {

        const start =
            Math.max(0, i - windowSize + 1);

        const windowValues =
            values.slice(start, i + 1).filter(v => v !== null && v !== undefined && Number.isFinite(v));

        result.push(windowValues.length > 0 ? aggregator(windowValues) : null);

    }

    return result;

}

function rollingMAE(windowValues) {

    return windowValues.reduce((acc, v) => acc + Math.abs(v), 0) / windowValues.length;

}

function rollingRMSE(windowValues) {

    return Math.sqrt(windowValues.reduce((acc, v) => acc + (v * v), 0) / windowValues.length);

}

function rollingBias(windowValues) {

    return windowValues.reduce((acc, v) => acc + v, 0) / windowValues.length;

}

/*
 * Sección 5: bins fijos de 1h entre -6h y +6h, más dos bins de
 * desborde ("< -6", "> 6") para no perder valores extremos fuera del
 * rango típico -- no es estadística avanzada (instrucción explícita
 * del spec), solo un conteo por rango fijo.
 */
function buildErrorHistogramBins(errors) {

    const edges =
        [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

    const bins =
        [{ label: "< -6h", min: -Infinity, max: -6, count: 0 }];

    for (let i = 0; i < edges.length - 1; i++) {

        bins.push({ label: `${edges[i]} a ${edges[i + 1]}h`, min: edges[i], max: edges[i + 1], count: 0 });

    }

    bins.push({ label: "> 6h", min: 6, max: Infinity, count: 0 });

    (errors || []).forEach(e => {

        if (e === null || e === undefined || !Number.isFinite(e)) {

            return;

        }

        const bin =
            bins.find(b => e >= b.min && e < b.max) || bins[bins.length - 1];

        bin.count++;

    });

    return bins;

}

class MaturationDashboardPage {

    constructor() {

        this.api =
            new MaturationDashboardApi();

        this.alertsApi =
            new MaturationAlertsApi();

        this.recalibrationModalElement =
            document.getElementById("modalRecalibrationProposal");

        this.recalibrationProposalBody =
            document.getElementById("dashRecalibrationProposalBody");

        this.confirmRecalibrationButton =
            document.getElementById("btnConfirmRecalibrationProposal");

        this.recalibrationCreatedByInput =
            document.getElementById("dashRecalibrationCreatedBy");

        this.currentAlerts =
            null;

        this.pendingRecalibrationModelId =
            null;

        if (this.confirmRecalibrationButton) {

            this.confirmRecalibrationButton.addEventListener("click", () => this.handleConfirmRecalibrationProposal());

        }

        this.recipeVersionSelect =
            document.getElementById("dashRecipeVersionId");

        this.modelSelect =
            document.getElementById("dashModelId");

        this.periodSelect =
            document.getElementById("dashPeriod");

        this.calibrationSelect =
            document.getElementById("dashCalibrationId");

        this.temporalMetricSelect =
            document.getElementById("dashTemporalMetric");

        this.emptyState =
            document.getElementById("dashEmptyState");

        this.content =
            document.getElementById("dashContent");

        this.currentDashboard =
            null;

        this.charts =
            {};

        if (this.recipeVersionSelect) {

            this.recipeVersionSelect.addEventListener("change", () => this.handleRecipeVersionChange());

        }

        if (this.modelSelect) {

            this.modelSelect.addEventListener("change", () => this.load());

        }

        if (this.periodSelect) {

            this.periodSelect.addEventListener("change", () => this.load());

        }

        if (this.calibrationSelect) {

            this.calibrationSelect.addEventListener("change", () => this.load());

        }

        if (this.temporalMetricSelect) {

            this.temporalMetricSelect.addEventListener("change", () => this.renderTemporalChart());

        }

    }

    /*
     * Entrega 2.6.1.22, sección 6 -- "Ver desempeño del modelo" desde
     * el centro de alertas debe conservar el contexto (modelo/receta,
     * y calibración/periodo cuando corresponda) en vez de aterrizar en
     * la pantalla vacía de siempre. Lee `?recipeVersionId=&modelId=
     * &calibrationId=&period=` de la URL -- todos opcionales, y si no
     * hay ninguno el comportamiento es exactamente el de antes
     * (selects vacíos, esperando que el usuario elija). Nunca falla
     * silenciosamente distinto de antes: si algún id de la URL no
     * existe entre las opciones ya cargadas, simplemente se ignora esa
     * parte y se sigue con lo que sí pudo resolverse.
     */
    async init() {

        const params =
            new URLSearchParams(window.location.search);

        const recipeVersionId =
            params.get("recipeVersionId");

        if (!recipeVersionId || !this.recipeVersionSelect) {

            return;

        }

        if (!Array.from(this.recipeVersionSelect.options).some(o => o.value === recipeVersionId)) {

            return;

        }

        this.recipeVersionSelect.value =
            recipeVersionId;

        const period =
            params.get("period");

        if (period && this.periodSelect) {

            this.periodSelect.value = period;

        }

        // handleRecipeVersionChange() ya puebla el selector de modelo y
        // llama a load() con el modelo ACTIVE preseleccionado -- eso
        // cubre el caso más común. Si la URL pide un modelo (o una
        // calibración) distinta, se fuerza después con un load() extra.
        await this.handleRecipeVersionChange();

        const modelId =
            params.get("modelId");

        let needsReload =
            false;

        if (modelId && this.modelSelect && Array.from(this.modelSelect.options).some(o => o.value === modelId) && this.modelSelect.value !== modelId) {

            this.modelSelect.value = modelId;

            needsReload = true;

        }

        if (needsReload) {

            await this.load();

        }

        const calibrationId =
            params.get("calibrationId");

        if (calibrationId && this.calibrationSelect && Array.from(this.calibrationSelect.options).some(o => o.value === calibrationId) && this.calibrationSelect.value !== calibrationId) {

            this.calibrationSelect.value = calibrationId;

            await this.load();

        }

    }

    formatDate(value) {

        return value ? new Date(value).toLocaleString() : "—";

    }

    formatHours(value) {

        return value === null || value === undefined ? "—" : `${value} h`;

    }

    formatSignedHours(value) {

        if (value === null || value === undefined) {

            return "—";

        }

        const sign =
            value > 0 ? "+" : "";

        return `${sign}${value} h`;

    }

    hideContent() {

        if (this.content) {

            this.content.style.display = "none";

        }

        if (this.emptyState) {

            this.emptyState.style.display = "";

        }

    }

    async handleRecipeVersionChange() {

        const recipeVersionId =
            this.recipeVersionSelect.value;

        this.modelSelect.innerHTML =
            `<option value="">Cargando...</option>`;

        this.modelSelect.disabled =
            true;

        this.calibrationSelect.innerHTML =
            `<option value="">Activa actual</option>`;

        this.calibrationSelect.disabled =
            true;

        this.hideContent();

        if (!recipeVersionId) {

            return;

        }

        try {

            const status =
                await this.api.getModelStatus(recipeVersionId);

            const history =
                status.history || [];

            if (history.length === 0) {

                this.modelSelect.innerHTML =
                    `<option value="">Esta receta todavía no tiene ningún modelo configurado</option>`;

                return;

            }

            this.modelSelect.innerHTML =
                history.map(m => `<option value="${m.id}" ${m.status === "ACTIVE" ? "selected" : ""}>${m.modelType} -- ${m.status}${m.status === "ACTIVE" ? " (vigente)" : ""} · ${this.formatDate(m.activatedAt)}</option>`).join("");

            this.modelSelect.disabled =
                false;

            await this.load();

        } catch (err) {

            UI.error(err.message);

        }

    }

    async load() {

        const modelId =
            this.modelSelect.value;

        if (!modelId) {

            this.hideContent();

            return;

        }

        UI.loading(true);

        try {

            const dashboard =
                await this.api.getDashboard(modelId, {

                    period: this.periodSelect.value,

                    calibrationId: this.calibrationSelect.value || undefined

                });

            this.currentDashboard =
                dashboard;

            this.populateCalibrationSelect(dashboard);

            this.render(dashboard);

            this.emptyState.style.display = "none";

            this.content.style.display = "";

            await this.loadAlerts(modelId);

        } catch (err) {

            UI.error(err.message);

        } finally {

            UI.loading(false);

        }

    }

    /*
     * Entrega 2.6.1.21, sección 12 -- la propia carga corre la
     * detección/deduplicación server-side (ver
     * ModelAlertService.getAlerts()) y devuelve tanto la alerta vigente
     * como el historial completo. Complementaria al resto del
     * dashboard: un fallo aquí nunca debe ocultar las secciones ya
     * renderizadas.
     */
    async loadAlerts(modelId) {

        try {

            const alerts =
                await this.alertsApi.getAlerts(modelId);

            this.currentAlerts =
                alerts;

            this.renderAlerts(alerts);

        } catch (err) {

            this.currentAlerts =
                null;

            const activeContainer =
                document.getElementById("dashAlertActive");

            const historyBody =
                document.getElementById("dashAlertHistoryBody");

            if (activeContainer) {

                activeContainer.innerHTML =
                    `<p class="text-muted mb-0">No se pudo cargar la información de alertas.</p>`;

            }

            if (historyBody) {

                historyBody.innerHTML = "";

            }

        }

    }

    /*
     * Sección 13 -- tarjeta de la alerta vigente (o el mensaje
     * informativo cuando no hay ninguna) + historial de alertas.
     */
    renderAlerts(alerts) {

        const activeContainer =
            document.getElementById("dashAlertActive");

        const historyBody =
            document.getElementById("dashAlertHistoryBody");

        if (alerts.current) {

            activeContainer.innerHTML =
                this.buildAlertCardHtml(alerts.current);

            this.wireAlertCardButtons(alerts.current);

        } else {

            activeContainer.innerHTML =
                `<div class="alert alert-success small py-2 px-3 mb-0">🟢 ${alerts.infoMessage || "La calibración activa mantiene un desempeño estable."}</div>`;

        }

        const history =
            alerts.history || [];

        if (history.length === 0) {

            historyBody.innerHTML =
                `<tr><td colspan="4" class="text-muted">Sin alertas registradas todavía.</td></tr>`;

            return;

        }

        historyBody.innerHTML =
            history.map(a => `
                <tr>
                    <td>${this.formatDate(a.createdAt)}</td>
                    <td><span class="badge bg-${ALERT_SEVERITY_BADGES[a.severity] || "secondary"}">${ALERT_SEVERITY_ICONS[a.severity] || ""} ${a.severity}</span></td>
                    <td>${a.message}</td>
                    <td>${a.status}</td>
                </tr>
            `).join("");

    }

    /*
     * Sección 13/7 -- tarjeta de la alerta vigente: severidad, mensaje
     * explicativo (generado server-side, nunca reconstruido aquí),
     * métricas de apoyo (tomadas de `details`, sección 7 "auditable"),
     * y los botones que aplican según severidad/estado.
     */
    buildAlertCardHtml(alert) {

        const badge =
            ALERT_SEVERITY_BADGES[alert.severity] || "secondary";

        const icon =
            ALERT_SEVERITY_ICONS[alert.severity] || "";

        const details =
            alert.details || {};

        const metricsParts =
            [];

        if (details.maeRecent !== undefined && details.maeRecent !== null) {

            metricsParts.push(`MAE reciente: ${this.formatHours(details.maeRecent)}`);

        }

        if (details.maeHistorical !== undefined && details.maeHistorical !== null) {

            metricsParts.push(`MAE histórico: ${this.formatHours(details.maeHistorical)}`);

        }

        if (details.calibrationVersion) {

            metricsParts.push(`Calibration: v${details.calibrationVersion}`);

        }

        if (details.health) {

            metricsParts.push(`Health: ${details.health}`);

        }

        // Sección 18/19: solo una alerta CRITICAL, todavía no resuelta,
        // ofrece el atajo a la propuesta de recalibración -- WARNING
        // solo pide "seguir monitoreando" (sección 4), nunca ofrece el
        // mismo botón.
        //
        // Entrega 2.6.1.23, secciones 4/5 -- si `details.linkedProposal`
        // ya trae una PROPOSED derivada de esta calibración origen, el
        // botón de crear se reemplaza por el bloque de seguimiento del
        // mockup ("Calibración origen: v2 / Nueva propuesta: v3 /
        // Estado: PROPOSED") -- evita invitar a un intento que el
        // backend ya sabe que rechazaría con 409 (criterio 8/14).
        const linkedProposal =
            details.linkedProposal || null;

        const canPropose =
            alert.severity === "CRITICAL" && alert.status !== "RESOLVED" && !linkedProposal;

        const canAcknowledge =
            alert.status === "OPEN";

        const canResolve =
            alert.status !== "RESOLVED";

        // Entrega 2.6.1.24, sección 6 -- "[Ver propuesta]" ahora enlaza
        // directo al detalle de la propuesta en la nueva página
        // dedicada (antes, en 2.6.1.23, enlazaba genéricamente a
        // /maturation/calibrations).
        const followUpBlock =
            linkedProposal ? `
                <div class="alert alert-secondary small py-2 px-3 mt-2 mb-0">
                    Calibración origen: v${details.calibrationVersion ?? "—"}<br>
                    Nueva propuesta: v${linkedProposal.version} <span class="badge bg-${CALIBRATION_STATUS_BADGES[linkedProposal.status] || "secondary"}">${linkedProposal.status}</span><br>
                    <a href="/maturation/recalibration-proposals?openId=${linkedProposal.id}" class="small">Ver propuesta →</a>
                </div>
            ` : "";

        return `
            <div class="alert alert-${badge} mb-0">
                <div>
                    <strong>${icon} ${alert.severity}</strong>
                    <span class="badge bg-secondary ms-2">${alert.status}</span>
                    <p class="mb-1 mt-2">${alert.severity === "CRITICAL" ? "<strong>Se recomienda recalibrar este modelo.</strong><br>" : ""}${alert.message}</p>
                    ${metricsParts.length ? `<p class="small text-muted mb-0">${metricsParts.join(" · ")}</p>` : ""}
                    ${followUpBlock}
                </div>
                <div class="mt-2">
                    ${canPropose ? `<button type="button" class="btn btn-sm btn-primary me-2" id="btnCreateRecalibrationProposal">Crear propuesta de recalibración</button>` : ""}
                    ${canAcknowledge ? `<button type="button" class="btn btn-sm btn-outline-secondary me-2" id="btnAcknowledgeAlert">Reconocer</button>` : ""}
                    ${canResolve ? `<button type="button" class="btn btn-sm btn-outline-secondary" id="btnResolveAlert">Resolver</button>` : ""}
                </div>
            </div>
        `;

    }

    wireAlertCardButtons(alert) {

        const proposeButton =
            document.getElementById("btnCreateRecalibrationProposal");

        if (proposeButton) {

            proposeButton.addEventListener("click", () => this.openRecalibrationProposalModal(alert));

        }

        const acknowledgeButton =
            document.getElementById("btnAcknowledgeAlert");

        if (acknowledgeButton) {

            acknowledgeButton.addEventListener("click", () => this.handleAcknowledgeAlert(alert.id));

        }

        const resolveButton =
            document.getElementById("btnResolveAlert");

        if (resolveButton) {

            resolveButton.addEventListener("click", () => this.handleResolveAlert(alert.id));

        }

    }

    async handleAcknowledgeAlert(id) {

        try {

            await this.alertsApi.acknowledge(id);

            await this.loadAlerts(this.modelSelect.value);

        } catch (err) {

            UI.error(err.message);

        }

    }

    async handleResolveAlert(id) {

        try {

            await this.alertsApi.resolve(id);

            await this.loadAlerts(this.modelSelect.value);

        } catch (err) {

            UI.error(err.message);

        }

    }

    /*
     * Sección 14 -- vista previa ANTES de confirmar la propuesta:
     * modelo/receta/calibración origen/offset actual/offset sugerido/
     * muestras. Todo viene ya calculado en `alert.details` (ver
     * ModelAlertService._evaluateCondition()) -- no hace falta una
     * segunda consulta solo para mostrar el modal.
     */
    openRecalibrationProposalModal(alert) {

        const details =
            alert.details || {};

        const dashboard =
            this.currentDashboard;

        const recipeLabel =
            dashboard && dashboard.model && dashboard.model.recipeVersion
                ? `${dashboard.model.recipeVersion.productName ? dashboard.model.recipeVersion.productName + " / " : ""}${dashboard.model.recipeVersion.recipeName || "Receta"} (v${dashboard.model.recipeVersion.version})`
                : `Receta #${details.recipeVersionId ?? "—"}`;

        // Entrega 2.6.1.23, sección 2 -- el mockup de confirmación de
        // esta entrega agrega Estado/MAE histórico/MAE reciente/Bias al
        // resumen de 2.6.1.21 (que solo mostraba offset/muestras) --
        // todo ya viene calculado en `details`, ninguna consulta nueva.
        this.recalibrationProposalBody.innerHTML = `
            <dl class="row mb-0">
                <dt class="col-5">Modelo</dt><dd class="col-7">${details.modelType || "—"}</dd>
                <dt class="col-5">Receta</dt><dd class="col-7">${recipeLabel}</dd>
                <dt class="col-5">Calibración actual</dt><dd class="col-7">v${details.calibrationVersion ?? "—"}</dd>
                <dt class="col-5">Estado</dt><dd class="col-7">${details.health ?? "—"}</dd>
                <dt class="col-5">MAE histórico</dt><dd class="col-7">${this.formatHours(details.maeHistorical)}</dd>
                <dt class="col-5">MAE reciente</dt><dd class="col-7">${this.formatHours(details.maeRecent)}</dd>
                <dt class="col-5">Bias</dt><dd class="col-7">${this.formatSignedHours(details.biasRecent)}</dd>
                <dt class="col-5">Muestras</dt><dd class="col-7">${details.sampleSize ?? "—"}</dd>
                <dt class="col-5">Offset actual</dt><dd class="col-7">${this.formatSignedHours(details.offsetHours)}</dd>
                <dt class="col-5">Offset sugerido</dt><dd class="col-7">${this.formatSignedHours(details.offsetSuggested)}</dd>
            </dl>
        `;

        if (this.recalibrationCreatedByInput) {

            this.recalibrationCreatedByInput.value =
                "";

        }

        this.pendingRecalibrationModelId =
            this.modelSelect.value;

        if (this.recalibrationModalElement && window.bootstrap) {

            bootstrap.Modal.getOrCreateInstance(this.recalibrationModalElement).show();

        }

    }

    /*
     * Confirma la creación -- delega en
     * POST /api/maturation/models/:modelId/recalibration-proposal
     * (ModelAlertService.createRecalibrationProposal(), que a su vez
     * reutiliza MaturationModelCalibrationService.createReplacement()
     * de 2.6.1.19). La propuesta SIEMPRE nace PROPOSED, nunca se activa
     * aquí (criterio de aceptación #21).
     */
    async handleConfirmRecalibrationProposal() {

        if (!this.pendingRecalibrationModelId) {

            return;

        }

        const userId =
            this.recalibrationCreatedByInput && this.recalibrationCreatedByInput.value.trim()
                ? this.recalibrationCreatedByInput.value.trim()
                : undefined;

        try {

            const created =
                await this.alertsApi.createRecalibrationProposal(this.pendingRecalibrationModelId, { userId });

            if (this.recalibrationModalElement && window.bootstrap) {

                bootstrap.Modal.getOrCreateInstance(this.recalibrationModalElement).hide();

            }

            // Entrega 2.6.1.23, sección 3 -- mensaje de resultado con la
            // versión/estado reales de la calibración recién creada, en
            // vez de un texto genérico.
            if (typeof UI.success === "function") {

                UI.success(`Propuesta creada correctamente. Nueva calibración: v${created.version}. Estado: ${created.status}.`);

            }

            await this.loadAlerts(this.pendingRecalibrationModelId);

        } catch (err) {

            // Entrega 2.6.1.23, secciones 4/14 -- una propuesta
            // equivalente ya existía (409): se cierra el modal de todos
            // modos (nada que confirmar) y se recarga la alerta, que ya
            // sabrá mostrar el bloque de seguimiento con la propuesta
            // existente en vez de volver a ofrecer el botón de crear.
            if (err.statusCode === 409) {

                if (this.recalibrationModalElement && window.bootstrap) {

                    bootstrap.Modal.getOrCreateInstance(this.recalibrationModalElement).hide();

                }

                UI.error(err.message);

                await this.loadAlerts(this.pendingRecalibrationModelId);

                return;

            }

            UI.error(err.message);

        }

    }

    /*
     * Sección 9: filtro "Calibración" -- se llena con la cadena de
     * versiones que el propio dashboard ya trajo (`calibrationHistory`,
     * reutilizado de 2.6.1.19), nunca con una consulta aparte.
     */
    populateCalibrationSelect(dashboard) {

        const chain =
            dashboard.calibrationHistory || [];

        const currentValue =
            this.calibrationSelect.value;

        if (chain.length === 0) {

            this.calibrationSelect.innerHTML =
                `<option value="">Sin calibraciones</option>`;

            this.calibrationSelect.disabled =
                true;

            return;

        }

        this.calibrationSelect.disabled =
            false;

        this.calibrationSelect.innerHTML =
            `<option value="">Activa actual</option>` +
            chain.map(c => `<option value="${c.id}">v${c.version} -- ${c.status} (#${c.id})</option>`).join("");

        if (currentValue && Array.from(this.calibrationSelect.options).some(o => o.value === currentValue)) {

            this.calibrationSelect.value = currentValue;

        }

    }

    render(dashboard) {

        this.renderSummary(dashboard);

        this.renderRawVsCalibrated(dashboard);

        this.renderHealthDetail(dashboard);

        this.renderTemporalChart();

        this.renderScatterChart(dashboard);

        this.renderHistogramChart(dashboard);

        this.renderCalibrationHistory(dashboard);

    }

    /*
     * Sección 1 (resumen) + sección 8 (indicador global).
     */
    renderSummary(dashboard) {

        const model =
            dashboard.model;

        const perf =
            dashboard.performance;

        const recipeVersionLabel =
            model.recipeVersion
                ? `${model.recipeVersion.productName ? model.recipeVersion.productName + " / " : ""}${model.recipeVersion.recipeName || "Receta"} (v${model.recipeVersion.version})`
                : `Receta #${model.recipeVersionId}`;

        document.getElementById("dashTitle").textContent =
            recipeVersionLabel;

        document.getElementById("dashSubtitle").textContent =
            `Modelo: ${model.type}`;

        document.getElementById("dashSampleSize").textContent =
            perf.sampleSize ?? "—";

        document.getElementById("dashMae").textContent =
            this.formatHours(perf.calibrated ? perf.calibrated.maeHours : null);

        document.getElementById("dashRmse").textContent =
            this.formatHours(perf.calibrated ? perf.calibrated.rmseHours : null);

        document.getElementById("dashBias").textContent =
            this.formatSignedHours(perf.calibrated ? perf.calibrated.biasHours : null);

        const indicatorEl =
            document.getElementById("dashIndicatorBadge");

        const indicatorMeta =
            INDICATOR_META[dashboard.indicator] || INDICATOR_META.INSUFFICIENT_DATA;

        indicatorEl.className =
            `badge fs-6 bg-${indicatorMeta.badge}`;

        indicatorEl.textContent =
            `${indicatorMeta.icon} ${dashboard.indicator}`;

        const calLabelEl =
            document.getElementById("dashCalibrationLabel");

        if (dashboard.calibration) {

            calLabelEl.innerHTML =
                `v${dashboard.calibration.version} <span class="badge bg-${CALIBRATION_STATUS_BADGES[dashboard.calibration.status] || "secondary"}">${dashboard.calibration.status}</span>`;

        } else {

            calLabelEl.textContent =
                "Sin calibración activa";

        }

        const healthEl =
            document.getElementById("dashHealthBadge");

        if (dashboard.calibration && dashboard.calibration.health) {

            const health =
                dashboard.calibration.health;

            healthEl.innerHTML =
                `<span class="badge bg-${HEALTH_BADGES[health] || "secondary"}">${health}</span>` +
                (dashboard.trend ? ` <span class="text-muted small">Tendencia: ${dashboard.trend}</span>` : "");

        } else {

            healthEl.textContent =
                "—";

        }

    }

    /*
     * Sección 2: RAW vs. CALIBRATED + mejora porcentual.
     */
    renderRawVsCalibrated(dashboard) {

        const perf =
            dashboard.performance;

        const body =
            document.getElementById("dashRawVsCalibratedBody");

        if (!perf.raw || !perf.calibrated) {

            body.innerHTML =
                `<tr><td colspan="3" class="text-muted">Todavía no hay suficientes predicciones evaluadas en el periodo seleccionado.</td></tr>`;

            document.getElementById("dashImprovementText").textContent =
                "";

            return;

        }

        body.innerHTML = `
            <tr><td>MAE</td><td class="text-end">${this.formatHours(perf.raw.maeHours)}</td><td class="text-end">${this.formatHours(perf.calibrated.maeHours)}</td></tr>
            <tr><td>RMSE</td><td class="text-end">${this.formatHours(perf.raw.rmseHours)}</td><td class="text-end">${this.formatHours(perf.calibrated.rmseHours)}</td></tr>
            <tr><td>Bias</td><td class="text-end">${this.formatSignedHours(perf.raw.biasHours)}</td><td class="text-end">${this.formatSignedHours(perf.calibrated.biasHours)}</td></tr>
        `;

        document.getElementById("dashImprovementText").innerHTML =
            `<strong>Mejora MAE:</strong> ${perf.maeImprovementPercentage !== null ? perf.maeImprovementPercentage + "%" : "—"} (${perf.maeImprovementHours !== null ? perf.maeImprovementHours + " h" : "—"})`;

    }

    /*
     * Sección 6: histórico vs. reciente de la calibración objetivo +
     * tarjeta DEGRADED con recomendación cuando aplica.
     */
    renderHealthDetail(dashboard) {

        const container =
            document.getElementById("dashHealthDetail");

        const cal =
            dashboard.calibration;

        if (!cal) {

            container.innerHTML =
                `<p class="text-muted mb-0">Este modelo/receta nunca tuvo una calibración activa.</p>`;

            return;

        }

        const degradedBlock =
            cal.health === "DEGRADED"
                ? `
                    <div class="alert alert-danger small py-2 px-3 mt-2 mb-0">
                        ⚠ DEGRADED<br>
                        MAE reciente: ${this.formatHours(cal.recent ? cal.recent.maeHours : null)}<br>
                        MAE histórico: ${this.formatHours(cal.historical ? cal.historical.maeHours : null)}<br>
                        ${cal.recommendRecalibration ? "<strong>Recomendación:</strong> Revisar calibración" : ""}
                    </div>
                `
                : "";

        container.innerHTML = `
            <table class="table table-sm mb-2">
                <thead><tr><th></th><th class="text-end">Histórico</th><th class="text-end">Reciente</th></tr></thead>
                <tbody>
                    <tr><td>MAE</td><td class="text-end">${this.formatHours(cal.historical ? cal.historical.maeHours : null)}</td><td class="text-end">${this.formatHours(cal.recent ? cal.recent.maeHours : null)}</td></tr>
                    <tr><td>Bias</td><td class="text-end">${this.formatSignedHours(cal.historical ? cal.historical.biasHours : null)}</td><td class="text-end">${this.formatSignedHours(cal.recent ? cal.recent.biasHours : null)}</td></tr>
                </tbody>
            </table>
            ${degradedBlock}
        `;

    }

    /*
     * Sección 3: evolución temporal -- ventana móvil calculada aquí
     * SOLO para la gráfica (nunca sustituye a las métricas oficiales
     * de la sección 1, que siempre vienen del backend).
     */
    renderTemporalChart() {

        if (!this.currentDashboard) {

            return;

        }

        const history =
            this.currentDashboard.predictionHistory || [];

        const canvas =
            document.getElementById("dashTemporalChart");

        const messageEl =
            document.getElementById("dashTemporalMessage");

        if (this.charts.temporal) {

            this.charts.temporal.destroy();

            this.charts.temporal = null;

        }

        if (!canvas) {

            return;

        }

        if (history.length === 0) {

            canvas.style.display = "none";

            messageEl.style.display = "block";

            messageEl.textContent =
                "Todavía no hay predicciones evaluadas en el periodo seleccionado.";

            return;

        }

        canvas.style.display = "block";

        messageEl.style.display = "none";

        const metric =
            this.temporalMetricSelect.value;

        const labels =
            history.map((p, i) => p.batchNumber || `#${i + 1}`);

        const errors =
            history.map(p => p.calibratedErrorHours);

        let data;

        let label;

        if (metric === "mae") {

            data = rollingSeries(errors, TEMPORAL_ROLLING_WINDOW, rollingMAE).map(round2);

            label = `MAE (ventana ${TEMPORAL_ROLLING_WINDOW} lotes)`;

        } else if (metric === "rmse") {

            data = rollingSeries(errors, TEMPORAL_ROLLING_WINDOW, rollingRMSE).map(round2);

            label = `RMSE (ventana ${TEMPORAL_ROLLING_WINDOW} lotes)`;

        } else if (metric === "bias") {

            data = rollingSeries(errors, TEMPORAL_ROLLING_WINDOW, rollingBias).map(round2);

            label = `Bias (ventana ${TEMPORAL_ROLLING_WINDOW} lotes)`;

        } else {

            data = history.map(p => round2(p.calibratedAbsoluteErrorHours));

            label = "Error absoluto";

        }

        this.charts.temporal = new Chart(canvas.getContext("2d"), {

            type: "line",

            data: {

                labels,

                datasets: [{

                    label,

                    data,

                    borderColor: "#0d6efd",

                    backgroundColor: "rgba(13,110,253,0.1)",

                    tension: 0.2,

                    pointRadius: 3

                }]

            },

            options: {

                scales: { y: { title: { display: true, text: "Horas" } } },

                plugins: { legend: { display: false } }

            }

        });

    }

    /*
     * Sección 4: predicción vs. resultado real -- duración predicha vs.
     * duración real (ambas medidas desde `predictedAt`, mismo anclaje
     * que 2.6.1.12/2.6.1.13), con una diagonal de referencia
     * "Real = Predicción".
     */
    renderScatterChart(dashboard) {

        const history =
            dashboard.predictionHistory || [];

        const canvas =
            document.getElementById("dashScatterChart");

        const messageEl =
            document.getElementById("dashScatterMessage");

        if (this.charts.scatter) {

            this.charts.scatter.destroy();

            this.charts.scatter = null;

        }

        if (!canvas) {

            return;

        }

        const points =
            history.map(p => {

                const predictedDurationHours =
                    (new Date(p.predictedMaturationAt).getTime() - new Date(p.predictedAt).getTime()) / 3600000;

                const actualDurationHours =
                    (new Date(p.actualMaturationAt).getTime() - new Date(p.predictedAt).getTime()) / 3600000;

                return { x: round2(predictedDurationHours), y: round2(actualDurationHours) };

            }).filter(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y));

        if (points.length === 0) {

            canvas.style.display = "none";

            messageEl.style.display = "block";

            messageEl.textContent =
                "Todavía no hay predicciones evaluadas para graficar.";

            return;

        }

        canvas.style.display = "block";

        messageEl.style.display = "none";

        const allValues =
            points.flatMap(p => [p.x, p.y]);

        const min =
            Math.min(...allValues);

        const max =
            Math.max(...allValues);

        this.charts.scatter = new Chart(canvas.getContext("2d"), {

            type: "scatter",

            data: {

                datasets: [

                    { label: "Predicción vs. real", data: points, backgroundColor: "#0d6efd", pointRadius: 5 },

                    { label: "Real = Predicción", data: [{ x: min, y: min }, { x: max, y: max }], type: "line", borderColor: "#adb5bd", borderDash: [6, 4], pointRadius: 0, fill: false }

                ]

            },

            options: {

                scales: {

                    x: { title: { display: true, text: "Predicción (h)" } },

                    y: { title: { display: true, text: "Real (h)" } }

                },

                plugins: { legend: { display: true } }

            }

        });

    }

    /*
     * Sección 5: distribución del error (histograma de bins fijos).
     */
    renderHistogramChart(dashboard) {

        const history =
            dashboard.predictionHistory || [];

        const canvas =
            document.getElementById("dashHistogramChart");

        const messageEl =
            document.getElementById("dashHistogramMessage");

        if (this.charts.histogram) {

            this.charts.histogram.destroy();

            this.charts.histogram = null;

        }

        if (!canvas) {

            return;

        }

        if (history.length === 0) {

            canvas.style.display = "none";

            messageEl.style.display = "block";

            messageEl.textContent =
                "Todavía no hay predicciones evaluadas para graficar.";

            return;

        }

        canvas.style.display = "block";

        messageEl.style.display = "none";

        const bins =
            buildErrorHistogramBins(history.map(p => p.calibratedErrorHours));

        this.charts.histogram = new Chart(canvas.getContext("2d"), {

            type: "bar",

            data: {

                labels: bins.map(b => b.label),

                datasets: [{ label: "Predicciones", data: bins.map(b => b.count), backgroundColor: "#6f42c1" }]

            },

            options: {

                scales: { y: { title: { display: true, text: "Predicciones" }, ticks: { precision: 0 } } },

                plugins: { legend: { display: false } }

            }

        });

    }

    /*
     * Sección 7: historial de calibraciones, reutilizando
     * `calibrationHistory` (2.6.1.19).
     */
    renderCalibrationHistory(dashboard) {

        const body =
            document.getElementById("dashCalibrationHistoryBody");

        const history =
            dashboard.calibrationHistory || [];

        if (history.length === 0) {

            body.innerHTML =
                `<tr><td colspan="9" class="text-muted">Este modelo/receta nunca tuvo una calibración.</td></tr>`;

            return;

        }

        body.innerHTML =
            history.map(c => `
                <tr class="${c.status === "ACTIVE" ? "table-success" : ""}">
                    <td>v${c.version}</td>
                    <td>${this.formatDate(c.activatedAt)}</td>
                    <td>${this.formatDate(c.deactivatedAt)}</td>
                    <td>${this.formatSignedHours(c.offsetHours)}</td>
                    <td>${c.sampleSize ?? "—"}</td>
                    <td>${this.formatHours(c.maeHours)}</td>
                    <td>${this.formatHours(c.rmseHours)}</td>
                    <td>${this.formatSignedHours(c.biasHours)}</td>
                    <td><span class="badge bg-${CALIBRATION_STATUS_BADGES[c.status] || "secondary"}">${c.status}</span></td>
                </tr>
            `).join("");

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        window.maturationDashboardPage =
            new MaturationDashboardPage();

        window.maturationDashboardPage.init();

    }

);
