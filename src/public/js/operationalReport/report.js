/*
 * Página "Reporte consolidado" (Entrega 2.7.0.9).
 *
 * Vista de solo lectura -- consolida indicadores que ya existen en
 * otros módulos (nunca modifica predicciones/calibraciones/alertas/
 * acciones/lotes/mediciones, sección de alcance). Todos los números
 * vienen ya calculados de GET /api/analytics/operational-report -- este
 * archivo solo los presenta, mismo criterio que report.js/analytics.js/
 * dashboard.js de las entregas anteriores: el backend agrega, el
 * frontend formatea.
 *
 * Sección 14 -- cada bloque (predicciones/calibración/alertas/acciones)
 * se muestra u oculta de forma INDEPENDIENTE según sus propios datos --
 * un bloque sin datos nunca esconde ni rompe los demás.
 */
class OperationalReportPage {

    constructor() {

        this.api =
            new OperationalReportApi();

        this.fromInput = document.getElementById("orFilterFrom");
        this.toInput = document.getElementById("orFilterTo");
        this.productSelect = document.getElementById("orFilterProduct");
        this.clearButton = document.getElementById("btnOrClearFilters");
        this.periodLabel = document.getElementById("orPeriodLabel");

        this.loader = document.getElementById("orLoader");
        this.content = document.getElementById("orContent");

        [this.fromInput, this.toInput].forEach(input => {

            if (input) {

                input.addEventListener("change", () => this.load());

            }

        });

        if (this.productSelect) {

            this.productSelect.addEventListener("change", () => this.load());

        }

        const presetButton = (id, days) => {

            const button =
                document.getElementById(id);

            if (button) {

                button.addEventListener("click", () => this.applyPreset(days));

            }

        };

        presetButton("orPreset7", 7);
        presetButton("orPreset30", 30);
        presetButton("orPreset90", 90);

        if (this.clearButton) {

            this.clearButton.addEventListener("click", () => this.clearFilters());

        }

        // Sección 2 -- período obligatorio: si la página carga sin
        // fechas, se aplica el preset de 30 días por defecto (mismo
        // valor que el respaldo del backend, `DEFAULT_PERIOD_DAYS` en
        // OperationalReportService, para que el rango mostrado en los
        // inputs siempre coincida con el que realmente se consultó).
        if (!this.fromInput.value && !this.toInput.value) {

            this.applyPreset(30);

        } else {

            this.load();

        }

    }

    _isoDate(date) {

        return date.toISOString().slice(0, 10);

    }

    applyPreset(days) {

        const to =
            new Date();

        const from =
            new Date(to.getTime() - (days * 24 * 60 * 60 * 1000));

        this.toInput.value = this._isoDate(to);
        this.fromInput.value = this._isoDate(from);

        this.load();

    }

    clearFilters() {

        if (this.productSelect) {

            this.productSelect.value = "";

        }

        this.applyPreset(30);

    }

    currentFilters() {

        return {

            from: this.fromInput.value || undefined,

            to: this.toInput.value || undefined,

            productId: this.productSelect.value || undefined

        };

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

    formatHours(hours) {

        return (hours === null || hours === undefined) ? "—" : `${hours} h`;

    }

    formatDate(value) {

        return value ? new Date(value).toLocaleDateString() : "—";

    }

    async load() {

        if (this.loader) {

            this.loader.style.display = "";

        }

        this.content.style.display = "none";

        try {

            const filters =
                this.currentFilters();

            const dto =
                await this.api.report(filters);

            if (this.periodLabel) {

                this.periodLabel.textContent =
                    `Período: ${this.formatDate(dto.period.from)} — ${this.formatDate(dto.period.to)}`;

            }

            this.content.style.display = "";

            this.renderExecutiveSummary(dto.executiveSummary);

            this.renderPredictionPerformance(dto.predictionPerformance);

            this.renderCalibration(dto.calibration);

            this.renderAlerts(dto.alerts);

            this.renderActions(dto.actions);

            this.renderPriorityAlerts(dto.priorityAlerts || []);

            this.renderMethodology(dto.methodology || []);

        } catch (err) {

            UI.error(err.message);

        } finally {

            if (this.loader) {

                this.loader.style.display = "none";

            }

        }

    }

    // Sección 7 -- resumen ejecutivo. Nunca muestra un puntaje único de
    // "salud del sistema" (sección "Importante", explícito).
    renderExecutiveSummary(summary) {

        if (!summary) {

            return;

        }

        document.getElementById("orExecPredictionsVerified").textContent = summary.predictionsVerified ?? 0;

        document.getElementById("orExecAccuracy").textContent =
            this.formatPercentage(summary.accuracyObservedPercentage);

        document.getElementById("orExecAccuracyModel").textContent =
            summary.accuracyObservedModel ? `Modelo: ${summary.accuracyObservedModel}` : "Sin datos suficientes";

        document.getElementById("orExecActiveAlerts").textContent = summary.activeAlerts ?? 0;
        document.getElementById("orExecCriticalAlerts").textContent = summary.criticalAlerts ?? 0;
        document.getElementById("orExecActionsEvaluated").textContent = summary.actionsEvaluated ?? 0;
        document.getElementById("orExecCalibrationAlerts").textContent = summary.calibrationAlertsOpen ?? 0;

    }

    // Bloque 1 -- reutiliza tal cual el DTO de ModelAccuracyMetricsService
    // (2.6.1.14), más los campos aditivos de consolidación
    // (predictionsMade/bestModel/worstModel, calculados en
    // OperationalReport.js sin recalcular ningún error).
    renderPredictionPerformance(performance) {

        const empty = document.getElementById("orPredictionEmpty");
        const content = document.getElementById("orPredictionContent");

        if (!performance || !performance.predictionsVerified) {

            empty.style.display = "";
            content.style.display = "none";

            return;

        }

        empty.style.display = "none";
        content.style.display = "";

        document.getElementById("orPredMade").textContent = performance.predictionsMade ?? 0;
        document.getElementById("orPredVerified").textContent = performance.predictionsVerified ?? 0;
        document.getElementById("orPredBestModel").textContent = performance.bestModel || "Sin diferencia concluyente";
        document.getElementById("orPredWorstModel").textContent = performance.worstModel || "—";

        const models =
            (performance.models || []).filter(m => m.sampleSize > 0);

        document.getElementById("orPredModelsBody").innerHTML =
            models.length === 0
                ? `<tr><td colspan="5" class="text-muted">Sin modelos con muestra evaluada en el período.</td></tr>`
                : models.map(model => `
                    <tr>
                        <td>${model.modelType}</td>
                        <td>${model.sampleSize}${model.sampleClassification === "LOW_SAMPLE" ? ' <span class="text-warning" title="Muestra limitada. Resultado descriptivo.">⚠</span>' : ""}</td>
                        <td>${this.formatHours(model.maeHours)}</td>
                        <td>${this.formatHours(model.medianAbsoluteErrorHours)}</td>
                        <td>${this.formatPercentage(model.exactPercentage)}</td>
                    </tr>
                `).join("");

    }

    // Bloque 2 -- fusión, ya hecha por el backend, de
    // CalibrationEffectivenessService.getAllActiveHealth() (2.6.1.18) +
    // ModelAlertService.getSummary() (2.6.1.22) +
    // RecalibrationProposalService.list() (2.6.1.24). Nunca ofrece un
    // flujo de aprobación aquí (sección 4, explícito) -- solo enlaza a
    // los módulos donde ese flujo ya existe.
    renderCalibration(calibration) {

        const empty = document.getElementById("orCalibrationEmpty");
        const content = document.getElementById("orCalibrationContent");

        if (!calibration || !calibration.calibrations || calibration.calibrations.length === 0) {

            empty.style.display = "";
            content.style.display = "none";

            return;

        }

        empty.style.display = "none";
        content.style.display = "";

        const alertsSummary =
            calibration.alertsSummary || { open: 0, acknowledged: 0, resolved: 0 };

        document.getElementById("orCalAlerts").textContent = alertsSummary.open + alertsSummary.acknowledged;
        document.getElementById("orCalProposals").textContent = calibration.pendingProposalsCount ?? 0;
        document.getElementById("orCalActiveCount").textContent = calibration.calibrations.length;

        const healthBadge = health => {

            const map = {

                HEALTHY: '<span class="badge bg-success">HEALTHY</span>',

                WARNING: '<span class="badge bg-warning text-dark">WARNING</span>',

                DEGRADED: '<span class="badge bg-danger">DEGRADED</span>',

                INSUFFICIENT_DATA: '<span class="badge bg-secondary">SIN DATOS SUFICIENTES</span>'

            };

            return map[health] || `<span class="badge bg-secondary">${health || "—"}</span>`;

        };

        document.getElementById("orCalibrationBody").innerHTML =
            calibration.calibrations.map(row => `
                <tr>
                    <td>${row.modelType}</td>
                    <td>${row.product ? row.product.name : "—"}${row.recipe ? ` / ${row.recipe.name}` : ""}</td>
                    <td>v${row.version}</td>
                    <td>${this.formatDate(row.activatedAt)}</td>
                    <td>${healthBadge(row.health)}</td>
                </tr>
            `).join("");

    }

    // Bloque 3 -- reutiliza `summary`/`duration` del DTO de
    // AlertTrendAnalysis.buildTrendDTO() (2.7.0.8) tal cual. Sección 5 --
    // deliberadamente NUNCA clasifica "aumento"/"disminución": solo
    // muestra creadas/resueltas en el período (createdInPeriod/
    // resolvedInPeriod, sumados por OperationalReport.js sobre el
    // timeline ya calculado).
    renderAlerts(alerts) {

        const empty = document.getElementById("orAlertsEmpty");
        const content = document.getElementById("orAlertsContent");

        if (!alerts || alerts.summary.total === 0) {

            empty.style.display = "";
            content.style.display = "none";

            return;

        }

        empty.style.display = "none";
        content.style.display = "";

        document.getElementById("orAlertTotal").textContent = alerts.summary.total ?? 0;
        document.getElementById("orAlertActive").textContent = alerts.summary.active ?? 0;
        document.getElementById("orAlertResolved").textContent = alerts.summary.resolved ?? 0;
        document.getElementById("orAlertCritical").textContent = alerts.summary.critical ?? 0;

        document.getElementById("orAlertAvgDuration").textContent =
            this.formatMinutes(alerts.duration ? alerts.duration.averageMinutes : null);

        document.getElementById("orAlertCreatedResolved").textContent =
            `Creadas: ${alerts.createdInPeriod ?? 0} / Resueltas: ${alerts.resolvedInPeriod ?? 0}`;

    }

    // Bloque 4 -- reutiliza `summary` del DTO de
    // OperationalActionAnalytics.buildAnalyticsDTO() (2.7.0.7) tal cual.
    // Nunca dice "acción exitosa" (sección 6, explícito).
    renderActions(actions) {

        const empty = document.getElementById("orActionsEmpty");
        const content = document.getElementById("orActionsContent");

        if (!actions || actions.summary.total === 0) {

            empty.style.display = "";
            content.style.display = "none";

            return;

        }

        empty.style.display = "none";
        content.style.display = "";

        const summary =
            actions.summary;

        document.getElementById("orActRegistered").textContent = summary.total ?? 0;
        document.getElementById("orActEvaluated").textContent = summary.evaluated ?? 0;
        document.getElementById("orActPending").textContent = summary.pending ?? 0;
        document.getElementById("orActImproved").textContent = summary.improved ?? 0;
        document.getElementById("orActUnchanged").textContent = summary.unchanged ?? 0;
        document.getElementById("orActWorsened").textContent = summary.worsened ?? 0;
        document.getElementById("orActResolved").textContent = summary.resolved ?? 0;

    }

    // Sección 8 -- alertas prioritarias (CRITICAL primero, luego
    // antigüedad, luego severidad -- ya ordenadas por
    // OperationalReport.buildPriorityAlerts()). Cada elemento enlaza al
    // detalle correspondiente (mismo patrón `?openAlertId=` que
    // trends.js, 2.7.0.8).
    renderPriorityAlerts(items) {

        const empty = document.getElementById("orPriorityEmpty");
        const list = document.getElementById("orPriorityList");

        if (!items || items.length === 0) {

            empty.style.display = "";
            list.style.display = "none";

            return;

        }

        empty.style.display = "none";
        list.style.display = "";

        list.innerHTML =
            items.map(item => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>
                        ${this.severityLabel(item.severity)}
                        <strong>${item.batchNumber || "—"}</strong>
                        <span class="text-muted small">Activa desde hace ${this.formatMinutes(item.activeMinutes)}</span>
                    </span>
                    ${item.batchId
                        ? `<a href="/batches/${item.batchId}/measurements?openAlertId=${item.id}" class="btn btn-sm btn-outline-danger">Ver alerta</a>`
                        : ""}
                </li>
            `).join("");

    }

    // Sección 16 -- texto metodológico fijo (OperationalReport.
    // buildMethodologyNotes()), nunca generado en el frontend.
    renderMethodology(notes) {

        const list =
            document.getElementById("orMethodologyList");

        list.innerHTML =
            notes.map(note => `<li>${note}</li>`).join("");

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        window.operationalReportPage =
            new OperationalReportPage();

    }

);
