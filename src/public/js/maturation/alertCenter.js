/*
 * Página "Centro de alertas" (Entrega 2.6.1.22).
 *
 * Vista global de solo lectura + acciones explícitas ya existentes
 * desde 2.6.1.21 (reconocer/resolver) -- nunca modifica modelos ni
 * activa calibraciones (sección 9, criterios 16/17). Todo el contenido
 * viene de GET /api/maturation/alerts, GET /api/maturation/alerts/
 * summary y GET /api/maturation/alerts/:id.
 */

const ALERT_SEVERITY_BADGES = {

    CRITICAL: "danger",

    WARNING: "warning",

    INSUFFICIENT_DATA: "secondary"

};

const ALERT_SEVERITY_ICONS = {

    CRITICAL: "🔴",

    WARNING: "🟡",

    INSUFFICIENT_DATA: "⚪"

};

const ALERT_STATUS_BADGES = {

    OPEN: "danger",

    ACKNOWLEDGED: "warning",

    RESOLVED: "secondary"

};

class MaturationAlertCenterPage {

    constructor() {

        this.api =
            new MaturationAlertCenterApi();

        this.productSelect =
            document.getElementById("acFilterProduct");

        this.recipeVersionSelect =
            document.getElementById("acFilterRecipeVersion");

        this.modelSelect =
            document.getElementById("acFilterModel");

        this.severitySelect =
            document.getElementById("acFilterSeverity");

        this.statusSelect =
            document.getElementById("acFilterStatus");

        this.fromInput =
            document.getElementById("acFilterFrom");

        this.toInput =
            document.getElementById("acFilterTo");

        this.clearButton =
            document.getElementById("btnClearFilters");

        this.tableBody =
            document.getElementById("acAlertsTableBody");

        this.loader =
            document.getElementById("acLoader");

        this.detailModalElement =
            document.getElementById("modalAlertDetail");

        this.detailTitle =
            document.getElementById("modalAlertDetailTitle");

        this.detailBody =
            document.getElementById("acAlertDetailBody");

        this.detailFooter =
            document.getElementById("acAlertDetailFooter");

        // Entrega 2.6.1.23 -- confirmación de propuesta de recalibración
        // (mismo mecanismo que el dashboard desde 2.6.1.21, ahora
        // también disponible desde el Centro de Alertas).
        this.recalibrationModalElement =
            document.getElementById("modalAcRecalibrationProposal");

        this.recalibrationProposalBody =
            document.getElementById("acRecalibrationProposalBody");

        this.recalibrationCreatedByInput =
            document.getElementById("acRecalibrationCreatedBy");

        this.confirmRecalibrationButton =
            document.getElementById("btnConfirmAcRecalibrationProposal");

        this.currentAlert =
            null;

        this.pendingRecalibrationModelId =
            null;

        if (this.confirmRecalibrationButton) {

            this.confirmRecalibrationButton.addEventListener("click", () => this.handleConfirmRecalibrationProposal());

        }

        // Sección 2 -- el filtro de "Modelo" no tiene un catálogo propio
        // en este proyecto (no existe un "listar todos los modelos de
        // todos los productos" fuera de este contexto); se construye
        // acumulando los modelos que van apareciendo en los resultados,
        // sin perder los ya vistos al acotar por otros filtros.
        this.knownModels =
            [];

        [this.productSelect, this.recipeVersionSelect, this.modelSelect, this.severitySelect, this.statusSelect].forEach(select => {

            if (select) {

                select.addEventListener("change", () => this.load());

            }

        });

        [this.fromInput, this.toInput].forEach(input => {

            if (input) {

                input.addEventListener("change", () => this.load());

            }

        });

        if (this.clearButton) {

            this.clearButton.addEventListener("click", () => this.clearFilters());

        }

        this.load();

    }

    /*
     * Entrega 2.6.1.24, sección 6 -- "[Ver alerta origen]" desde una
     * propuesta de recalibración: `?openAlertId=X` abre directamente el
     * detalle de esa alerta, simétrico a `?openId=` en la página de
     * propuestas.
     */
    async init() {

        const params =
            new URLSearchParams(window.location.search);

        const openAlertId =
            params.get("openAlertId");

        if (openAlertId) {

            await this.openDetail(openAlertId);

        }

    }

    formatDate(value) {

        return value ? new Date(value).toLocaleString() : "—";

    }

    formatSignedHours(value) {

        if (value === null || value === undefined) {

            return "—";

        }

        const sign =
            value > 0 ? "+" : "";

        return `${sign}${value} h`;

    }

    currentFilters() {

        return {

            productId: this.productSelect.value || undefined,

            recipeVersionId: this.recipeVersionSelect.value || undefined,

            modelId: this.modelSelect.value || undefined,

            severity: this.severitySelect.value || undefined,

            status: this.statusSelect.value || undefined,

            from: this.fromInput.value || undefined,

            to: this.toInput.value || undefined

        };

    }

    clearFilters() {

        this.productSelect.value = "";

        this.recipeVersionSelect.value = "";

        this.modelSelect.value = "";

        this.severitySelect.value = "";

        this.statusSelect.value = "";

        this.fromInput.value = "";

        this.toInput.value = "";

        this.load();

    }

    async load() {

        if (this.loader) {

            this.loader.style.display = "";

        }

        try {

            const filters =
                this.currentFilters();

            const [summary, alerts] =
                await Promise.all([

                    this.api.summary(filters),

                    this.api.list(filters)

                ]);

            this.renderSummary(summary);

            this.updateModelFilterOptions(alerts);

            this.renderTable(alerts);

        } catch (err) {

            UI.error(err.message);

        } finally {

            if (this.loader) {

                this.loader.style.display = "none";

            }

        }

    }

    /*
     * Sección 1 -- resumen 🔴/🟡/🔵/⚪. `open`/`acknowledged`/
     * `resolved` son conteos de filas (historial); `bySeverity` es la
     * condición EN VIVO de cada modelo ahora mismo (ver
     * ModelAlertService.getSummary() -- "info" nunca viene de una fila
     * persistida, 2.6.1.21).
     */
    renderSummary(summary) {

        const bySeverity =
            summary.bySeverity || {};

        document.getElementById("acSummaryCritical").textContent =
            bySeverity.critical ?? 0;

        document.getElementById("acSummaryWarning").textContent =
            bySeverity.warning ?? 0;

        document.getElementById("acSummaryInfo").textContent =
            bySeverity.info ?? 0;

        document.getElementById("acSummaryInsufficientData").textContent =
            bySeverity.insufficientData ?? 0;

        document.getElementById("acSummaryStatusText").textContent =
            `${summary.open ?? 0} abiertas · ${summary.acknowledged ?? 0} reconocidas · ${summary.resolved ?? 0} resueltas`;

    }

    updateModelFilterOptions(alerts) {

        const currentValue =
            this.modelSelect.value;

        const seen =
            new Set(this.knownModels.map(m => m.id));

        (alerts || []).forEach(a => {

            if (a.model && !seen.has(a.model.id)) {

                seen.add(a.model.id);

                const recipeLabel =
                    a.recipe ? `${a.product ? a.product.name + " / " : ""}${a.recipe.name}${a.recipeVersion ? " (v" + a.recipeVersion.version + ")" : ""}` : `Modelo #${a.model.id}`;

                this.knownModels.push({

                    id: a.model.id,

                    label: `${a.model.type} — ${recipeLabel}`

                });

            }

        });

        this.modelSelect.innerHTML =
            `<option value="">Todos</option>` +
            this.knownModels.map(m => `<option value="${m.id}">${m.label}</option>`).join("");

        if (currentValue && this.knownModels.some(m => String(m.id) === currentValue)) {

            this.modelSelect.value = currentValue;

        }

    }

    /*
     * Sección 3 -- tabla: Fecha/Producto/Modelo/Severidad/Tipo/Estado/
     * Calibración + [Ver].
     */
    renderTable(alerts) {

        if (!alerts || alerts.length === 0) {

            this.tableBody.innerHTML =
                `<tr><td colspan="8" class="text-muted">No hay alertas que coincidan con los filtros seleccionados.</td></tr>`;

            return;

        }

        this.tableBody.innerHTML =
            alerts.map(a => `
                <tr>
                    <td>${this.formatDate(a.createdAt)}</td>
                    <td>${a.product ? a.product.name : "—"}</td>
                    <td>${a.model ? a.model.type : "—"}</td>
                    <td><span class="badge bg-${ALERT_SEVERITY_BADGES[a.severity] || "secondary"}">${ALERT_SEVERITY_ICONS[a.severity] || ""} ${a.severity}</span></td>
                    <td>${a.type || "—"}</td>
                    <td><span class="badge bg-${ALERT_STATUS_BADGES[a.status] || "secondary"}">${a.status}</span></td>
                    <td>${a.calibration ? "v" + a.calibration.version : "—"}</td>
                    <td><button type="button" class="btn btn-sm btn-outline-primary" data-alert-id="${a.id}">Ver</button></td>
                </tr>
            `).join("");

        this.tableBody.querySelectorAll("button[data-alert-id]").forEach(button => {

            button.addEventListener("click", () => this.openDetail(button.getAttribute("data-alert-id")));

        });

    }

    async openDetail(id) {

        this.detailBody.innerHTML =
            `<p class="text-muted mb-0">Cargando...</p>`;

        this.detailFooter.innerHTML =
            "";

        if (this.detailModalElement && window.bootstrap) {

            bootstrap.Modal.getOrCreateInstance(this.detailModalElement).show();

        }

        try {

            const alert =
                await this.api.detail(id);

            this.renderDetail(alert);

        } catch (err) {

            this.detailBody.innerHTML =
                `<p class="text-danger mb-0">${err.message}</p>`;

        }

    }

    /*
     * Sección 4/6/7 -- motivo + métricas (de `details`, sección 7) +
     * calibración relacionada de SOLO LECTURA (sección 7: nunca se
     * ofrece ningún medio de modificarla desde aquí) + navegación al
     * dashboard del modelo (sección 6, conservando modelo/receta).
     */
    renderDetail(alert) {

        this.currentAlert =
            alert;

        const details =
            alert.details || {};

        const recipeLabel =
            alert.recipe
                ? `${alert.recipe.name}${alert.recipeVersion ? " v" + alert.recipeVersion.version : ""}`
                : "—";

        const metricsRows =
            [];

        if (details.maeHistorical !== undefined && details.maeHistorical !== null) {

            metricsRows.push(`<tr><td>MAE histórico</td><td class="text-end">${details.maeHistorical} h</td></tr>`);

        }

        if (details.maeRecent !== undefined && details.maeRecent !== null) {

            metricsRows.push(`<tr><td>MAE reciente</td><td class="text-end">${details.maeRecent} h</td></tr>`);

        }

        if (details.biasRecent !== undefined && details.biasRecent !== null) {

            metricsRows.push(`<tr><td>Bias</td><td class="text-end">${this.formatSignedHours(details.biasRecent)}</td></tr>`);

        }

        if (details.health) {

            metricsRows.push(`<tr><td>Health</td><td class="text-end">${details.health}</td></tr>`);

        }

        if (details.trend) {

            metricsRows.push(`<tr><td>Trend</td><td class="text-end">${details.trend}</td></tr>`);

        }

        const calibrationBlock =
            alert.calibration
                ? `
                    <p class="fw-bold mb-1 mt-3">Calibración relacionada (solo lectura)</p>
                    <table class="table table-sm mb-0">
                        <tbody>
                            <tr><td>Versión</td><td class="text-end">v${alert.calibration.version}</td></tr>
                            <tr><td>Estado</td><td class="text-end"><span class="badge bg-secondary">${alert.calibration.status}</span></td></tr>
                            <tr><td>Fecha de activación</td><td class="text-end">${this.formatDate(alert.calibration.activatedAt)}</td></tr>
                            <tr><td>Calibración origen</td><td class="text-end">${alert.calibration.parentCalibrationVersion ? "v" + alert.calibration.parentCalibrationVersion : "—"}</td></tr>
                            <tr><td>Offset</td><td class="text-end">${this.formatSignedHours(alert.calibration.offsetHours)}</td></tr>
                        </tbody>
                    </table>
                `
                : `<p class="text-muted small mt-3 mb-0">Esta alerta no tiene ninguna calibración asociada.</p>`;

        // Entrega 2.6.1.23, sección 5 -- seguimiento: si esta alerta ya
        // tiene una propuesta PROPOSED vinculada (ver `details.
        // linkedProposal`, calculado por ModelAlertService cada vez que
        // se refresca la detección), se muestra aquí en vez de invitar
        // a crear una segunda.
        const linkedProposal =
            details.linkedProposal || null;

        // Entrega 2.6.1.24, sección 6 -- enlace directo al detalle de la
        // propuesta (antes, en 2.6.1.23, enlazaba genéricamente a
        // /maturation/calibrations).
        const followUpBlock =
            linkedProposal ? `
                <div class="alert alert-secondary small py-2 px-3 mt-3 mb-0">
                    <p class="fw-bold mb-1">Seguimiento</p>
                    Calibración origen: v${details.calibrationVersion ?? (alert.calibration ? alert.calibration.version : "—")}<br>
                    Nueva propuesta: v${linkedProposal.version} <span class="badge bg-secondary">${linkedProposal.status}</span><br>
                    <a href="/maturation/recalibration-proposals?openId=${linkedProposal.id}" class="small">Ver propuesta →</a>
                </div>
            ` : "";

        this.detailTitle.textContent =
            `Alerta ${alert.severity}`;

        this.detailBody.innerHTML = `
            <dl class="row mb-3">
                <dt class="col-4">Modelo</dt><dd class="col-8">${alert.model ? alert.model.type : "—"}</dd>
                <dt class="col-4">Producto</dt><dd class="col-8">${alert.product ? alert.product.name : "—"}</dd>
                <dt class="col-4">Receta</dt><dd class="col-8">${recipeLabel}</dd>
                <dt class="col-4">Calibración</dt><dd class="col-8">${alert.calibration ? "v" + alert.calibration.version : "—"}</dd>
                <dt class="col-4">Estado</dt><dd class="col-8"><span class="badge bg-${ALERT_STATUS_BADGES[alert.status] || "secondary"}">${alert.status}</span></dd>
                <dt class="col-4">Creada</dt><dd class="col-8">${this.formatDate(alert.createdAt)}</dd>
            </dl>
            <p class="fw-bold mb-1">Motivo</p>
            <p>${alert.message}</p>
            ${metricsRows.length ? `<table class="table table-sm mb-0"><tbody>${metricsRows.join("")}</tbody></table>` : ""}
            ${calibrationBlock}
            ${followUpBlock}
        `;

        const footerParts =
            [];

        // Entrega 2.6.1.23, secciones 1/4 -- extiende el Centro de
        // Alertas con la acción operativa que antes solo vivía en el
        // dashboard: una alerta CRITICAL, todavía no resuelta y sin una
        // propuesta ya vinculada, puede generar una propuesta de
        // recalibración desde aquí mismo.
        if (alert.severity === "CRITICAL" && alert.status !== "RESOLVED" && !linkedProposal) {

            footerParts.push(`<button type="button" class="btn btn-primary" id="btnDetailCreateRecalibrationProposal">Crear propuesta de recalibración</button>`);

        }

        if (alert.model) {

            const params =
                new URLSearchParams();

            params.set("modelId", alert.model.id);

            if (alert.recipeVersion) {

                params.set("recipeVersionId", alert.recipeVersion.id);

            }

            footerParts.push(`<a href="/maturation/dashboard?${params.toString()}" class="btn btn-outline-primary">Ver desempeño del modelo</a>`);

        }

        // Sección 5: OPEN -> [Reconocer][Resolver]; ACKNOWLEDGED ->
        // [Resolver]; RESOLVED -> sin acciones operativas.
        if (alert.status === "OPEN") {

            footerParts.push(`<button type="button" class="btn btn-outline-secondary" id="btnDetailAcknowledge">Reconocer</button>`);

            footerParts.push(`<button type="button" class="btn btn-outline-secondary" id="btnDetailResolve">Resolver</button>`);

        } else if (alert.status === "ACKNOWLEDGED") {

            footerParts.push(`<button type="button" class="btn btn-outline-secondary" id="btnDetailResolve">Resolver</button>`);

        }

        this.detailFooter.innerHTML =
            footerParts.join(" ");

        const proposeButton =
            document.getElementById("btnDetailCreateRecalibrationProposal");

        if (proposeButton) {

            proposeButton.addEventListener("click", () => this.openRecalibrationProposalModal(alert));

        }

        const acknowledgeButton =
            document.getElementById("btnDetailAcknowledge");

        if (acknowledgeButton) {

            acknowledgeButton.addEventListener("click", () => this.handleDetailAcknowledge(alert.id));

        }

        const resolveButton =
            document.getElementById("btnDetailResolve");

        if (resolveButton) {

            resolveButton.addEventListener("click", () => this.handleDetailResolve(alert.id));

        }

    }

    /*
     * Entrega 2.6.1.23, sección 2 -- vista previa antes de confirmar,
     * con Modelo/Producto/Receta/Calibración actual/Estado/MAE
     * histórico/MAE reciente/Bias/Muestras, todo ya disponible en
     * `alert.details` (ver ModelAlertService._evaluateCondition()) --
     * ninguna consulta adicional.
     */
    openRecalibrationProposalModal(alert) {

        const details =
            alert.details || {};

        const recipeLabel =
            alert.recipe
                ? `${alert.product ? alert.product.name + " / " : ""}${alert.recipe.name}${alert.recipeVersion ? " (v" + alert.recipeVersion.version + ")" : ""}`
                : "—";

        this.recalibrationProposalBody.innerHTML = `
            <dl class="row mb-0">
                <dt class="col-5">Modelo</dt><dd class="col-7">${alert.model ? alert.model.type : "—"}</dd>
                <dt class="col-5">Receta</dt><dd class="col-7">${recipeLabel}</dd>
                <dt class="col-5">Calibración actual</dt><dd class="col-7">v${details.calibrationVersion ?? (alert.calibration ? alert.calibration.version : "—")}</dd>
                <dt class="col-5">Estado</dt><dd class="col-7">${details.health ?? "—"}</dd>
                <dt class="col-5">MAE histórico</dt><dd class="col-7">${details.maeHistorical !== undefined && details.maeHistorical !== null ? details.maeHistorical + " h" : "—"}</dd>
                <dt class="col-5">MAE reciente</dt><dd class="col-7">${details.maeRecent !== undefined && details.maeRecent !== null ? details.maeRecent + " h" : "—"}</dd>
                <dt class="col-5">Bias</dt><dd class="col-7">${this.formatSignedHours(details.biasRecent)}</dd>
                <dt class="col-5">Muestras</dt><dd class="col-7">${details.sampleSize ?? "—"}</dd>
            </dl>
        `;

        if (this.recalibrationCreatedByInput) {

            this.recalibrationCreatedByInput.value =
                "";

        }

        this.pendingRecalibrationModelId =
            alert.model ? alert.model.id : null;

        if (this.recalibrationModalElement && window.bootstrap) {

            bootstrap.Modal.getOrCreateInstance(this.recalibrationModalElement).show();

        }

    }

    /*
     * Confirma la creación -- mismo endpoint que el dashboard (2.6.1.21/
     * 2.6.1.23), la propuesta SIEMPRE nace PROPOSED. Un 409 (ya existía
     * una propuesta equivalente, secciones 4/14) cierra el modal igual
     * y recarga el detalle, que pasará a mostrar el bloque de
     * seguimiento en vez del botón de crear.
     */
    async handleConfirmRecalibrationProposal() {

        if (!this.pendingRecalibrationModelId) {

            return;

        }

        const userId =
            this.recalibrationCreatedByInput && this.recalibrationCreatedByInput.value.trim()
                ? this.recalibrationCreatedByInput.value.trim()
                : undefined;

        const alertId =
            this.currentAlert ? this.currentAlert.id : null;

        try {

            const created =
                await this.api.createRecalibrationProposal(this.pendingRecalibrationModelId, { userId });

            if (this.recalibrationModalElement && window.bootstrap) {

                bootstrap.Modal.getOrCreateInstance(this.recalibrationModalElement).hide();

            }

            if (typeof UI.success === "function") {

                UI.success(`Propuesta creada correctamente. Nueva calibración: v${created.version}. Estado: ${created.status}.`);

            }

            if (alertId) {

                await this.openDetail(alertId);

            }

            await this.load();

        } catch (err) {

            if (err.statusCode === 409) {

                if (this.recalibrationModalElement && window.bootstrap) {

                    bootstrap.Modal.getOrCreateInstance(this.recalibrationModalElement).hide();

                }

                UI.error(err.message);

                if (alertId) {

                    await this.openDetail(alertId);

                }

                await this.load();

                return;

            }

            UI.error(err.message);

        }

    }

    async handleDetailAcknowledge(id) {

        try {

            await this.api.acknowledge(id);

            await this.openDetail(id);

            await this.load();

        } catch (err) {

            UI.error(err.message);

        }

    }

    async handleDetailResolve(id) {

        try {

            await this.api.resolve(id);

            await this.openDetail(id);

            await this.load();

        } catch (err) {

            UI.error(err.message);

        }

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        window.maturationAlertCenterPage =
            new MaturationAlertCenterPage();

        window.maturationAlertCenterPage.init();

    }

);
