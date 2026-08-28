/*
 * Página "Tendencias de alertas" (Entrega 2.7.0.8).
 *
 * Vista de solo lectura -- nunca modifica alertas, predicciones,
 * calibraciones, lotes, mediciones ni acciones operativas (spec,
 * sección de alcance). Todos los números vienen ya calculados de
 * GET /api/prediction-alerts/analytics -- este archivo solo los
 * presenta, mismo criterio que analytics.js (2.7.0.7)/dashboard.js
 * (2.7.0.4): el backend agrega, el frontend formatea.
 */
class PredictionAlertTrendPage {

    constructor() {

        this.api =
            new PredictionAlertTrendApi();

        this.fromInput = document.getElementById("atFilterFrom");
        this.toInput = document.getElementById("atFilterTo");
        this.severitySelect = document.getElementById("atFilterSeverity");
        this.statusSelect = document.getElementById("atFilterStatus");
        this.productSelect = document.getElementById("atFilterProduct");
        this.phaseSelect = document.getElementById("atFilterPhase");
        this.groupBySelect = document.getElementById("atFilterGroupBy");
        this.clearButton = document.getElementById("btnAtClearFilters");

        this.loader = document.getElementById("atLoader");
        this.emptyNoAlerts = document.getElementById("atEmptyNoAlerts");
        this.content = document.getElementById("atContent");

        this.oldestActiveEmpty = document.getElementById("atOldestActiveEmpty");
        this.oldestActiveTable = document.getElementById("atOldestActiveTable");
        this.oldestActiveBody = document.getElementById("atOldestActiveBody");

        this.timelineBody = document.getElementById("atTimelineBody");
        this.severityBody = document.getElementById("atSeverityBody");

        this.durationEmpty = document.getElementById("atDurationEmpty");
        this.durationContent = document.getElementById("atDurationContent");
        this.durationBySeverityBody = document.getElementById("atDurationBySeverityBody");

        this.byProductBody = document.getElementById("atByProductBody");

        [this.severitySelect, this.statusSelect, this.productSelect, this.phaseSelect, this.groupBySelect].forEach(select => {

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

    clearFilters() {

        [this.fromInput, this.toInput].forEach(input => { if (input) input.value = ""; });

        [this.severitySelect, this.statusSelect, this.productSelect, this.phaseSelect].forEach(select => { if (select) select.value = ""; });

        if (this.groupBySelect) {

            this.groupBySelect.value = "WEEK";

        }

        this.load();

    }

    currentFilters() {

        return {

            from: this.fromInput.value || undefined,

            to: this.toInput.value || undefined,

            severity: this.severitySelect.value || undefined,

            status: this.statusSelect.value || undefined,

            productId: this.productSelect.value || undefined,

            phase: this.phaseSelect.value || undefined,

            groupBy: this.groupBySelect.value || undefined

        };

    }

    async load() {

        if (this.loader) {

            this.loader.style.display = "";

        }

        this.emptyNoAlerts.style.display = "none";
        this.content.style.display = "none";

        try {

            const dto =
                await this.api.analytics(this.currentFilters());

            // Sección 17 -- "No hay alertas registradas para el período
            // seleccionado", único estado vacío de nivel de página (la
            // sección de duración tiene su propio sub-estado vacío más
            // abajo, independiente de este).
            if (dto.summary.total === 0) {

                this.emptyNoAlerts.style.display = "";

                return;

            }

            this.content.style.display = "";

            this.renderCards(dto.summary, dto.duration);

            this.renderOldestActive(dto.oldestActive || []);

            this.renderTimeline(dto.timeline || []);

            this.renderSeverityDistribution(dto.bySeverity || []);

            this.renderDuration(dto.duration, dto.durationBySeverity || []);

            this.renderByProduct(dto.byProduct || []);

        } catch (err) {

            UI.error(err.message);

        } finally {

            if (this.loader) {

                this.loader.style.display = "none";

            }

        }

    }

    severityLabel(severity) {

        const labels = {

            WARNING: "🟡 Advertencia",

            SIGNIFICANT: "🟠 Significativa",

            CRITICAL: "🔴 Crítica"

        };

        return labels[severity] || severity || "—";

    }

    formatPercentage(value) {

        return (value === null || value === undefined) ? "N/A" : `${value}%`;

    }

    // "3 h 42 min" -- mockup literal de la sección 3. Sin signo (las
    // duraciones nunca son negativas, a diferencia de
    // formatDeviationMinutes() en measurements.js).
    formatMinutes(minutes) {

        if (minutes === null || minutes === undefined) {

            return "—";

        }

        const total =
            Math.round(minutes);

        const hours =
            Math.floor(total / 60);

        const remainder =
            total % 60;

        return hours > 0 ? `${hours} h ${remainder} min` : `${remainder} min`;

    }

    formatDate(value) {

        return value ? new Date(value).toLocaleDateString() : "—";

    }

    renderCards(summary, duration) {

        document.getElementById("atCardTotal").textContent = summary.total ?? 0;
        document.getElementById("atCardActive").textContent = summary.active ?? 0;
        document.getElementById("atCardResolved").textContent = summary.resolved ?? 0;

        document.getElementById("atCardResolutionRate").textContent =
            this.formatPercentage(summary.resolutionRate);

        // Sección 12 -- nunca implícita: siempre se explica el
        // denominador y se muestran las activas por separado, para que
        // la tasa nunca se lea como "las activas fallaron en resolver".
        document.getElementById("atCardResolutionRateNote").textContent =
            `${summary.resolved} resueltas de ${summary.total} total · ${summary.active} activas`;

        document.getElementById("atCardCritical").textContent = summary.critical ?? 0;

        document.getElementById("atCardAvgDuration").textContent =
            this.formatMinutes(duration.averageMinutes);

        document.getElementById("atCardAvgDurationNote").textContent =
            duration.sampleSize > 0
                ? `Basado en ${duration.sampleSize} alerta${duration.sampleSize === 1 ? "" : "s"} resuelta${duration.sampleSize === 1 ? "" : "s"}`
                : "Sin alertas resueltas todavía";

    }

    // Sección 10 -- lista de alertas activas más antiguas, cada una con
    // acceso directo a la alerta ("[Ver alerta]", mismo patrón
    // `?openAlertId=` ya usado desde 2.7.0.4/2.7.0.5).
    renderOldestActive(items) {

        if (!items || items.length === 0) {

            this.oldestActiveEmpty.style.display = "";

            this.oldestActiveTable.style.display = "none";

            return;

        }

        this.oldestActiveEmpty.style.display = "none";

        this.oldestActiveTable.style.display = "";

        this.oldestActiveBody.innerHTML =
            items.map(item => `
                <tr>
                    <td>${item.batchNumber || "—"}</td>
                    <td>${this.severityLabel(item.severity)}</td>
                    <td>${this.formatMinutes(item.activeMinutes)}</td>
                    <td>
                        ${item.batchId
                            ? `<a href="/batches/${item.batchId}/measurements?openAlertId=${item.id}" class="btn btn-sm btn-outline-danger">Ver alerta</a>`
                            : ""}
                    </td>
                </tr>
            `).join("");

    }

    renderTimeline(rows) {

        if (!rows || rows.length === 0) {

            this.timelineBody.innerHTML =
                `<tr><td colspan="6" class="text-muted">Sin datos para los filtros seleccionados.</td></tr>`;

            return;

        }

        this.timelineBody.innerHTML =
            rows.map(row => `
                <tr>
                    <td>${this.formatDate(row.periodStart)}</td>
                    <td>${row.created}</td>
                    <td>${row.resolved}</td>
                    <td>${row.bySeverity ? row.bySeverity.WARNING : 0}</td>
                    <td>${row.bySeverity ? row.bySeverity.SIGNIFICANT : 0}</td>
                    <td>${row.bySeverity ? row.bySeverity.CRITICAL : 0}</td>
                </tr>
            `).join("");

    }

    renderSeverityDistribution(rows) {

        if (!rows || rows.length === 0) {

            this.severityBody.innerHTML =
                `<tr><td colspan="3" class="text-muted">Sin datos para los filtros seleccionados.</td></tr>`;

            return;

        }

        this.severityBody.innerHTML =
            rows.map(row => `
                <tr>
                    <td>${this.severityLabel(row.severity)}</td>
                    <td>${row.count}</td>
                    <td>${this.formatPercentage(row.percentage)}</td>
                </tr>
            `).join("");

    }

    // Sección 17 -- "No existen alertas resueltas para calcular la
    // duración." Sub-estado vacío INDEPENDIENTE del resto de la
    // página (puede haber alertas activas de sobra y ninguna resuelta
    // todavía).
    renderDuration(duration, bySeverityRows) {

        if (!duration || duration.sampleSize === 0) {

            this.durationEmpty.style.display = "";

            this.durationContent.style.display = "none";

            return;

        }

        this.durationEmpty.style.display = "none";

        this.durationContent.style.display = "";

        document.getElementById("atDurationAvg").textContent = this.formatMinutes(duration.averageMinutes);
        document.getElementById("atDurationMedian").textContent = this.formatMinutes(duration.medianMinutes);
        document.getElementById("atDurationMin").textContent = this.formatMinutes(duration.minMinutes);
        document.getElementById("atDurationMax").textContent = this.formatMinutes(duration.maxMinutes);

        // Sección 18 -- tamaño de muestra siempre visible, con
        // advertencia adicional cuando es pequeña (sin ocultar ni
        // bloquear el resultado).
        const sampleText =
            `Basado en ${duration.sampleSize} alerta${duration.sampleSize === 1 ? "" : "s"} resuelta${duration.sampleSize === 1 ? "" : "s"}`;

        document.getElementById("atDurationSampleNote").innerHTML =
            duration.smallSample
                ? `${sampleText} <span class="text-warning">⚠ Muestra limitada. Resultado descriptivo.</span>`
                : sampleText;

        if (!bySeverityRows || bySeverityRows.length === 0) {

            this.durationBySeverityBody.innerHTML =
                `<tr><td colspan="6" class="text-muted">Sin alertas resueltas para desglosar por severidad.</td></tr>`;

            return;

        }

        this.durationBySeverityBody.innerHTML =
            bySeverityRows.map(row => `
                <tr>
                    <td>${this.severityLabel(row.severity)}</td>
                    <td>${this.formatMinutes(row.averageMinutes)}</td>
                    <td>${this.formatMinutes(row.medianMinutes)}</td>
                    <td>${this.formatMinutes(row.minMinutes)}</td>
                    <td>${this.formatMinutes(row.maxMinutes)}</td>
                    <td>${row.sampleSize}${row.smallSample ? ' <span class="text-warning" title="Muestra limitada. Resultado descriptivo.">⚠</span>' : ""}</td>
                </tr>
            `).join("");

    }

    // Sección 11 -- "importante": nunca se comparan productos
    // normalizando por número de lotes en esta entrega, solo se
    // presentan los conteos absolutos tal como el backend los entrega.
    renderByProduct(rows) {

        if (!rows || rows.length === 0) {

            this.byProductBody.innerHTML =
                `<tr><td colspan="5" class="text-muted">Sin datos para los filtros seleccionados.</td></tr>`;

            return;

        }

        this.byProductBody.innerHTML =
            rows.map(row => `
                <tr>
                    <td>${row.productName}</td>
                    <td>${row.total}</td>
                    <td>${row.resolved}</td>
                    <td>${row.active}</td>
                    <td>${row.critical}</td>
                </tr>
            `).join("");

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        window.predictionAlertTrendPage =
            new PredictionAlertTrendPage();

    }

);
