/*
 * Página "Análisis global del proceso de recalibración" (Entrega
 * 2.6.1.33). Cierre del bloque 2.6.1.x -- ver el comentario de cabecera
 * de `RecalibrationProcessAnalysis.js` para la pregunta que responde
 * esta página. Solo lectura, igual que /maturation/model-history.
 */

const RESULT_TIER_BADGES = {

    HIGH: "success",

    MODERATE: "warning",

    LOW: "secondary",

    INEFFECTIVE: "danger"

};

const STATUS_LABELS = {

    VALID: "Válida",

    REGRESSION: "Regresión",

    PRELIMINARY: "Preliminar",

    PENDING: "Pendiente",

    NOT_APPLICABLE: "No aplica"

};

const STATUS_BADGES = {

    VALID: "success",

    REGRESSION: "danger",

    PRELIMINARY: "secondary",

    PENDING: "secondary",

    NOT_APPLICABLE: "light"

};

class MaturationEffectivenessSummaryPage {

    constructor() {

        this.api =
            new RecalibrationEffectivenessSummaryApi();

        this.modelSelect =
            document.getElementById("efFilterModel");

        this.fromInput =
            document.getElementById("efFilterFrom");

        this.toInput =
            document.getElementById("efFilterTo");

        this.estadoSelect =
            document.getElementById("efFilterEstado");

        this.nivelSelect =
            document.getElementById("efFilterNivel");

        this.searchInput =
            document.getElementById("efFilterSearch");

        this.clearButton =
            document.getElementById("btnEfClearFilters");

        this.loader =
            document.getElementById("efLoader");

        this.content =
            document.getElementById("efContent");

        this.lastSummary =
            null;

        [this.modelSelect, this.fromInput, this.toInput].forEach(el => {

            if (el) {

                el.addEventListener("change", () => this.load());

            }

        });

        [this.estadoSelect, this.nivelSelect].forEach(el => {

            if (el) {

                el.addEventListener("change", () => this.renderRecordsTable());

            }

        });

        if (this.searchInput) {

            this.searchInput.addEventListener("input", () => this.renderRecordsTable());

        }

        if (this.clearButton) {

            this.clearButton.addEventListener("click", () => this.clearFilters());

        }

        this.load();

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

    formatDate(value) {

        return value ? new Date(value).toLocaleDateString() : "—";

    }

    serverFilters() {

        return {

            model: this.modelSelect ? (this.modelSelect.value || undefined) : undefined,

            dateFrom: this.fromInput ? (this.fromInput.value || undefined) : undefined,

            dateTo: this.toInput ? (this.toInput.value || undefined) : undefined

        };

    }

    clearFilters() {

        if (this.modelSelect) this.modelSelect.value = "";

        if (this.fromInput) this.fromInput.value = "";

        if (this.toInput) this.toInput.value = "";

        if (this.estadoSelect) this.estadoSelect.value = "";

        if (this.nivelSelect) this.nivelSelect.value = "";

        if (this.searchInput) this.searchInput.value = "";

        this.load();

    }

    async load() {

        if (this.loader) {

            this.loader.style.display = "";

        }

        try {

            this.lastSummary =
                await this.api.getSummary(this.serverFilters());

            this.render();

        } catch (err) {

            UI.error(err.message);

        } finally {

            if (this.loader) {

                this.loader.style.display = "none";

            }

        }

    }

    render() {

        if (!this.content || !this.lastSummary) {

            return;

        }

        const summary =
            this.lastSummary;

        this.content.innerHTML = `

            ${this.buildEvidenceHtml(summary)}

            ${this.buildCountsHtml(summary)}

            ${this.buildRatesHtml(summary)}

            ${this.buildEffectivenessStatsHtml(summary)}

            ${this.buildBiasHtml(summary)}

            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-4">
                        <div class="card-header">Distribución de efectividad</div>
                        <div class="card-body"><canvas id="efChartDistribution" height="220"></canvas></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card mb-4">
                        <div class="card-header">Evolución temporal</div>
                        <div class="card-body"><canvas id="efChartTimeline" height="220"></canvas></div>
                    </div>
                </div>
            </div>

            ${this.buildRegressionsHtml(summary)}

            ${this.buildByModelHtml(summary)}

            ${this.buildMetricsAggregateHtml(summary)}

            ${this.buildProcessHealthHtml(summary)}

            <div class="card mb-4">
                <div class="card-header">Trazabilidad -- recalibraciones consideradas en este cálculo</div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-sm table-striped mb-0 align-middle">
                            <thead class="table-dark">
                                <tr>
                                    <th>Versión</th>
                                    <th>Modelo</th>
                                    <th>Activada</th>
                                    <th>Estado</th>
                                    <th>Muestra</th>
                                    <th>Mejora esperada (MAE)</th>
                                    <th>Mejora real (MAE)</th>
                                    <th>Efectividad</th>
                                </tr>
                            </thead>
                            <tbody id="efRecordsTableBody">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        `;

        ProcessEffectivenessCharts.renderDistribution("efChartDistribution", summary.distribution);

        ProcessEffectivenessCharts.renderTimeline("efChartTimeline", summary.timeline);

        this.renderRecordsTable();

    }

    /*
     * Sección 13 -- conteos de evidencia, con la advertencia explícita
     * de que solo "evaluadas" (VALID + REGRESSION) alimenta los
     * indicadores de abajo.
     */
    buildEvidenceHtml(summary) {

        const e =
            summary.evidence;

        return `
            <div class="alert alert-secondary">
                <strong>${e.evaluated}</strong> evaluaciones válidas (alimentan los indicadores de abajo) --
                <strong>${e.preliminary}</strong> preliminares y <strong>${e.pending}</strong> pendientes (excluidas, evidencia insuficiente)
                ${e.notApplicable > 0 ? ` -- <strong>${e.notApplicable}</strong> sin calibración origen (no son recalibraciones)` : ""}.
            </div>
        `;

    }

    buildCountsHtml(summary) {

        const c =
            summary.counts;

        const total =
            summary.evidence.evaluated;

        const pct =
            n => total > 0 ? this.formatPercentage(Math.round((n / total) * 1000) / 10) : "—";

        const cards =
            [

                { label: "RECALIBRACIONES EVALUADAS", value: total, cls: "" },

                { label: "EXITOSAS", value: `${c.successful} (${pct(c.successful)})`, cls: "text-success" },

                { label: "MODERADAS", value: `${c.moderate} (${pct(c.moderate)})`, cls: "text-warning" },

                { label: "INEFECTIVAS", value: `${c.ineffective} (${pct(c.ineffective)})`, cls: "text-danger" },

                { label: "REGRESIONES", value: `${c.regressions} (${pct(c.regressions)})`, cls: "text-danger" }

            ];

        return `
            <div class="row mb-4">
                ${cards.map(card => `
                    <div class="col">
                        <div class="card text-center h-100">
                            <div class="card-body py-3">
                                <p class="text-muted small mb-1">${card.label}</p>
                                <p class="fs-4 fw-bold mb-0 ${card.cls}">${card.value}</p>
                            </div>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;

    }

    /*
     * Sección 2 -- las dos tasas, deliberadamente separadas: "mejoró"
     * no es lo mismo que "consiguió la mejora esperada".
     */
    buildRatesHtml(summary) {

        const r =
            summary.rates;

        return `
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-body">
                            <p class="text-muted small mb-1">Tasa de éxito <span class="text-muted">(mejoró el modelo)</span></p>
                            <p class="fs-4 fw-bold mb-0">${this.formatPercentage(r.success)}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-body">
                            <p class="text-muted small mb-1">Tasa de efectividad alta <span class="text-muted">(≥90%)</span></p>
                            <p class="fs-4 fw-bold mb-0">${this.formatPercentage(r.highEffectiveness)}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-body">
                            <p class="text-muted small mb-1">Tasa de regresión</p>
                            <p class="fs-4 fw-bold mb-0 ${r.regression > 0 ? "text-danger" : ""}">${this.formatPercentage(r.regression)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

    }

    /*
     * Sección 3 -- media vs. mediana, con la advertencia de dispersión
     * si ambas difieren demasiado.
     */
    buildEffectivenessStatsHtml(summary) {

        const eff =
            summary.effectiveness;

        return `
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card h-100">
                        <div class="card-body">
                            <p class="text-muted small mb-1">Efectividad promedio</p>
                            <p class="fs-4 fw-bold mb-0">${this.formatPercentage(eff.mean)}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card h-100">
                        <div class="card-body">
                            <p class="text-muted small mb-1">Efectividad mediana</p>
                            <p class="fs-4 fw-bold mb-0">${this.formatPercentage(eff.median)}</p>
                        </div>
                    </div>
                </div>
            </div>
            ${eff.dispersionWarning ? `
                <div class="alert alert-warning">
                    ⚠ La media y la mediana difieren de forma importante -- posible dispersión alta entre recalibraciones (algunas excepcionalmente buenas o malas están distorsionando el promedio).
                </div>
            ` : ""}
        `;

    }

    /*
     * Sección 4/5 -- ¿demasiado optimistas o demasiado conservadores?
     */
    buildBiasHtml(summary) {

        const imp =
            summary.improvement;

        const directionText = {

            OPTIMISTIC: "Las simulaciones están SOBREESTIMANDO la mejora real. No se modifica automáticamente el algoritmo de simulación -- esto es solo información.",

            CONSERVATIVE: "Las simulaciones están SUBESTIMANDO sistemáticamente la mejora real.",

            ACCURATE: "Las simulaciones están estimando la mejora real con precisión razonable (dentro del margen de ruido esperado)."

        }[imp.estimationBiasDirection] || "Todavía no hay evidencia suficiente para evaluar el sesgo de estimación.";

        return `
            <div class="card mb-4">
                <div class="card-header">¿Somos demasiado optimistas o conservadores?</div>
                <div class="card-body">
                    <div class="row mb-2">
                        <div class="col-md-4">
                            <p class="text-muted small mb-1">Mejora esperada promedio</p>
                            <p class="fs-5 fw-bold mb-0">${this.formatPercentage(imp.expectedMean)}</p>
                        </div>
                        <div class="col-md-4">
                            <p class="text-muted small mb-1">Mejora real promedio</p>
                            <p class="fs-5 fw-bold mb-0">${this.formatPercentage(imp.actualMean)}</p>
                        </div>
                        <div class="col-md-4">
                            <p class="text-muted small mb-1">Sesgo de estimación</p>
                            <p class="fs-5 fw-bold mb-0">${this.formatPercentage(imp.estimationBias)} puntos</p>
                        </div>
                    </div>
                    <p class="mb-0 text-muted">${directionText}</p>
                </div>
            </div>
        `;

    }

    /*
     * Sección 7 -- lista dedicada de regresiones.
     */
    buildRegressionsHtml(summary) {

        if (!summary.regressionDetails || summary.regressionDetails.length === 0) {

            return "";

        }

        return `
            <div class="card mb-4 border-danger">
                <div class="card-header bg-danger text-white">⚠ REGRESIONES (${summary.regressionDetails.length})</div>
                <div class="card-body p-0">
                    <table class="table table-sm mb-0">
                        <thead>
                            <tr><th>Versión</th><th>Modelo</th><th>Esperada</th><th>Real</th></tr>
                        </thead>
                        <tbody>
                            ${summary.regressionDetails.map(r => `
                                <tr class="table-danger">
                                    <td>v${r.version}</td>
                                    <td>${r.modelType}</td>
                                    <td>${this.formatPercentage(r.expectedImprovementPercentage)}</td>
                                    <td>${this.formatPercentage(r.actualImprovementPercentage)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

    }

    /*
     * Sección 9 -- comparación por modelo predictivo.
     */
    buildByModelHtml(summary) {

        if (!summary.byModel || summary.byModel.length <= 1) {

            return "";

        }

        return `
            <div class="card mb-4">
                <div class="card-header">Comparación por modelo</div>
                <div class="card-body">
                    <div class="row">
                        ${summary.byModel.map(m => `
                            <div class="col-md-4 mb-2">
                                <p class="mb-0"><strong>${m.modelType}</strong></p>
                                <p class="text-muted small mb-0">Efectividad media: ${this.formatPercentage(m.averageEffectiveness)} (${m.evaluatedCount} evaluadas, ${m.regressionCount} regresiones)</p>
                            </div>
                        `).join("")}
                    </div>
                </div>
            </div>
        `;

    }

    /*
     * Sección 10 -- MAE/RMSE/Bias agregados.
     */
    buildMetricsAggregateHtml(summary) {

        const m =
            summary.metrics;

        return `
            <div class="card mb-4">
                <div class="card-header">MAE, RMSE y Bias -- evolución agregada</div>
                <div class="card-body p-0">
                    <table class="table table-sm mb-0">
                        <thead>
                            <tr><th></th><th class="text-end">Antes</th><th class="text-end">Esperado</th><th class="text-end">Real</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>MAE</td><td class="text-end">—</td><td class="text-end">${this.formatHours(m.mae.expectedHours)}</td><td class="text-end">${this.formatHours(m.mae.realHours)}</td></tr>
                            <tr><td>RMSE</td><td class="text-end">—</td><td class="text-end">${this.formatHours(m.rmse.expectedHours)}</td><td class="text-end">${this.formatHours(m.rmse.realHours)}</td></tr>
                            <tr><td>Bias</td><td class="text-end">${this.formatSignedHours(m.bias.beforeHours)}</td><td class="text-end">${this.formatSignedHours(m.bias.expectedHours)}</td><td class="text-end">${this.formatSignedHours(m.bias.realHours)}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

    }

    /*
     * Sección 11 -- indicador resumido, siempre acompañado de sus
     * componentes (nunca un "número mágico" aislado).
     */
    buildProcessHealthHtml(summary) {

        const health =
            summary.processHealth;

        if (health.score === null) {

            return `
                <div class="card mb-4">
                    <div class="card-header">RECALIBRATION PROCESS HEALTH</div>
                    <div class="card-body">
                        <p class="text-muted mb-0">Todavía no hay evaluaciones válidas suficientes para calcular un indicador de salud del proceso.</p>
                    </div>
                </div>
            `;

        }

        const c =
            health.components;

        return `
            <div class="card mb-4">
                <div class="card-header">RECALIBRATION PROCESS HEALTH</div>
                <div class="card-body text-center">
                    <p class="display-4 fw-bold mb-0">${health.score} / 100</p>
                    <p class="fs-5 mb-3">${health.tier.emoji} ${health.tier.label}</p>
                    <div class="row text-start">
                        <div class="col-md-3"><p class="text-muted small mb-0">Éxito</p><p class="mb-0 fw-bold">${this.formatPercentage(c.success)}</p></div>
                        <div class="col-md-3"><p class="text-muted small mb-0">Efectividad</p><p class="mb-0 fw-bold">${this.formatPercentage(c.effectiveness)}</p></div>
                        <div class="col-md-3"><p class="text-muted small mb-0">Regresiones</p><p class="mb-0 fw-bold">${this.formatPercentage(c.regressions)}</p></div>
                        <div class="col-md-3"><p class="text-muted small mb-0">Consistencia</p><p class="mb-0 fw-bold">${this.formatPercentage(c.consistency)}</p></div>
                    </div>
                    <p class="text-muted small mt-3 mb-0">Este indicador es informativo -- no activa, desactiva ni modifica ninguna calibración automáticamente.</p>
                </div>
            </div>
        `;

    }

    /*
     * Sección 12/14 -- filtros de cliente (estado/nivel/búsqueda) sobre
     * la tabla de trazabilidad. Los indicadores globales de arriba NO
     * se recalculan con estos filtros -- solo la tabla.
     */
    filteredRecords() {

        if (!this.lastSummary || !this.lastSummary.records) {

            return [];

        }

        const estado =
            this.estadoSelect ? this.estadoSelect.value : "";

        const nivel =
            this.nivelSelect ? this.nivelSelect.value : "";

        const search =
            this.searchInput ? this.searchInput.value.trim().toLowerCase() : "";

        return this.lastSummary.records.filter(record => {

            if (estado && record.status !== estado) {

                return false;

            }

            if (nivel && (!record.tier || record.tier.code !== nivel)) {

                return false;

            }

            if (search) {

                const haystack =
                    `${record.calibrationId} v${record.version}`.toLowerCase();

                if (!haystack.includes(search)) {

                    return false;

                }

            }

            return true;

        });

    }

    renderRecordsTable() {

        const tbody =
            document.getElementById("efRecordsTableBody");

        if (!tbody) {

            return;

        }

        const records =
            this.filteredRecords();

        if (records.length === 0) {

            tbody.innerHTML = `<tr><td colspan="8" class="text-muted text-center">Ninguna recalibración coincide con estos filtros.</td></tr>`;

            return;

        }

        tbody.innerHTML =
            records.map(record => {

                const statusBadge =
                    `<span class="badge bg-${STATUS_BADGES[record.status] || "secondary"}">${STATUS_LABELS[record.status] || record.status}</span>`;

                const effectivenessCell =
                    record.tier
                        ? `<span class="badge bg-${RESULT_TIER_BADGES[record.tier.code] || "secondary"}">${record.tier.emoji} ${record.effectivenessScore}%</span>`
                        : (record.isRegression ? `<span class="text-danger">⚠ Regresión</span>` : `<span class="text-muted">—</span>`);

                return `
                    <tr>
                        <td>v${record.version}</td>
                        <td>${record.modelType || "—"}</td>
                        <td>${this.formatDate(record.activatedAt)}</td>
                        <td>${statusBadge}</td>
                        <td>${record.sampleSize ?? "—"}</td>
                        <td>${record.expected ? this.formatPercentage(record.expected.mae) : "—"}</td>
                        <td>${record.actual ? this.formatPercentage(record.actual.mae) : "—"}</td>
                        <td>${effectivenessCell}</td>
                    </tr>
                `;

            }).join("");

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        window.maturationEffectivenessSummaryPage =
            new MaturationEffectivenessSummaryPage();

    }

);
