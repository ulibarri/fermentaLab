/*
 * Página "Propuestas de recalibración" (Entrega 2.6.1.24).
 *
 * Completa el flujo de revisión humana: listar/filtrar/consultar el
 * detalle de una propuesta (siempre derivada de una alerta -- ver
 * RecalibrationProposalService), compararla contra la calibración
 * actual, y aprobarla/rechazarla. NUNCA activa ninguna calibración
 * (sección 13) -- eso queda para la Entrega 2.6.1.25.
 */

const PROPOSAL_STATUS_BADGES = {

    PROPOSED: "secondary",

    APPROVED: "info",

    // Entrega 2.6.1.25 -- una propuesta ahora también puede llegar a
    // ACTIVE/INACTIVE.
    ACTIVE: "success",

    INACTIVE: "dark",

    REJECTED: "danger"

};

class MaturationRecalibrationProposalsPage {

    constructor() {

        this.api =
            new MaturationRecalibrationProposalsApi();

        this.modelSelect =
            document.getElementById("rpFilterModel");

        this.productSelect =
            document.getElementById("rpFilterProduct");

        this.statusSelect =
            document.getElementById("rpFilterStatus");

        this.createdByInput =
            document.getElementById("rpFilterCreatedBy");

        this.fromInput =
            document.getElementById("rpFilterFrom");

        this.toInput =
            document.getElementById("rpFilterTo");

        this.clearButton =
            document.getElementById("btnRpClearFilters");

        this.tableBody =
            document.getElementById("rpTableBody");

        this.loader =
            document.getElementById("rpLoader");

        this.detailModalElement =
            document.getElementById("modalProposalDetail");

        this.detailBody =
            document.getElementById("rpDetailBody");

        this.detailFooter =
            document.getElementById("rpDetailFooter");

        this.approveModalElement =
            document.getElementById("modalApproveProposal");

        this.approveUserIdInput =
            document.getElementById("rpApproveUserId");

        this.confirmApproveButton =
            document.getElementById("btnConfirmApproveProposal");

        this.rejectModalElement =
            document.getElementById("modalRejectProposal");

        this.rejectReasonInput =
            document.getElementById("rpRejectReason");

        this.rejectReasonError =
            document.getElementById("rpRejectReasonError");

        this.rejectUserIdInput =
            document.getElementById("rpRejectUserId");

        this.confirmRejectButton =
            document.getElementById("btnConfirmRejectProposal");

        // Entrega 2.6.1.25 -- confirmación de activación.
        this.activateModalElement =
            document.getElementById("modalActivateProposal");

        this.activateUserIdInput =
            document.getElementById("rpActivateUserId");

        this.confirmActivateButton =
            document.getElementById("btnConfirmActivateProposal");

        this.currentProposal =
            null;

        [this.modelSelect, this.productSelect, this.statusSelect].forEach(select => {

            if (select) {

                select.addEventListener("change", () => this.load());

            }

        });

        [this.createdByInput].forEach(input => {

            if (input) {

                input.addEventListener("change", () => this.load());

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

        if (this.confirmApproveButton) {

            this.confirmApproveButton.addEventListener("click", () => this.handleConfirmApprove());

        }

        if (this.confirmRejectButton) {

            this.confirmRejectButton.addEventListener("click", () => this.handleConfirmReject());

        }

        if (this.confirmActivateButton) {

            this.confirmActivateButton.addEventListener("click", () => this.handleConfirmActivate());

        }

        this.load();

    }

    /*
     * Sección 6 -- deep-link desde "[Ver propuesta]" en una alerta
     * (2.6.1.23/24): `?openId=X` abre directamente el detalle de esa
     * propuesta, igual que `?openAlertId=` en el centro de alertas
     * permite lo simétrico desde acá.
     */
    async init() {

        const params =
            new URLSearchParams(window.location.search);

        const openId =
            params.get("openId");

        if (openId) {

            await this.openDetail(openId);

        }

    }

    formatDate(value) {

        return value ? new Date(value).toLocaleString() : "—";

    }

    formatDateOnly(value) {

        return value ? new Date(value).toLocaleDateString() : "—";

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

    currentFilters() {

        return {

            modelType: this.modelSelect.value || undefined,

            productId: this.productSelect.value || undefined,

            status: this.statusSelect.value || undefined,

            createdBy: this.createdByInput.value.trim() || undefined,

            from: this.fromInput.value || undefined,

            to: this.toInput.value || undefined

        };

    }

    clearFilters() {

        this.modelSelect.value = "";

        this.productSelect.value = "";

        this.statusSelect.value = "";

        this.createdByInput.value = "";

        this.fromInput.value = "";

        this.toInput.value = "";

        this.load();

    }

    async load() {

        if (this.loader) {

            this.loader.style.display = "";

        }

        try {

            const proposals =
                await this.api.list(this.currentFilters());

            this.renderTable(proposals);

        } catch (err) {

            UI.error(err.message);

        } finally {

            if (this.loader) {

                this.loader.style.display = "none";

            }

        }

    }

    /*
     * Sección 2 -- Fecha/Modelo/Producto/Receta/Calibración origen/
     * Propuesta/Estado/Creada por + [Ver].
     */
    renderTable(proposals) {

        if (!proposals || proposals.length === 0) {

            this.tableBody.innerHTML =
                `<tr><td colspan="9" class="text-muted">No hay propuestas que coincidan con los filtros seleccionados.</td></tr>`;

            return;

        }

        this.tableBody.innerHTML =
            proposals.map(p => `
                <tr>
                    <td>${this.formatDate(p.createdAt)}</td>
                    <td>${p.modelType || "—"}</td>
                    <td>${p.product ? p.product.name : "—"}</td>
                    <td>${p.recipe ? p.recipe.name : "—"}${p.recipeVersion ? " v" + p.recipeVersion.version : ""}</td>
                    <td>${p.sourceCalibration ? "v" + p.sourceCalibration.version : "—"}</td>
                    <td>v${p.proposedVersion}</td>
                    <td><span class="badge bg-${PROPOSAL_STATUS_BADGES[p.status] || "secondary"}">${p.status}</span></td>
                    <td>${p.createdBy || "—"}</td>
                    <td><button type="button" class="btn btn-sm btn-outline-primary" data-proposal-id="${p.id}">Ver</button></td>
                </tr>
            `).join("");

        this.tableBody.querySelectorAll("button[data-proposal-id]").forEach(button => {

            button.addEventListener("click", () => this.openDetail(button.getAttribute("data-proposal-id")));

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

            const proposal =
                await this.api.detail(id);

            this.renderDetail(proposal);

        } catch (err) {

            this.detailBody.innerHTML =
                `<p class="text-danger mb-0">${err.message}</p>`;

        }

    }

    /*
     * Sección 4/5/6 -- resumen (modelo/producto/receta/calibración
     * actual/propuesta/estado/creada por/fecha), comparación ACTUAL vs.
     * PROPUESTA (sección 5) y enlace a la alerta origen (sección 6).
     */
    renderDetail(proposal) {

        this.currentProposal =
            proposal;

        const recipeLabel =
            proposal.recipe
                ? `${proposal.product ? proposal.product.name + " / " : ""}${proposal.recipe.name}${proposal.recipeVersion ? " (v" + proposal.recipeVersion.version + ")" : ""}`
                : "—";

        const comparisonBlock =
            this.buildComparisonHtml(proposal.comparison);

        const alertBlock =
            proposal.originAlert ? `
                <p class="fw-bold mb-1 mt-3">Alerta origen</p>
                <p class="mb-1">Alerta #${proposal.originAlert.id} -- <span class="badge bg-${proposal.originAlert.severity === "CRITICAL" ? "danger" : "warning"}">${proposal.originAlert.severity}</span> (${proposal.originAlert.status})</p>
                <a href="/maturation/alerts?openAlertId=${proposal.originAlert.id}" class="btn btn-sm btn-outline-secondary">Ver alerta origen</a>
            ` : `<p class="text-muted small mt-3 mb-0">No se encontró la alerta que originó esta propuesta.</p>`;

        const justificationBlock =
            proposal.justification ? `
                <p class="fw-bold mb-1 mt-3">Métricas que justificaron la propuesta</p>
                <table class="table table-sm mb-0">
                    <tbody>
                        ${proposal.justification.maeHistorical !== undefined && proposal.justification.maeHistorical !== null ? `<tr><td>MAE histórico</td><td class="text-end">${this.formatHours(proposal.justification.maeHistorical)}</td></tr>` : ""}
                        ${proposal.justification.maeRecent !== undefined && proposal.justification.maeRecent !== null ? `<tr><td>MAE reciente</td><td class="text-end">${this.formatHours(proposal.justification.maeRecent)}</td></tr>` : ""}
                        ${proposal.justification.biasRecent !== undefined && proposal.justification.biasRecent !== null ? `<tr><td>Bias reciente</td><td class="text-end">${this.formatSignedHours(proposal.justification.biasRecent)}</td></tr>` : ""}
                        ${proposal.justification.health ? `<tr><td>Health</td><td class="text-end">${proposal.justification.health}</td></tr>` : ""}
                        ${proposal.justification.trend ? `<tr><td>Trend</td><td class="text-end">${proposal.justification.trend}</td></tr>` : ""}
                    </tbody>
                </table>
            ` : "";

        this.detailBody.innerHTML = `
            <p class="fw-bold mb-2">PROPUESTA DE RECALIBRACIÓN</p>
            <dl class="row mb-3">
                <dt class="col-4">Modelo</dt><dd class="col-8">${proposal.modelType || "—"}</dd>
                <dt class="col-4">Producto</dt><dd class="col-8">${proposal.product ? proposal.product.name : "—"}</dd>
                <dt class="col-4">Receta</dt><dd class="col-8">${recipeLabel}</dd>
                <dt class="col-4">Calibración actual</dt><dd class="col-8">${proposal.sourceCalibration ? "v" + proposal.sourceCalibration.version : "—"}</dd>
                <dt class="col-4">Nueva calibración propuesta</dt><dd class="col-8">v${proposal.proposedVersion} (${this.formatSignedHours(proposal.offsetHours)})</dd>
                <dt class="col-4">Estado</dt><dd class="col-8"><span class="badge bg-${PROPOSAL_STATUS_BADGES[proposal.status] || "secondary"}">${proposal.status}</span></dd>
                <dt class="col-4">Creada por</dt><dd class="col-8">${proposal.createdBy || "—"}</dd>
                <dt class="col-4">Fecha</dt><dd class="col-8">${this.formatDateOnly(proposal.createdAt)}</dd>
                ${proposal.approvedAt ? `<dt class="col-4">Aprobada por</dt><dd class="col-8">${proposal.approvedBy || "—"} (${this.formatDate(proposal.approvedAt)})</dd>` : ""}
                ${proposal.status === "REJECTED" ? `<dt class="col-4">Rechazada por</dt><dd class="col-8">${proposal.rejectedBy || "—"} (${this.formatDate(proposal.rejectedAt)})</dd><dt class="col-4">Motivo</dt><dd class="col-8">${proposal.rejectionReason || "—"}</dd>` : ""}
                ${proposal.activatedAt ? `<dt class="col-4">Activada por</dt><dd class="col-8">${proposal.activatedBy || "—"} (${this.formatDate(proposal.activatedAt)})</dd>` : ""}
            </dl>
            ${proposal.reason ? `<p class="fw-bold mb-1">Motivo de la propuesta</p><p>${proposal.reason}</p>` : ""}
            ${comparisonBlock}
            ${justificationBlock}
            ${alertBlock}
        `;

        const footerParts =
            [];

        if (proposal.modelId) {

            const params =
                new URLSearchParams();

            params.set("modelId", proposal.modelId);

            if (proposal.recipeVersion) {

                params.set("recipeVersionId", proposal.recipeVersion.id);

            }

            footerParts.push(`<a href="/maturation/dashboard?${params.toString()}" class="btn btn-outline-primary">Ver desempeño del modelo</a>`);

        }

        // Sección 3/7/8/9 -- solo una propuesta PROPOSED ofrece
        // Aprobar/Rechazar; solo una APPROVED ofrece Activar. Nunca
        // ambos pares de botones a la vez (sección 3: "esto hace que el
        // flujo visual sea muy claro").
        if (proposal.status === "PROPOSED") {

            footerParts.push(`<button type="button" class="btn btn-success" id="btnDetailApprove">Aprobar</button>`);

            footerParts.push(`<button type="button" class="btn btn-outline-danger" id="btnDetailReject">Rechazar</button>`);

        } else if (proposal.status === "APPROVED") {

            footerParts.push(`<button type="button" class="btn btn-success" id="btnDetailActivate">Activar calibración</button>`);

        }

        this.detailFooter.innerHTML =
            footerParts.join(" ");

        const approveButton =
            document.getElementById("btnDetailApprove");

        if (approveButton) {

            approveButton.addEventListener("click", () => this.openApproveModal());

        }

        const rejectButton =
            document.getElementById("btnDetailReject");

        if (rejectButton) {

            rejectButton.addEventListener("click", () => this.openRejectModal());

        }

        const activateButton =
            document.getElementById("btnDetailActivate");

        if (activateButton) {

            activateButton.addEventListener("click", () => this.openActivateModal());

        }

    }

    /*
     * Sección 5 -- ACTUAL (salud real de la calibración origen, ventana
     * reciente) vs. PROPUESTA (simulación sobre esa misma ventana con
     * el offset propuesto -- ver
     * CalibrationEffectivenessService.simulateProposedOffset()). Se
     * complementa con histórico/health/tendencia cuando están
     * disponibles.
     */
    buildComparisonHtml(comparison) {

        if (!comparison) {

            return `<p class="text-muted small mt-3 mb-0">No hay suficiente información para comparar (la calibración origen ya no existe o nunca tuvo predicciones).</p>`;

        }

        const actual =
            comparison.actual.recent || {};

        const proposed =
            comparison.proposed.simulated || {};

        const historical =
            comparison.actual.historical || {};

        return `
            <p class="fw-bold mb-1 mt-3">Comparación de calibraciones</p>
            <table class="table table-sm mb-2">
                <thead>
                    <tr><th></th><th class="text-end">ACTUAL</th><th class="text-end">PROPUESTA (simulada)</th></tr>
                </thead>
                <tbody>
                    <tr><td>MAE</td><td class="text-end">${this.formatHours(actual.maeHours)}</td><td class="text-end">${this.formatHours(proposed.maeHours)}</td></tr>
                    <tr><td>RMSE</td><td class="text-end">${this.formatHours(actual.rmseHours)}</td><td class="text-end">${this.formatHours(proposed.rmseHours)}</td></tr>
                    <tr><td>Bias</td><td class="text-end">${this.formatSignedHours(actual.biasHours)}</td><td class="text-end">${this.formatSignedHours(proposed.biasHours)}</td></tr>
                    <tr><td>Muestras</td><td class="text-end">${actual.sampleSize ?? "—"}</td><td class="text-end">${proposed.sampleSize ?? "—"}</td></tr>
                </tbody>
            </table>
            <p class="text-muted small mb-2">La columna PROPUESTA es una simulación: se recalculan las mismas predicciones recientes de la calibración actual como si se les hubiera aplicado el offset propuesto -- la propuesta nunca generó predicciones propias todavía.</p>
            <table class="table table-sm mb-0">
                <tbody>
                    <tr><td>MAE histórico (calibración actual)</td><td class="text-end">${this.formatHours(historical.maeHours)}</td></tr>
                    <tr><td>Muestras histórico</td><td class="text-end">${historical.sampleSize ?? "—"}</td></tr>
                    <tr><td>Health</td><td class="text-end">${comparison.actual.health || "—"}</td></tr>
                    <tr><td>Tendencia</td><td class="text-end">${comparison.actual.trend || "—"}</td></tr>
                    <tr><td>Periodo analizado</td><td class="text-end">${this.formatDate(comparison.actual.period.from)} — ${this.formatDate(comparison.actual.period.to)}</td></tr>
                </tbody>
            </table>
        `;

    }

    openApproveModal() {

        if (this.approveUserIdInput) {

            this.approveUserIdInput.value =
                "";

        }

        if (this.approveModalElement && window.bootstrap) {

            bootstrap.Modal.getOrCreateInstance(this.approveModalElement).show();

        }

    }

    async handleConfirmApprove() {

        if (!this.currentProposal) {

            return;

        }

        const userId =
            this.approveUserIdInput && this.approveUserIdInput.value.trim()
                ? this.approveUserIdInput.value.trim()
                : undefined;

        const id =
            this.currentProposal.id;

        try {

            await this.api.approve(id, { userId });

            if (this.approveModalElement && window.bootstrap) {

                bootstrap.Modal.getOrCreateInstance(this.approveModalElement).hide();

            }

            if (typeof UI.success === "function") {

                UI.success("Propuesta aprobada. La calibración todavía no está activa.");

            }

            await this.openDetail(id);

            await this.load();

        } catch (err) {

            UI.error(err.message);

        }

    }

    /*
     * Entrega 2.6.1.25, sección 4 -- confirmación antes de activar,
     * texto reproducido tal cual del mockup de la especificación.
     */
    openActivateModal() {

        if (this.activateUserIdInput) {

            this.activateUserIdInput.value =
                "";

        }

        if (this.activateModalElement && window.bootstrap) {

            bootstrap.Modal.getOrCreateInstance(this.activateModalElement).show();

        }

    }

    async handleConfirmActivate() {

        if (!this.currentProposal) {

            return;

        }

        const userId =
            this.activateUserIdInput && this.activateUserIdInput.value.trim()
                ? this.activateUserIdInput.value.trim()
                : undefined;

        const id =
            this.currentProposal.id;

        try {

            await this.api.activate(id, { userId });

            if (this.activateModalElement && window.bootstrap) {

                bootstrap.Modal.getOrCreateInstance(this.activateModalElement).hide();

            }

            if (typeof UI.success === "function") {

                UI.success("Calibración activada. Las predicciones nuevas ya la utilizarán; las anteriores conservan su resultado original.");

            }

            await this.openDetail(id);

            await this.load();

        } catch (err) {

            UI.error(err.message);

        }

    }

    openRejectModal() {

        if (this.rejectReasonInput) {

            this.rejectReasonInput.value =
                "";

        }

        if (this.rejectUserIdInput) {

            this.rejectUserIdInput.value =
                "";

        }

        if (this.rejectReasonError) {

            this.rejectReasonError.style.display =
                "none";

        }

        if (this.rejectModalElement && window.bootstrap) {

            bootstrap.Modal.getOrCreateInstance(this.rejectModalElement).show();

        }

    }

    async handleConfirmReject() {

        if (!this.currentProposal) {

            return;

        }

        const reason =
            this.rejectReasonInput ? this.rejectReasonInput.value.trim() : "";

        // Sección 8 -- "no se permitirá rechazarla sin motivo": se
        // valida también en el cliente para no ni siquiera intentar la
        // petición, aunque el servidor es quien de verdad lo garantiza.
        if (!reason) {

            if (this.rejectReasonError) {

                this.rejectReasonError.style.display =
                    "block";

            }

            return;

        }

        const userId =
            this.rejectUserIdInput && this.rejectUserIdInput.value.trim()
                ? this.rejectUserIdInput.value.trim()
                : undefined;

        const id =
            this.currentProposal.id;

        try {

            await this.api.reject(id, { userId, reason });

            if (this.rejectModalElement && window.bootstrap) {

                bootstrap.Modal.getOrCreateInstance(this.rejectModalElement).hide();

            }

            if (typeof UI.success === "function") {

                UI.success("Propuesta rechazada.");

            }

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

        window.maturationRecalibrationProposalsPage =
            new MaturationRecalibrationProposalsPage();

        window.maturationRecalibrationProposalsPage.init();

    }

);
