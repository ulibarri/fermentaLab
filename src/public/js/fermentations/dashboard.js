/*
 * Página "Panel operativo de fermentaciones" (Entrega 2.7.0.4).
 *
 * Vista de solo lectura -- nunca crea, modifica ni recalcula nada
 * (sección 15/16 "Filtros": los filtros nunca alteran datos
 * persistidos). Todo el contenido viene de un único endpoint agregado,
 * GET /api/fermentations/active (sección 13).
 */

// Sección 9 -- frecuencia de auto-refresh, "propuesta cada 60 segundos,
// frecuencia configurable" -- constante ajustable en un solo lugar, sin
// UI de configuración (mismo criterio que el resto de umbrales
// "configurables" de este proyecto).
const FERMENTATION_DASHBOARD_REFRESH_MS = 60000;

const SEVERITY_ROW_CLASS = {

    CRITICAL: "table-danger",

    SIGNIFICANT: "table-warning",

    WARNING: "table-warning"

};

class FermentationDashboardPage {

    constructor() {

        this.api =
            new FermentationDashboardApi();

        this.phaseSelect =
            document.getElementById("fdFilterPhase");

        this.severitySelect =
            document.getElementById("fdFilterSeverity");

        this.productSelect =
            document.getElementById("fdFilterProduct");

        this.alertsSelect =
            document.getElementById("fdFilterAlerts");

        this.loader =
            document.getElementById("fdLoader");

        this.empty =
            document.getElementById("fdEmpty");

        this.tableBody =
            document.getElementById("fdTableBody");

        this.updatedAtLabel =
            document.getElementById("fdUpdatedAt");

        this.refreshButton =
            document.getElementById("btnFdRefresh");

        // Sección 10 -- "Actualizado hace N segundos": se recalcula cada
        // segundo a partir de `this.lastLoadedAt`, sin depender de que
        // haya vuelto a llegar información nueva del servidor.
        this.lastLoadedAt =
            null;

        [this.phaseSelect, this.severitySelect, this.productSelect, this.alertsSelect].forEach(select => {

            if (select) {

                select.addEventListener("change", () => this.load());

            }

        });

        if (this.refreshButton) {

            this.refreshButton.addEventListener("click", () => this.load());

        }

        this.load();

        // Sección 9 -- auto-refresh periódico. Sin WebSockets (explícito
        // en el spec): un simple setInterval basta.
        setInterval(() => this.load(), FERMENTATION_DASHBOARD_REFRESH_MS);

        setInterval(() => this.renderUpdatedAtLabel(), 1000);

    }

    currentFilters() {

        return {

            phase: this.phaseSelect.value || undefined,

            severity: this.severitySelect.value || undefined,

            alertsOnly: this.alertsSelect.value || undefined,

            productId: this.productSelect.value || undefined

        };

    }

    async load() {

        if (this.loader) {

            this.loader.style.display = "";

        }

        try {

            const filters =
                this.currentFilters();

            const dashboard =
                await this.api.active(filters);

            this.renderSummary(dashboard.summary || {});

            this.renderTable(dashboard.items || []);

            this.lastLoadedAt =
                new Date();

            this.renderUpdatedAtLabel();

        } catch (err) {

            UI.error(err.message);

        } finally {

            if (this.loader) {

                this.loader.style.display = "none";

            }

        }

    }

    // Sección 3 -- tarjetas de resumen, siempre reflejan el conjunto
    // COMPLETO de lotes activos (nunca acotado por los filtros de la
    // tabla, ver FermentationDashboardService.getActiveFermentations()).
    renderSummary(summary) {

        document.getElementById("fdSummaryActive").textContent =
            summary.active ?? 0;

        document.getElementById("fdSummaryNormal").textContent =
            summary.normal ?? 0;

        document.getElementById("fdSummaryWarning").textContent =
            summary.warning ?? 0;

        document.getElementById("fdSummaryCritical").textContent =
            summary.critical ?? 0;

    }

    // Sección 10 -- "Actualizado hace 12 segundos".
    renderUpdatedAtLabel() {

        if (!this.updatedAtLabel) {

            return;

        }

        if (!this.lastLoadedAt) {

            this.updatedAtLabel.textContent =
                "Actualizando...";

            return;

        }

        const secondsAgo =
            Math.max(0, Math.round((Date.now() - this.lastLoadedAt.getTime()) / 1000));

        this.updatedAtLabel.textContent =
            secondsAgo < 60
                ? `Actualizado hace ${secondsAgo} segundos`
                : `Actualizado hace ${Math.round(secondsAgo / 60)} min`;

    }

    formatDate(value) {

        return value ? new Date(value).toLocaleString() : "—";

    }

    // Sección 5 -- "Última medición hace 25 min" / "hace 7 h ⚠".
    formatMinutesAgo(minutesAgo, stale) {

        if (minutesAgo === null || minutesAgo === undefined) {

            return "Sin mediciones todavía";

        }

        const label =
            minutesAgo < 60
                ? `hace ${minutesAgo} min`
                : `hace ${Math.round(minutesAgo / 60)} h`;

        return stale ? `${label} ⚠` : label;

    }

    // Mockup de la sección 1 -- desviación mostrada como "+H:MM"/"-H:MM".
    formatDeviation(deviationMinutes) {

        if (deviationMinutes === null || deviationMinutes === undefined) {

            return "—";

        }

        const sign =
            deviationMinutes >= 0 ? "+" : "-";

        const abs =
            Math.round(Math.abs(deviationMinutes));

        const hours =
            Math.floor(abs / 60);

        const minutes =
            abs % 60;

        return `${sign}${hours}:${String(minutes).padStart(2, "0")}`;

    }

    // Secciones 4/11/12 -- celda de predicción: fecha estimada normal,
    // o los dos casos especiales explícitos ("Esperando datos" /
    // "PREDICCIÓN NO DISPONIBLE" + motivo), nunca tratados como
    // desviación.
    renderPredictionCell(item) {

        if (item.predictionAvailability === "ESPERANDO_DATOS") {

            return `<span class="text-muted">Esperando datos</span>`;

        }

        if (item.predictionAvailability === "NO_DISPONIBLE") {

            return `<span class="text-muted">PREDICCIÓN NO DISPONIBLE<br><small>Motivo: no existe un modelo/calibración activa aplicable a este lote.</small></span>`;

        }

        if (!item.prediction) {

            return "—";

        }

        return this.formatDate(item.prediction.predictedFinishAt);

    }

    renderProductCell(item) {

        if (item.productName) {

            return `${item.productName}${item.recipeName ? " / " + item.recipeName : ""}`;

        }

        return item.recipeName || "—";

    }

    // Sección 1/4 -- tabla operativa, ya ordenada por prioridad por el
    // backend (FermentationDashboard.comparePriority(), sección 2) --
    // el frontend nunca reordena.
    renderTable(items) {

        if (!items || items.length === 0) {

            this.tableBody.innerHTML =
                "";

            if (this.empty) {

                this.empty.style.display = "";

            }

            return;

        }

        if (this.empty) {

            this.empty.style.display = "none";

        }

        this.tableBody.innerHTML =
            items.map(item => `
                <tr class="${SEVERITY_ROW_CLASS[item.severity] || ""}">
                    <td>${item.batchNumber}</td>
                    <td>${this.renderProductCell(item)}</td>
                    <td>${item.phase}</td>
                    <td>
                        ${item.lastMeasurement ? this.formatDate(item.lastMeasurement.measurementDate) : "—"}
                        <br>
                        <small class="text-muted">${this.formatMinutesAgo(item.lastMeasurementMinutesAgo, item.lastMeasurementStale)}</small>
                    </td>
                    <td>${this.renderPredictionCell(item)}</td>
                    <td>${this.formatDeviation(item.deviationMinutes)}</td>
                    <td>${item.severityEmoji} ${item.severityLabel}</td>
                    <td>
                        <a href="/batches/${item.batchId}/measurements" class="btn btn-sm btn-outline-primary">Ver lote</a>
                        ${item.alert ? `<a href="/batches/${item.batchId}/measurements?openAlertId=${item.alert.id}" class="btn btn-sm btn-outline-danger ms-1">Ver alerta</a>` : ""}
                    </td>
                </tr>
            `).join("");

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        window.fermentationDashboardPage =
            new FermentationDashboardPage();

    }

);
