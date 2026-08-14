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

// Entrega 2.6.1.30, sección 3/16 -- LOW/MEDIUM/HIGH, con el mismo
// semáforo 🔴/🟡/🟢 del mockup de la sección 16.
const RECOMMENDATION_BADGES = {

    LOW: { badge: "danger", emoji: "🔴", label: "BAJA" },

    MEDIUM: { badge: "warning", emoji: "🟡", label: "MEDIA" },

    HIGH: { badge: "success", emoji: "🟢", label: "ALTA" }

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

    formatSignedPercentage(value) {

        if (value === null || value === undefined) {

            return "—";

        }

        const sign =
            value > 0 ? "+" : "";

        return `${sign}${value}%`;

    }

    recommendationBadgeHtml(recommendation) {

        if (!recommendation) {

            return "—";

        }

        const info =
            RECOMMENDATION_BADGES[recommendation] || { badge: "secondary", emoji: "", label: recommendation };

        return `<span class="badge bg-${info.badge}">${info.emoji} ${info.label}</span>`;

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
                `<tr><td colspan="11" class="text-muted">No hay propuestas que coincidan con los filtros seleccionados.</td></tr>`;

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
                    <td>${p.score !== null && p.score !== undefined ? p.score + "/100" : "—"}</td>
                    <td>${this.recommendationBadgeHtml(p.recommendation)}</td>
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

        const evaluationBlock =
            this.buildEvaluationSectionHtml(proposal);

        // Entrega 2.6.1.29, sección 8 -- una propuesta viene de UNO de
        // dos flujos posibles, nunca de ambos a la vez (ver el
        // comentario de RecalibrationProposalService.getDetail()):
        // alerta de SALUD (2.6.1.21/23, `originAlert`) o alerta de
        // DEGRADACIÓN (2.6.1.28/29, `originDegradationEvent`). Solo se
        // muestra el mensaje "no se encontró" cuando NINGUNO de los dos
        // está presente.
        const alertBlock =
            proposal.originAlert ? `
                <p class="fw-bold mb-1 mt-3">Alerta origen</p>
                <p class="mb-1">Alerta #${proposal.originAlert.id} -- <span class="badge bg-${proposal.originAlert.severity === "CRITICAL" ? "danger" : "warning"}">${proposal.originAlert.severity}</span> (${proposal.originAlert.status})</p>
                <a href="/maturation/alerts?openAlertId=${proposal.originAlert.id}" class="btn btn-sm btn-outline-secondary">Ver alerta origen</a>
            ` : proposal.originDegradationEvent ? `
                <p class="fw-bold mb-1 mt-3">Alerta origen</p>
                <p class="mb-1">Alerta de degradación #${proposal.originDegradationEvent.id} -- calibración #${proposal.originDegradationEvent.calibrationId}, incremento de MAE ${proposal.originDegradationEvent.degradationPercentage > 0 ? "+" : ""}${proposal.originDegradationEvent.degradationPercentage}% sobre un umbral de ${proposal.originDegradationEvent.thresholdPercentage}% (${proposal.originDegradationEvent.status})</p>
                <a href="/maturation/calibrations?openEvaluationId=${proposal.originDegradationEvent.calibrationId}" class="btn btn-sm btn-outline-secondary">Ver alerta origen</a>
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
            ${evaluationBlock}
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

        const evaluateButton =
            document.getElementById("btnEvaluateProposal");

        if (evaluateButton) {

            evaluateButton.addEventListener("click", () => this.handleEvaluateProposal());

        }

    }

    /*
     * Entrega 2.6.1.30, secciones 13/16/17 -- "Evaluación de la
     * propuesta": estado (PROPOSED/EVALUATED, derivado -- nunca el
     * `status` del ciclo de vida APPROVED/REJECTED/ACTIVE, sección 13),
     * score/recomendación, ACTUAL vs. PROPUESTA (MAE/RMSE/Bias +
     * mejora), consistencia, y el checklist ✓/⚠ explicando el porqué
     * (secciones 11/12 -- "la recomendación no debe ser una caja
     * negra"). Deliberadamente SEPARADA de la sección "Comparación de
     * calibraciones" de 2.6.1.24 (que sigue debajo, sin cambios): esa
     * comparación usa la ventana reciente de 10 predicciones
     * (`getHealth().recent`, pensada para "¿hay un problema activo
     * ahora mismo?"); esta usa TODA la evidencia evaluable de la
     * calibración origen (pensada para "¿cuánta evidencia respalda
     * esta propuesta?", sección 4) -- mezclar ambas bajo un solo
     * cuadro habría hecho parecer que son la misma medición cuando no
     * lo son.
     */
    buildEvaluationSectionHtml(proposal) {

        const evaluation =
            proposal.latestEvaluation;

        const buttonHtml =
            `<button type="button" class="btn btn-sm btn-outline-primary mt-2" id="btnEvaluateProposal">${evaluation ? "Reevaluar" : "Evaluar propuesta"}</button>`;

        if (!evaluation) {

            return `
                <p class="fw-bold mb-1 mt-3">Evaluación de la propuesta</p>
                <p class="text-muted small mb-1">Estado: <span class="badge bg-secondary">PROPOSED</span> -- todavía no evaluada.</p>
                ${buttonHtml}
            `;

        }

        const positivesHtml =
            (evaluation.explanation.positives || []).map(text => `<li class="text-success">✓ ${text}</li>`).join("");

        const warningsHtml =
            (evaluation.explanation.warnings || []).map(text => `<li class="text-warning">⚠ ${text}</li>`).join("");

        const totalPairs =
            evaluation.consistency.improvedCount + evaluation.consistency.worsenedCount + evaluation.consistency.unchangedCount;

        return `
            <p class="fw-bold mb-1 mt-3">Evaluación de la propuesta</p>
            <p class="mb-2">Estado: <span class="badge bg-success">EVALUATED</span> <span class="text-muted small">(${this.formatDate(evaluation.evaluatedAt)})</span></p>
            <div class="row mb-3">
                <div class="col-6">
                    <p class="text-muted small mb-0">Score</p>
                    <p class="fs-4 fw-bold mb-0">${evaluation.score} / 100</p>
                </div>
                <div class="col-6">
                    <p class="text-muted small mb-0">Recomendación</p>
                    <p class="fs-5 fw-bold mb-0">${this.recommendationBadgeHtml(evaluation.recommendation)}</p>
                </div>
            </div>
            <table class="table table-sm mb-2">
                <thead>
                    <tr><th></th><th class="text-end">ACTUAL</th><th class="text-end">PROPUESTA</th><th class="text-end">Mejora</th></tr>
                </thead>
                <tbody>
                    <tr><td>MAE</td><td class="text-end">${this.formatHours(evaluation.actual.maeHours)}</td><td class="text-end">${this.formatHours(evaluation.proposed.maeHours)}</td><td class="text-end">${this.formatSignedPercentage(evaluation.maeImprovementPercentage)}</td></tr>
                    <tr><td>RMSE</td><td class="text-end">${this.formatHours(evaluation.actual.rmseHours)}</td><td class="text-end">${this.formatHours(evaluation.proposed.rmseHours)}</td><td class="text-end">${this.formatSignedPercentage(evaluation.rmseImprovementPercentage)}</td></tr>
                    <tr><td>Bias</td><td class="text-end">${this.formatSignedHours(evaluation.actual.biasHours)}</td><td class="text-end">${this.formatSignedHours(evaluation.proposed.biasHours)}</td><td class="text-end">${this.formatSignedPercentage(evaluation.biasImprovementPercentage)}</td></tr>
                </tbody>
            </table>
            <p class="small mb-2">Consistencia: ${evaluation.consistency.improvedCount} de ${totalPairs} predicciones mejoran -- Muestras: ${evaluation.sampleSize}</p>
            <ul class="list-unstyled small mb-2">
                ${positivesHtml}
                ${warningsHtml}
            </ul>
            ${buttonHtml}
        `;

    }

    /*
     * Sección 17 -- "evaluar no implica aprobar ni activar": esta
     * acción solo llama a .../evaluate y refresca el detalle/listado,
     * nunca toca status/APPROVED/ACTIVE.
     */
    async handleEvaluateProposal() {

        if (!this.currentProposal) {

            return;

        }

        const id =
            this.currentProposal.id;

        try {

            await this.api.evaluate(id);

            if (typeof UI.success === "function") {

                UI.success("Propuesta evaluada.");

            }

            await this.openDetail(id);

            await this.load();

        } catch (err) {

            UI.error(err.message);

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
