class MeasurementsPage extends CrudPage {

    constructor(batchId, batchStatus) {

        super(

            new MeasurementApi(batchId),

            new MeasurementForm("measurementForm"),

            new CrudTable(

                "measurementsTableBody",

                [

                    {

                        field: "measurementDate",

                        formatter: value =>

                            value

                                ? new Date(value)
                                    .toLocaleString()

                                : "-"

                    },

                    {

                        field: "phase",

                        formatter: value =>
                            this.renderPhaseBadge(value)

                    },

                    {

                        field: "specificGravity",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "estimatedAlcohol",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "brix",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "ph",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "liquidTemperature",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "brixLafmate",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "ambientTemperature",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "psi",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "co2Volumes",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "notes",

                        formatter: value =>

                            value || "—"

                    }

                ]

            ),

            {

                entityName:
                    "Medición",

                deleteMessage:
                    "¿Desea eliminar esta medición?",

                createdMessage:
                    "Medición registrada correctamente.",

                updatedMessage:
                    "Medición actualizada correctamente.",

                deletedMessage:
                    "Medición eliminada correctamente."

            }

        );

        this.items = [];

        this.batchStatus = batchStatus;

        this.form.form.addEventListener(

            "submit",

            e => this.save(e)

        );

        document

            .getElementById("btnNuevaMedicion")

            .addEventListener(

                "click",

                () => this.form.openNew()

            );

    }

    async load() {

        UI.loading(true);

        try {

            const items =
                await this.api.getAll();

            this.items = items;

            this.table.render(

                items,

                (td, item) =>

                    this.createActions(

                        td,

                        item

                    )

            );

            this.renderSummary();

            await this.renderMaturationPrediction();

        }

        catch (err) {

            UI.error(err.message);

        }

        finally {

            UI.loading(false);

        }

    }

    async edit(id) {

        const measurement =
            this.items.find(

                m => m.id === id

            );

        if (!measurement) {

            UI.error("No se encontró la medición.");

            return;

        }

        this.form.openEdit(measurement);

    }

    renderPhaseBadge(phase) {

        const colors = {

            F1: "secondary",

            F2: "info",

            FINAL: "dark"

        };

        const color =
            colors[phase] ||
            "secondary";

        return `<span class="badge bg-${color}">${phase}</span>`;

    }

    formatValue(value) {

        return (value === null || value === undefined || value === "")
            ? "—"
            : value;

    }

    formatDate(value) {

        return value
            ? new Date(value).toLocaleString()
            : "—";

    }

    formatRange(first, last) {

        return `${this.formatValue(first)} → ${this.formatValue(last)}`;

    }

    renderSummary() {

        const f1 =
            this.items.filter(m => m.phase === "F1");

        const f2 =
            this.items.filter(m => m.phase === "F2");

        const final =
            this.items.filter(m => m.phase === "FINAL");

        this.renderF1Summary(f1);

        this.renderF2Summary(f2);

        this.renderFinalSummary(final);

    }

    renderF1Summary(items) {

        const container =
            document.getElementById("summaryF1");

        if (!container)
            return;

        if (items.length === 0) {

            container.innerHTML =
                `<p class="text-muted mb-0">Sin mediciones F1 registradas.</p>`;

            return;

        }

        const first = items[0];

        const last = items[items.length - 1];

        container.innerHTML = `

            <ul class="list-unstyled small mb-0">

                <li><strong>Primera medición:</strong> ${this.formatDate(first.measurementDate)}</li>

                <li><strong>Última medición:</strong> ${this.formatDate(last.measurementDate)}</li>

                <li><strong>SG:</strong> ${this.formatRange(first.specificGravity, last.specificGravity)}</li>

                <li><strong>°Brix:</strong> ${this.formatRange(first.brix, last.brix)}</li>

                <li><strong>pH:</strong> ${this.formatRange(first.ph, last.ph)}</li>

                <li><strong>Temperatura:</strong> ${this.formatRange(first.liquidTemperature, last.liquidTemperature)}</li>

                <li><strong>Temp. ambiente:</strong> ${this.formatRange(first.ambientTemperature, last.ambientTemperature)}</li>

                <li><strong>Alcohol estimado:</strong> ${this.formatRange(first.estimatedAlcohol, last.estimatedAlcohol)}</li>

            </ul>

        `;

    }

    renderF2Summary(items) {

        const container =
            document.getElementById("summaryF2");

        if (!container)
            return;

        if (this.batchStatus === "F2_SKIPPED") {

            container.innerHTML =
                `<p class="text-warning fw-bold mb-0">Segunda fermentación omitida.</p>`;

            return;

        }

        if (items.length === 0) {

            container.innerHTML =
                `<p class="text-muted mb-0">Sin mediciones F2 registradas.</p>`;

            return;

        }

        const first = items[0];

        const last = items[items.length - 1];

        container.innerHTML = `

            <ul class="list-unstyled small mb-0">

                <li><strong>Primera lectura PSI:</strong> ${this.formatValue(first.psi)}</li>

                <li><strong>Última lectura PSI:</strong> ${this.formatValue(last.psi)}</li>

                <li><strong>Temp. ambiente:</strong> ${this.formatRange(first.ambientTemperature, last.ambientTemperature)}</li>

                <li><strong>CO2 estimado inicial:</strong> ${this.formatValue(first.co2Volumes)}</li>

                <li><strong>CO2 estimado final:</strong> ${this.formatValue(last.co2Volumes)}</li>

                <li><strong>Número de mediciones:</strong> ${items.length}</li>

            </ul>

        `;

    }

    renderFinalSummary(items) {

        const container =
            document.getElementById("summaryFinal");

        if (!container)
            return;

        if (items.length === 0) {

            container.innerHTML =
                `<p class="text-muted mb-0">Sin medición FINAL registrada.</p>`;

            return;

        }

        const last = items[items.length - 1];

        container.innerHTML = `

            <ul class="list-unstyled small mb-0">

                <li><strong>pH:</strong> ${this.formatValue(last.ph)}</li>

                <li><strong>°Brix:</strong> ${this.formatValue(last.brix)}</li>

                <li><strong>SG:</strong> ${this.formatValue(last.specificGravity)}</li>

                <li><strong>Alcohol:</strong> ${this.formatValue(last.estimatedAlcohol)}</li>

                <li><strong>Temperatura:</strong> ${this.formatValue(last.liquidTemperature)}</li>

                <li><strong>Temp. ambiente:</strong> ${this.formatValue(last.ambientTemperature)}</li>

                <li><strong>Observaciones:</strong> ${last.notes || "—"}</li>

            </ul>

        `;

    }

    async renderMaturationPrediction() {

        const container =
            document.getElementById("maturationPrediction");

        if (!container)
            return;

        try {

            const prediction =
                await this.api.getMaturation();

            this.renderMaturationBlock(prediction);

            this.renderMaturationChart(prediction);

        }

        catch (err) {

            container.innerHTML =
                `<p class="text-danger mb-0">No fue posible obtener la predicción: ${err.message}</p>`;

        }

    }

    renderMaturationBlock(prediction) {

        const container =
            document.getElementById("maturationPrediction");

        if (!container)
            return;

        if (!prediction.configured) {

            container.innerHTML =
                `<p class="text-muted mb-0">${prediction.message || "Este lote no tiene configurado un objetivo de maduración en su receta."}</p>`;

            return;

        }

        if (prediction.pointCount < 2) {

            container.innerHTML =
                `<p class="text-muted mb-0">Predicción: insuficientes lecturas de ${prediction.phase} para calcular una proyección.</p>`;

            return;

        }

        const confidenceLabels = {

            INSUFFICIENT: "Insuficiente",

            LOW: "Baja",

            MEDIUM: "Media",

            HIGH: "Alta"

        };

        const statusMap = {

            READY: {

                emoji: "🟢",

                text: "El lote parece estar próximo a su punto de maduración."

            },

            APPROACHING: {

                emoji: "🟡",

                text: "El lote se aproxima al objetivo, pero la tasa de cambio todavía es significativa."

            },

            ACTIVE: {

                emoji: "🔵",

                text: "Fermentación todavía activa."

            }

        };

        const status =
            statusMap[prediction.readinessStatus] || statusMap.ACTIVE;

        const hoursFromNow = isoDate => {

            if (!isoDate)
                return null;

            return (new Date(isoDate).getTime() - Date.now()) / (60 * 60 * 1000);

        };

        const formatHours = hours => {

            if (hours === null || hours === undefined || Number.isNaN(hours))
                return "—";

            if (hours < 0)
                return "ya alcanzado";

            return `~${Math.round(hours)} h`;

        };

        const exponential =
            prediction.exponential || {};

        const linear =
            prediction.linear || null;

        const exponentialHours =
            hoursFromNow(exponential.eta);

        const linearLine =
            linear && linear.divergent
                ? `<li><strong>ETA lineal:</strong> la tendencia actual se aleja del objetivo — no se puede estimar una ETA confiable.</li>`
                : `<li><strong>ETA lineal:</strong> ${formatHours(linear ? linear.hoursRemaining : null)}</li>`;

        const exponentialLine =
            exponential.reachable === false
                ? `<li><strong>ETA exponencial:</strong> objetivo probablemente no alcanzable (plateau estimado ${this.formatValue(exponential.asymptote)})</li>`
                : `<li><strong>ETA exponencial:</strong> ${formatHours(exponentialHours)}</li>`;

        // Entrega 2.6.1.1 — comparación de modelos. Consume directamente
        // prediction.comparison/linear.rmse/exponential.rmse tal como los
        // entrega el backend; no se recalcula nada aquí.
        const comparison =
            prediction.comparison || { recommendedModel: null, confidence: "INSUFFICIENT" };

        const modelLabels = {

            LINEAR: "Lineal",

            EXPONENTIAL: "Exponencial"

        };

        const formatMetric = value =>
            value === null || value === undefined ? "—" : value;

        const linearEtaLabel =
            linear && linear.divergent
                ? "diverge"
                : formatHours(linear ? linear.hoursRemaining : null);

        const exponentialEtaLabel =
            exponential.reachable === false
                ? "no alcanzable"
                : formatHours(exponentialHours);

        const comparisonBlock = `

            <hr>

            <p class="fw-bold mb-2">Comparación de modelos</p>

            <table class="table table-sm table-bordered mb-2">

                <thead>

                    <tr><th>Modelo</th><th>RMSE</th><th>R²</th><th>ETA</th></tr>

                </thead>

                <tbody>

                    <tr>

                        <td>Lineal</td>

                        <td>${formatMetric(linear ? linear.rmse : null)}</td>

                        <td>${formatMetric(linear ? linear.r2 : null)}</td>

                        <td>${linearEtaLabel}</td>

                    </tr>

                    <tr>

                        <td>Exponencial</td>

                        <td>${formatMetric(exponential.rmse)}</td>

                        <td>${formatMetric(exponential.r2)}</td>

                        <td>${exponentialEtaLabel}</td>

                    </tr>

                </tbody>

            </table>

            ${comparison.recommendedModel
                ? `<p class="mb-0">Modelo recomendado: <strong>${modelLabels[comparison.recommendedModel] || comparison.recommendedModel}</strong><br>Confianza: ${confidenceLabels[comparison.confidence] || comparison.confidence}</p>`
                : `<p class="text-muted mb-0">No existe un modelo claramente superior con los datos disponibles.</p>`}

        `;

        container.innerHTML = `

            <ul class="list-unstyled small mb-3">

                <li><strong>Variable:</strong> ${prediction.metric}</li>

                <li><strong>Actual:</strong> ${this.formatValue(prediction.currentValue)}</li>

                <li><strong>Objetivo:</strong> ${this.formatValue(prediction.targetValue)}</li>

                <li><strong>Tasa actual:</strong> ${this.formatValue(prediction.rate)} ${prediction.metric}/h</li>

                <li><strong>Umbral:</strong> ${this.formatValue(prediction.rateThreshold)} ${prediction.metric}/h</li>

                ${linearLine}

                ${exponentialLine}

                <li><strong>Plateau estimado:</strong> ${this.formatValue(exponential.asymptote)}</li>

                <li><strong>Confianza:</strong> ${confidenceLabels[exponential.confidence] || "—"}</li>

            </ul>

            <p class="mb-0">${status.emoji} ${status.text}</p>

            ${prediction.readyForF1Finish ? `<p class="mb-0 fw-bold">El lote puede ser evaluado para finalizar F1.</p>` : ""}

            ${comparisonBlock}

        `;

    }

    renderMaturationChart(prediction) {

        const canvas =
            document.getElementById("maturationChart");

        const messageEl =
            document.getElementById("maturationChartMessage");

        if (!canvas)
            return;

        if (!prediction.configured) {

            canvas.style.display = "none";

            if (messageEl) {

                messageEl.textContent =
                    prediction.message || "Este lote no tiene configurado un objetivo de maduración en su receta.";

                messageEl.style.display = "block";

            }

            if (MaturationChart.instance) {

                MaturationChart.instance.destroy();

                MaturationChart.instance = null;

            }

            return;

        }

        // Mapa de presentación por métrica — la gráfica en sí (MaturationChart)
        // no conoce "pH" ni "Brix": esto es lo único que habría que extender
        // al agregar Kombucha (Brix/SG) más adelante.
        const metricMeta = {

            ph: { label: "pH", unit: "" },

            brix: { label: "°Brix", unit: "°Bx" },

            specificGravity: { label: "SG", unit: "" }

        };

        const meta =
            metricMeta[prediction.metric] || { label: prediction.metric, unit: "" };

        MaturationChart.render({

            canvasId: "maturationChart",

            messageElementId: "maturationChartMessage",

            metric: prediction.metric,

            label: meta.label,

            unit: meta.unit,

            target: prediction.targetValue,

            measurements: this.items,

            prediction

        });

    }

    createActions(td, measurement) {

        const btnEdit =

            document.createElement("button");

        btnEdit.className =

            "btn btn-info btn-sm me-2";

        btnEdit.textContent =

            "Editar";

        btnEdit.onclick =

            () => this.edit(measurement.id);

        td.appendChild(btnEdit);

        const btnDelete =

            document.createElement("button");

        btnDelete.className =

            "btn btn-danger btn-sm";

        btnDelete.textContent =

            "Eliminar";

        btnDelete.onclick =

            () => this.remove(measurement.id);

        td.appendChild(btnDelete);

    }

}
document.addEventListener(

    "DOMContentLoaded",

    async () => {

        window.measurementsPage =

            new MeasurementsPage(window.BATCH_ID, window.BATCH_STATUS);

        await window.measurementsPage.load();

    }

);
