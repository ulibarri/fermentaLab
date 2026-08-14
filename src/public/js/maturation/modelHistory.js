/*
 * Página "Evolución del modelo" (Entrega 2.6.1.31).
 *
 * Completa la vista longitudinal que ningún otro reporte de este
 * proyecto ofrecía todavía: la cadena COMPLETA de calibraciones de un
 * (modelType, recipeVersionId), su evolución de MAE/RMSE/Bias, la
 * comparación entre versiones consecutivas y la mejora acumulada desde
 * la primera calibración. Nunca escribe nada -- página de solo lectura,
 * igual que /maturation/statistics.
 */

const EVIDENCE_BADGES = {

    INSUFFICIENT: "secondary",

    INITIAL: "info",

    SIGNIFICANT: "success"

};

const COMPARISON_BADGES = {

    IMPROVED: "success",

    DEGRADED: "danger",

    INCONCLUSIVE: "warning"

};

// Entrega 2.6.1.32, sección 3 -- semáforo de efectividad de la
// recalibración.
const EFFECTIVENESS_TIER_BADGES = {

    // Bootstrap no trae un "bg-orange" de fábrica -- 🟠 (BAJA
    // EFECTIVIDAD, sección 3) se representa con el mismo badge
    // "secondary" que "muestra insuficiente", pero el emoji dentro del
    // texto sigue distinguiendo visualmente los cuatro niveles del
    // semáforo (ver `effectivenessCellHtml()`).
    HIGH: "success",

    MODERATE: "warning",

    LOW: "secondary",

    INEFFECTIVE: "danger"

};

const STATUS_BADGES = {

    ACTIVE: "success",

    INACTIVE: "dark",

    APPROVED: "info",

    PROPOSED: "secondary",

    REJECTED: "danger"

};

class MaturationModelHistoryPage {

    constructor() {

        this.api =
            new MaturationModelHistoryApi();

        this.modelSelect =
            document.getElementById("mhFilterModel");

        this.recipeVersionSelect =
            document.getElementById("mhFilterRecipeVersion");

        this.fromInput =
            document.getElementById("mhFilterFrom");

        this.toInput =
            document.getElementById("mhFilterTo");

        this.clearButton =
            document.getElementById("btnMhClearFilters");

        this.loader =
            document.getElementById("mhLoader");

        this.content =
            document.getElementById("mhContent");

        this.detailModalElement =
            document.getElementById("modalVersionDetail");

        this.detailBody =
            document.getElementById("mhDetailBody");

        this.lastScopes =
            [];

        [this.modelSelect, this.recipeVersionSelect].forEach(select => {

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

        if (this.content) {

            this.content.addEventListener("click", event => this.handleContentClick(event));

        }

        this.load();

    }

    formatDate(value) {

        return value ? new Date(value).toLocaleDateString() : "—";

    }

    formatDateTime(value) {

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

    formatPercentage(value) {

        if (value === null || value === undefined) {

            return "—";

        }

        const sign =
            value > 0 ? "+" : "";

        return `${sign}${value}%`;

    }

    currentFilters() {

        return {

            modelType: this.modelSelect ? (this.modelSelect.value || undefined) : undefined,

            recipeVersionId: this.recipeVersionSelect ? (this.recipeVersionSelect.value || undefined) : undefined,

            dateFrom: this.fromInput ? (this.fromInput.value || undefined) : undefined,

            dateTo: this.toInput ? (this.toInput.value || undefined) : undefined

        };

    }

    clearFilters() {

        if (this.modelSelect) this.modelSelect.value = "";

        if (this.recipeVersionSelect) this.recipeVersionSelect.value = "";

        if (this.fromInput) this.fromInput.value = "";

        if (this.toInput) this.toInput.value = "";

        this.load();

    }

    async load() {

        if (this.loader) {

            this.loader.style.display = "";

        }

        try {

            const result =
                await this.api.getHistory(this.currentFilters());

            const scopes =
                !result ? [] : (result.segmentedByRecipeVersion ? result.scopes : [result]);

            this.lastScopes =
                scopes;

            this.renderScopes(scopes);

        } catch (err) {

            UI.error(err.message);

        } finally {

            if (this.loader) {

                this.loader.style.display = "none";

            }

        }

    }

    renderScopes(scopes) {

        if (!this.content) {

            return;

        }

        if (!scopes || scopes.length === 0) {

            this.content.innerHTML =
                `<p class="text-muted">No hay ninguna calibración que haya llegado a estar activa todavía para los filtros seleccionados.</p>`;

            return;

        }

        this.content.innerHTML =
            scopes.map((scope, scopeIndex) => this.buildScopeCardHtml(scope, scopeIndex)).join("");

        scopes.forEach((scope, scopeIndex) => {

            ModelEvolutionChart.render({ canvasId: `mhChartMae-${scopeIndex}`, versions: scope.versions, metricKey: "maeHours", label: "MAE", color: "#0d6efd" });

            ModelEvolutionChart.render({ canvasId: `mhChartRmse-${scopeIndex}`, versions: scope.versions, metricKey: "rmseHours", label: "RMSE", color: "#fd7e14" });

            ModelEvolutionChart.render({ canvasId: `mhChartBias-${scopeIndex}`, versions: scope.versions, metricKey: "biasHours", label: "Bias", color: "#6f42c1" });

        });

    }

    /*
     * Sección 6 -- resumen "Primera calibración / Actual / Mejora
     * acumulada".
     */
    buildProgressHtml(scope) {

        if (!scope.progressSinceFirst) {

            return `<p class="text-muted small mb-3">Todavía no hay suficientes evaluaciones almacenadas para calcular la mejora acumulada desde la primera calibración.</p>`;

        }

        const first =
            scope.versions.find(v => v.id === scope.firstVersionId);

        const current =
            scope.versions.find(v => v.id === scope.currentVersionId);

        return `
            <div class="row mb-3">
                <div class="col-md-4">
                    <p class="text-muted small mb-0">Primera calibración (v${first.version})</p>
                    <p class="mb-0">MAE: <strong>${this.formatHours(first.metrics.maeHours)}</strong></p>
                </div>
                <div class="col-md-4">
                    <p class="text-muted small mb-0">Actual (v${current.version})</p>
                    <p class="mb-0">MAE: <strong>${this.formatHours(current.metrics.maeHours)}</strong></p>
                </div>
                <div class="col-md-4">
                    <p class="text-muted small mb-0">Mejora acumulada</p>
                    <p class="mb-0 fs-5 fw-bold ${scope.progressSinceFirst.mae >= 0 ? "text-success" : "text-danger"}">${this.formatPercentage(scope.progressSinceFirst.mae)}</p>
                </div>
            </div>
        `;

    }

    /*
     * Entrega 2.6.1.32, sección 11 -- columna "Efectividad": ¿la
     * mejora que prometía la simulación de esta versión realmente
     * ocurrió tras activarla? Reproduce los cuatro casos del mockup de
     * esa sección (🟡 89%%, 🟢 108%%, 🔴 26%%, 🔴 Regresión) más los
     * estados intermedios de evidencia insuficiente (sección 9).
     */
    effectivenessCellHtml(effectiveness) {

        if (!effectiveness) {

            return `<span class="text-muted">—</span>`;

        }

        if (effectiveness.status === "NOT_APPLICABLE") {

            return `<span class="text-muted">—</span>`;

        }

        if (effectiveness.status === "PENDING") {

            return `<span class="badge bg-secondary">Pendiente</span>`;

        }

        if (effectiveness.status === "PRELIMINARY") {

            return `<span class="badge bg-secondary">Preliminar</span> <span class="text-muted small">(${effectiveness.sampleSize}/${effectiveness.minimumSampleSize})</span>`;

        }

        if (effectiveness.status === "REGRESSION") {

            return `<span class="badge bg-danger">🔴 Regresión</span>`;

        }

        const tier =
            effectiveness.tier;

        return `<span class="badge bg-${EFFECTIVENESS_TIER_BADGES[tier.code] || "secondary"}">${tier.emoji} ${effectiveness.effectivenessScore}%</span>`;

    }

    buildTableRowHtml(version) {

        const statusBadge =
            `<span class="badge bg-${STATUS_BADGES[version.status] || "secondary"}">${version.status}</span>`;

        const evidenceBadge =
            `<span class="badge bg-${EVIDENCE_BADGES[version.evidence.code] || "secondary"}">${version.evidence.label}</span>`;

        const comparisonCell =
            version.comparisonWithPrevious.result
                ? `<span class="badge bg-${COMPARISON_BADGES[version.comparisonWithPrevious.result] || "secondary"}">${version.comparisonWithPrevious.resultLabel}</span> <span class="text-muted small">(MAE ${this.formatPercentage(version.comparisonWithPrevious.metrics.mae)})</span>`
                : `<span class="text-muted small">${version.comparisonWithPrevious.reason === "FIRST_VERSION" ? "Primera versión" : "Sin datos suficientes"}</span>`;

        const durationCell =
            version.activeDuration.applicable
                ? `${version.activeDuration.durationDays} día(s)${version.activeDuration.isOngoing ? " (en curso)" : ""}`
                : "—";

        return `
            <tr class="${version.comparisonWithPrevious.result === "DEGRADED" ? "table-danger" : ""}">
                <td>v${version.version}</td>
                <td>${statusBadge}</td>
                <td>${this.formatDate(version.activatedAt)}</td>
                <td>${durationCell}</td>
                <td>${version.predictionsCount}</td>
                <td>${version.evaluatedCount}</td>
                <td>${evidenceBadge}</td>
                <td>${version.metrics ? this.formatHours(version.metrics.maeHours) : "—"}</td>
                <td>${version.metrics ? this.formatHours(version.metrics.rmseHours) : "—"}</td>
                <td>${version.metrics ? this.formatSignedHours(version.metrics.biasHours) : "—"}</td>
                <td>${comparisonCell}</td>
                <td>${this.effectivenessCellHtml(version.effectiveness)}</td>
                <td><button type="button" class="btn btn-sm btn-outline-primary" data-action="detail" data-version-id="${version.id}">Ver</button></td>
            </tr>
        `;

    }

    buildScopeCardHtml(scope, scopeIndex) {

        const scopeLabel =
            scope.recipeVersion
                ? `${scope.recipeVersion.productName ? scope.recipeVersion.productName + " / " : ""}${scope.recipeVersion.recipeName || ("Receta " + scope.recipeVersionId)} (v${scope.recipeVersion.version})`
                : `Receta #${scope.recipeVersionId}`;

        return `
            <div class="card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${scope.modelType}</strong> -- ${scopeLabel}
                    </div>
                    <div class="text-muted small">
                        ${scope.activeCalibrationId ? `Calibración activa: v${scope.versions.find(v => v.id === scope.activeCalibrationId).version}` : "Sin calibración activa actualmente"}
                    </div>
                </div>
                <div class="card-body">

                    ${this.buildProgressHtml(scope)}

                    <div class="table-responsive mb-4">
                        <table class="table table-sm table-striped align-middle">
                            <thead class="table-dark">
                                <tr>
                                    <th>Versión</th>
                                    <th>Estado</th>
                                    <th>Activa desde</th>
                                    <th>Tiempo activo</th>
                                    <th>Predicciones</th>
                                    <th>Evaluadas</th>
                                    <th>Evidencia</th>
                                    <th>MAE</th>
                                    <th>RMSE</th>
                                    <th>Bias</th>
                                    <th>vs. anterior</th>
                                    <th>Efectividad</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${scope.versions.map(v => this.buildTableRowHtml(v)).join("")}
                            </tbody>
                        </table>
                    </div>

                    <div class="row">
                        <div class="col-md-4">
                            <canvas id="mhChartMae-${scopeIndex}" height="220"></canvas>
                        </div>
                        <div class="col-md-4">
                            <canvas id="mhChartRmse-${scopeIndex}" height="220"></canvas>
                        </div>
                        <div class="col-md-4">
                            <canvas id="mhChartBias-${scopeIndex}" height="220"></canvas>
                        </div>
                    </div>

                </div>
            </div>
        `;

    }

    handleContentClick(event) {

        const button =
            event.target.closest('button[data-action="detail"]');

        if (!button) {

            return;

        }

        this.openDetail(button.getAttribute("data-version-id"));

    }

    findVersionById(id) {

        for (const scope of this.lastScopes) {

            const found =
                scope.versions.find(v => String(v.id) === String(id));

            if (found) {

                return found;

            }

        }

        return null;

    }

    /*
     * Sección 4 -- SIMULACIÓN vs. POST-ACTIVACIÓN, mostradas por
     * separado, nunca mezcladas en un solo número.
     */
    buildSimulationBlockHtml(version) {

        if (!version.simulationVsActual) {

            return `<p class="text-muted small mb-0">Esta versión no reemplazó a ninguna otra -- no existe una simulación previa a la activación que mostrar.</p>`;

        }

        const { simulated, actual } =
            version.simulationVsActual;

        return `
            <table class="table table-sm mb-0">
                <thead>
                    <tr><th></th><th class="text-end">Simulación (pre-activación)</th><th class="text-end">Post-activación (real)</th></tr>
                </thead>
                <tbody>
                    <tr><td>MAE</td><td class="text-end">${simulated ? this.formatHours(simulated.maeHours) : "—"}</td><td class="text-end">${this.formatHours(actual.maeHours)}</td></tr>
                    <tr><td>RMSE</td><td class="text-end">${simulated ? this.formatHours(simulated.rmseHours) : "—"}</td><td class="text-end">${this.formatHours(actual.rmseHours)}</td></tr>
                    <tr><td>Bias</td><td class="text-end">${simulated ? this.formatSignedHours(simulated.biasHours) : "—"}</td><td class="text-end">${this.formatSignedHours(actual.biasHours)}</td></tr>
                    <tr><td>Muestras</td><td class="text-end">${simulated ? simulated.sampleSize : "—"}</td><td class="text-end">${actual.sampleSize}</td></tr>
                </tbody>
            </table>
        `;

    }

    /*
     * Entrega 2.6.1.32, sección 1/10 -- "ESPERADO vs REAL" +
     * "Efectividad", reproduciendo el mockup de la sección 10 dentro
     * del mismo modal de detalle (en vez de duplicar una vista nueva).
     */
    buildEffectivenessBlockHtml(effectiveness) {

        if (!effectiveness || effectiveness.status === "NOT_APPLICABLE") {

            return `<p class="text-muted small mb-0">Esta versión no reemplazó a ninguna otra -- no hay una mejora esperada contra la cual medir efectividad.</p>`;

        }

        if (effectiveness.status === "PENDING") {

            return `<p class="text-muted small mb-0">EVALUACIÓN INSUFICIENTE -- todavía no hay predicciones evaluadas desde que esta calibración se activó.</p>`;

        }

        const table = `
            <table class="table table-sm mb-2">
                <thead><tr><th></th><th class="text-end">ESPERADO</th><th class="text-end">REAL</th></tr></thead>
                <tbody>
                    <tr><td>MAE</td><td class="text-end">${this.formatHours(effectiveness.simulated.maeHours)}</td><td class="text-end">${this.formatHours(effectiveness.real.maeHours)}</td></tr>
                    <tr><td>Mejora</td><td class="text-end">${this.formatPercentage(effectiveness.expected.mae)}</td><td class="text-end">${this.formatPercentage(effectiveness.actual.mae)}</td></tr>
                    <tr><td>RMSE</td><td class="text-end">${this.formatHours(effectiveness.simulated.rmseHours)}</td><td class="text-end">${this.formatHours(effectiveness.real.rmseHours)}</td></tr>
                    <tr><td>Mejora</td><td class="text-end">${this.formatPercentage(effectiveness.expected.rmse)}</td><td class="text-end">${this.formatPercentage(effectiveness.actual.rmse)}</td></tr>
                    <tr><td>Bias</td><td class="text-end">${this.formatSignedHours(effectiveness.simulated.biasHours)}</td><td class="text-end">${this.formatSignedHours(effectiveness.real.biasHours)}</td></tr>
                </tbody>
            </table>
        `;

        if (effectiveness.status === "PRELIMINARY") {

            return `
                ${table}
                <p class="mb-0"><span class="badge bg-secondary">EVALUACIÓN PRELIMINAR</span> <span class="text-muted small">${effectiveness.sampleSize} / ${effectiveness.minimumSampleSize} observaciones mínimas</span></p>
            `;

        }

        if (effectiveness.status === "REGRESSION") {

            return `
                ${table}
                <p class="mb-0"><span class="badge bg-danger">⚠ REGRESIÓN</span> <span class="text-muted small">Esta calibración está mostrando una regresión -- no se desactiva automáticamente.</span></p>
            `;

        }

        const checks =
            effectiveness.checks || {};

        return `
            ${table}
            <p class="fs-5 fw-bold mb-2">Efectividad: ${effectiveness.effectivenessScore}%</p>
            <p class="mb-2">
                MAE ${checks.mae ? "✓" : "✗"} -- RMSE ${checks.rmse ? "✓" : "✗"} -- Bias ${checks.bias ? "✓" : "✗"}
            </p>
            <p class="mb-0">Muestra: ${effectiveness.sampleSize} / ${effectiveness.minimumSampleSize}</p>
            <p class="mb-0"><span class="badge bg-${EFFECTIVENESS_TIER_BADGES[effectiveness.tier.code] || "secondary"}">${effectiveness.tier.emoji} ${effectiveness.tier.label}</span></p>
        `;

    }

    /*
     * Sección 12 -- acceso al detalle, reutilizando toda la
     * trazabilidad ya construida en entregas anteriores en vez de
     * duplicar nada nuevo aquí.
     */
    buildTraceabilityLinksHtml(version) {

        const links =
            [`<a href="/maturation/calibrations?openVersionsId=${version.id}" class="btn btn-sm btn-outline-secondary me-2">Detalle de calibración</a>`];

        if (version.parentCalibrationId) {

            links.push(`<a href="/maturation/recalibration-proposals?openId=${version.id}" class="btn btn-sm btn-outline-success">Propuesta</a>`);

        }

        return `
            <div class="mt-2">
                ${links.join("")}
                <p class="text-muted small mt-2 mb-0">La alerta de origen y la evaluación post-activación completa siguen disponibles desde esas mismas páginas.</p>
            </div>
        `;

    }

    openDetail(id) {

        const version =
            this.findVersionById(id);

        if (!version || !this.detailBody) {

            return;

        }

        if (this.detailModalElement && window.bootstrap) {

            bootstrap.Modal.getOrCreateInstance(this.detailModalElement).show();

        }

        this.detailBody.innerHTML = `
            <p class="fw-bold mb-2">v${version.version} -- ${version.status}</p>
            <dl class="row mb-3">
                <dt class="col-4">Modelo</dt><dd class="col-8">${version.modelType}</dd>
                <dt class="col-4">Creada</dt><dd class="col-8">${this.formatDateTime(version.createdAt)}${version.createdBy ? " por " + version.createdBy : ""}</dd>
                <dt class="col-4">Motivo</dt><dd class="col-8">${version.reason || "—"}</dd>
                <dt class="col-4">Calibración padre</dt><dd class="col-8">${version.parentCalibrationId ? "#" + version.parentCalibrationId : "Ninguna (primera versión)"}</dd>
                <dt class="col-4">Activada</dt><dd class="col-8">${this.formatDateTime(version.activatedAt)}</dd>
                <dt class="col-4">Reemplazada</dt><dd class="col-8">${version.deactivatedAt ? this.formatDateTime(version.deactivatedAt) : (version.isCurrentlyActive ? "Todavía activa" : "—")}</dd>
                <dt class="col-4">Tiempo activo</dt><dd class="col-8">${version.activeDuration.applicable ? version.activeDuration.durationDays + " día(s)" + (version.activeDuration.isOngoing ? " (en curso)" : "") : "—"}</dd>
            </dl>

            <p class="fw-bold mb-1">Métricas (evaluación almacenada)</p>
            ${version.metrics ? `
                <p class="mb-1">MAE: <strong>${this.formatHours(version.metrics.maeHours)}</strong> -- RMSE: <strong>${this.formatHours(version.metrics.rmseHours)}</strong> -- Bias: <strong>${this.formatSignedHours(version.metrics.biasHours)}</strong></p>
                <p class="text-muted small mb-3">Evaluación almacenada el ${this.formatDateTime(version.metrics.evaluatedAt)}.</p>
            ` : `<p class="text-muted small mb-3">Esta versión todavía no tiene ninguna evaluación almacenada (nadie ejecutó "Evaluar" sobre ella).</p>`}

            <p class="mb-3">Predicciones: <strong>${version.predictionsCount}</strong> -- Evaluadas: <strong>${version.evaluatedCount}</strong> -- Evidencia: <span class="badge bg-${EVIDENCE_BADGES[version.evidence.code] || "secondary"}">${version.evidence.label}</span></p>

            <p class="fw-bold mb-1">Simulación vs. desempeño real</p>
            ${this.buildSimulationBlockHtml(version)}

            <p class="fw-bold mb-1 mt-3">Efectividad de la recalibración</p>
            ${this.buildEffectivenessBlockHtml(version.effectiveness)}

            <p class="fw-bold mb-1 mt-3">Comparación con la versión anterior</p>
            ${version.comparisonWithPrevious.result ? `
                <p class="mb-3"><span class="badge bg-${COMPARISON_BADGES[version.comparisonWithPrevious.result]}">${version.comparisonWithPrevious.resultLabel}</span>
                MAE ${this.formatPercentage(version.comparisonWithPrevious.metrics.mae)} -- RMSE ${this.formatPercentage(version.comparisonWithPrevious.metrics.rmse)} -- Bias ${this.formatPercentage(version.comparisonWithPrevious.metrics.bias)}</p>
            ` : `<p class="text-muted small mb-3">${version.comparisonWithPrevious.reason === "FIRST_VERSION" ? "Es la primera versión de la cadena." : "No hay evaluación suficiente en ambos lados para comparar."}</p>`}

            ${this.buildTraceabilityLinksHtml(version)}
        `;

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        window.maturationModelHistoryPage =
            new MaturationModelHistoryPage();

    }

);
