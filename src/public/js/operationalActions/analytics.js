/*
 * Página "Análisis de acciones operativas" (Entrega 2.7.0.7).
 *
 * Vista de solo lectura -- nunca crea, modifica ni recalcula nada
 * (spec: "esta entrega será principalmente de consulta, agregación y
 * visualización... no modifica lotes/mediciones/predicciones/alertas/
 * acciones operativas/evaluaciones de efectividad"). Todos los números
 * vienen ya calculados de GET /api/operational-actions/analytics -- este
 * archivo solo los presenta, exactamente igual que measurements.js
 * (2.7.0.6) nunca recalcula ActionEffectiveness por su cuenta.
 */
class OperationalActionAnalyticsPage {

    constructor() {

        this.api =
            new OperationalActionAnalyticsApi();

        this.fromInput =
            document.getElementById("oaFilterFrom");

        this.toInput =
            document.getElementById("oaFilterTo");

        this.actionTypeSelect =
            document.getElementById("oaFilterActionType");

        this.effectivenessSelect =
            document.getElementById("oaFilterEffectiveness");

        this.severitySelect =
            document.getElementById("oaFilterSeverity");

        this.productSelect =
            document.getElementById("oaFilterProduct");

        this.clearButton =
            document.getElementById("btnOaClearFilters");

        this.loader =
            document.getElementById("oaLoader");

        this.emptyNoActions =
            document.getElementById("oaEmptyNoActions");

        this.emptyNoResults =
            document.getElementById("oaEmptyNoResults");

        this.content =
            document.getElementById("oaContent");

        this.noEvaluatedNotice =
            document.getElementById("oaNoEvaluatedNotice");

        [this.actionTypeSelect, this.effectivenessSelect, this.severitySelect, this.productSelect].forEach(select => {

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

        [this.actionTypeSelect, this.effectivenessSelect, this.severitySelect, this.productSelect].forEach(select => { if (select) select.value = ""; });

        this.load();

    }

    currentFilters() {

        return {

            from: this.fromInput.value || undefined,

            to: this.toInput.value || undefined,

            actionType: this.actionTypeSelect.value || undefined,

            effectivenessStatus: this.effectivenessSelect.value || undefined,

            alertSeverity: this.severitySelect.value || undefined,

            productId: this.productSelect.value || undefined

        };

    }

    /*
     * Acción 16 -- distingue los tres estados sin datos. "Sin acciones"
     * (mensaje ligado al período) se reserva para cuando no hay ningún
     * filtro adicional a Desde/Hasta activo; en cuanto el usuario acota
     * por tipo/resultado/severidad/producto y el resultado queda vacío,
     * se interpreta como "los filtros no generan resultados" (mensaje
     * distinto, más específico).
     */
    determineEmptyState(dto, filters) {

        if (dto.summary.total > 0) {

            return null;

        }

        const hasNonPeriodFilters =
            Boolean(filters.actionType || filters.effectivenessStatus || filters.alertSeverity || filters.productId);

        return hasNonPeriodFilters ? "NO_RESULTS" : "NO_ACTIONS";

    }

    async load() {

        if (this.loader) {

            this.loader.style.display = "";

        }

        this.emptyNoActions.style.display = "none";
        this.emptyNoResults.style.display = "none";
        this.content.style.display = "none";

        try {

            const filters =
                this.currentFilters();

            const dto =
                await this.api.analytics(filters);

            const emptyState =
                this.determineEmptyState(dto, filters);

            if (emptyState === "NO_ACTIONS") {

                this.emptyNoActions.style.display = "";

                return;

            }

            if (emptyState === "NO_RESULTS") {

                this.emptyNoResults.style.display = "";

                return;

            }

            this.content.style.display = "";

            this.noEvaluatedNotice.style.display =
                (dto.summary.total > 0 && dto.summary.evaluated === 0) ? "" : "none";

            this.renderCards(dto.summary);

            this.renderGroupTable("oaByTypeBody", dto.byActionType, row => row.typeLabel);

            this.renderGroupTable("oaBySeverityBody", dto.bySeverity, row => this.severityLabel(row.severity));

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

    // Acción 5 -- N/A cuando el backend regresa null (evaluated = 0),
    // nunca "0%" (que sugeriría falsamente cero mejoras entre acciones
    // ya evaluadas).
    formatPercentage(value) {

        return (value === null || value === undefined) ? "N/A" : `${value}%`;

    }

    // Acción 12 -- "18 / 42" (parte / evaluadas). Sin evaluadas
    // todavía, no hay fracción que mostrar.
    formatFraction(part, whole) {

        return whole > 0 ? `${part} / ${whole}` : "—";

    }

    renderCards(summary) {

        document.getElementById("oaCardTotal").textContent =
            summary.total ?? 0;

        document.getElementById("oaCardEvaluated").textContent =
            summary.evaluated ?? 0;

        document.getElementById("oaCardPending").textContent =
            summary.pending ?? 0;

        const cardFields =
            [

                ["improved", "oaCardImproved", "oaCardImprovedPct"],

                ["unchanged", "oaCardUnchanged", "oaCardUnchangedPct"],

                ["worsened", "oaCardWorsened", "oaCardWorsenedPct"],

                ["resolved", "oaCardResolved", "oaCardResolvedPct"]

            ];

        cardFields.forEach(([key, mainId, pctId]) => {

            document.getElementById(mainId).textContent =
                this.formatFraction(summary[key], summary.evaluated);

            document.getElementById(pctId).textContent =
                this.formatPercentage(summary.percentages ? summary.percentages[key] : null);

        });

    }

    // Acción 13 -- valores absolutos SIEMPRE presentes, nunca
    // solamente porcentajes.
    formatCell(count, percentage) {

        const pctText =
            this.formatPercentage(percentage);

        return `${count} <span class="text-muted">(${pctText})</span>`;

    }

    // Acción 14 -- "Muestra limitada. Resultado descriptivo." junto al
    // nombre del grupo, nunca ocultando ni bloqueando la fila.
    smallSampleNoteHtml(row) {

        return row.smallSample
            ? `<br><small class="text-warning">⚠ Muestra limitada. Resultado descriptivo.</small>`
            : "";

    }

    renderGroupTable(tbodyId, rows, labelFn) {

        const tbody =
            document.getElementById(tbodyId);

        if (!tbody) {

            return;

        }

        if (!rows || rows.length === 0) {

            tbody.innerHTML =
                `<tr><td colspan="8" class="text-muted">Sin datos para los filtros seleccionados.</td></tr>`;

            return;

        }

        tbody.innerHTML =
            rows.map(row => `
                <tr>
                    <td>${labelFn(row)}${this.smallSampleNoteHtml(row)}</td>
                    <td>${row.total}</td>
                    <td>${row.evaluated}</td>
                    <td>${this.formatCell(row.improved, row.percentages.improved)}</td>
                    <td>${this.formatCell(row.unchanged, row.percentages.unchanged)}</td>
                    <td>${this.formatCell(row.worsened, row.percentages.worsened)}</td>
                    <td>${this.formatCell(row.resolved, row.percentages.resolved)}</td>
                    <td>${row.pending}</td>
                </tr>
            `).join("");

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        window.operationalActionAnalyticsPage =
            new OperationalActionAnalyticsPage();

    }

);
