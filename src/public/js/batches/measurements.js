/*
 * Entrega 2.6.1.26, sección 3 -- mismos colores que
 * CALIBRATION_STATUS_BADGES en src/public/js/maturation/calibrations.js
 * (no se importa esa constante porque cada página carga sus propios
 * scripts de forma independiente, sin bundler -- se duplica el mapeo,
 * no la lógica).
 */
const CALIBRATION_USED_STATUS_BADGES = {

    PROPOSED: "secondary",

    APPROVED: "info",

    ACTIVE: "success",

    INACTIVE: "dark",

    REJECTED: "danger"

};

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

                        formatter: (value, item) =>

                            this.hydrometerCellHtml(value, item, "SG")

                    },

                    {

                        field: "estimatedAlcohol",

                        formatter: (value, item) =>

                            this.hydrometerCellHtml(value, item, "ALCOHOL")

                    },

                    {

                        field: "brix",

                        formatter: (value, item) =>

                            this.hydrometerCellHtml(value, item, "BRIX")

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

        // Entrega 2.6.1.12 -- trazabilidad de predicciones. predictionHistory
        // se cachea tras el primer load() para no repetir la petición al
        // abrir el modal de historial (el detalle sigue pidiéndose siempre
        // fresco, por registro).
        this.predictionApi =
            new PredictionApi(batchId);

        this.predictionHistory = [];

        // Entrega 2.7.0.2, secciones 7/8 -- resumen de convergencia
        // (predicción inicial/intermedia/final vs. tendencia),
        // recibido junto con el historial en cada renderCurrentPrediction().
        this.predictionConvergence = null;

        this.predictionDetailModal =
            bootstrap.Modal.getOrCreateInstance(

                document.getElementById("modalPredictionDetail")

            );

        this.predictionHistoryModal =
            bootstrap.Modal.getOrCreateInstance(

                document.getElementById("modalPredictionHistory")

            );

        // Entrega 2.7.0.3 -- alertas de desviación de la fermentación.
        this.predictionActiveAlert =
            null;

        this.predictionAlertHistory =
            [];

        this.predictionAlertHistoryModal =
            bootstrap.Modal.getOrCreateInstance(

                document.getElementById("modalPredictionAlertHistory")

            );

        // Entrega 2.7.0.5 -- registro de acciones operativas ante una
        // alerta concreta (historial + formulario, dentro del mismo
        // modal -- ver comentario de cabecera de openAlertActionModal()).
        this.currentActionAlert =
            null;

        this.alertActionModal =
            bootstrap.Modal.getOrCreateInstance(

                document.getElementById("modalAlertAction")

            );

        document

            .getElementById("btnSaveAlertAction")

            .addEventListener(

                "click",

                () => this.handleSaveAlertAction()

            );

        document

            .getElementById("alertActionType")

            .addEventListener(

                "change",

                () => this.updateAlertActionDescriptionHint()

            );

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

        document

            .getElementById("btnPredictionHistory")

            .addEventListener(

                "click",

                () => this.openPredictionHistory()

            );

        document

            .getElementById("btnPredictionAlertHistory")

            .addEventListener(

                "click",

                () => this.openPredictionAlertHistory()

            );

    }

    async load() {

        UI.loading(true);

        try {

            const items =
                await this.api.getAll();

            this.items = items;

            await this.loadHydrometerTableLabels();

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

            await this.renderMaturationEvaluation();

            await this.renderCurrentPrediction();

            await this.renderPredictionAlert();

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

    /*
     * Entrega 2.8.0.3, sección 6/8 -- resuelve id de tabla -> "nombre
     * vN" para TODAS las tablas existentes de una sola vez (en vez de
     * una consulta por fila del historial), usado por
     * `hydrometerCellHtml()` de abajo. Falla en silencio -- puramente
     * informativo, nunca bloquea la carga del historial de mediciones
     * si la API de tablas no responde.
     */
    async loadHydrometerTableLabels() {

        this._hydrometerTableLabels = {};

        try {

            const response =
                await Api.get("/api/hydrometer/tables");

            (response.data || []).forEach(table => {

                this._hydrometerTableLabels[table.id] =
                    `${table.name} v${table.version}`;

            });

        } catch (err) {

            // Puramente informativo -- ver comentario de arriba.

        }

    }

    /*
     * Entrega 2.8.0.3, sección 6/8 -- "5.6 °Bx ⓘ Estimado" en el
     * historial cronológico: distingue, celda por celda, la lectura que
     * el operador realmente tecleó (sin indicador, es un dato medido)
     * de los otros dos valores derivados por conversión (con indicador
     * y tooltip -- "Calculado a partir de: SG 1.022 · Método:
     * Interpolación lineal · Tabla: Brewer's Elite v1"). Mediciones
     * manuales (hydrometerConversionMethod null o "MANUAL") nunca
     * muestran el indicador -- son lecturas directas, no estimaciones.
     */
    hydrometerCellHtml(value, item, fieldScale) {

        const formatted =
            this.formatValue(value);

        if (!item.hydrometerConversionMethod || item.hydrometerConversionMethod === "MANUAL") {

            return formatted;

        }

        if (item.hydrometerInputScale === fieldScale) {

            // Esta es la escala que el operador realmente tecleó -- un
            // dato medido, no una estimación, aunque la medición en
            // conjunto haya usado conversión automática.
            return formatted;

        }

        const tableLabel =
            (this._hydrometerTableLabels || {})[item.hydrometerConversionTableId] || null;

        const methodLabel =
            item.hydrometerConversionMethod === "TABLE_EXACT"
                ? "Tabla del fabricante (valor exacto)"
                : "Interpolación lineal";

        const title =
            `Calculado a partir de: ${item.hydrometerInputScale} ${item.hydrometerInputValue} · Método: ${methodLabel} · Tabla: ${tableLabel || "—"}`;

        return `${formatted} <span class="badge bg-info text-dark" title='${title}' style="cursor:help;">ⓘ Estimado</span>`;

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

        // Entrega 2.6.1.11 — modelo ACTIVE configurado para la receta de
        // este lote (no confundir con "recomendado": el activo es el
        // que el usuario aprobó explícitamente para producción, ver
        // /maturation/statistics). Solo informativo aquí.
        const activeModelBlock =
            prediction.activeModel
                ? `<p class="mb-0 mt-2"><span class="badge bg-primary">Modelo activo: ${modelLabels[prediction.activeModel] || prediction.activeModel}</span></p>`
                : `<p class="mb-0 mt-2"><span class="badge bg-secondary">Sin modelo activo configurado para esta receta</span></p>`;

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

            ${activeModelBlock}

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

    async renderMaturationEvaluation() {

        const container =
            document.getElementById("maturationEvaluation");

        if (!container)
            return;

        try {

            const evaluation =
                await this.api.getMaturationEvaluation();

            this.renderMaturationEvaluationBlock(evaluation);

        }

        catch (err) {

            container.innerHTML =
                `<p class="text-danger mb-0">No fue posible obtener la evaluación histórica: ${err.message}</p>`;

        }

    }

    renderMaturationEvaluationBlock(evaluation) {

        const container =
            document.getElementById("maturationEvaluation");

        if (!container)
            return;

        if (!evaluation.configured) {

            container.innerHTML =
                `<p class="text-muted mb-0">${evaluation.message || "Este lote no tiene configurado un objetivo de maduración en su receta."}</p>`;

            return;

        }

        // Entrega 2.6.1.2 — esto es una evaluación RETROSPECTIVA: compara
        // lo que los modelos habrían predicho usando solo los datos
        // disponibles antes de que el lote alcanzara el objetivo, contra
        // el momento en que realmente lo alcanzó. No es la predicción
        // actual del lote (esa vive en el bloque "Predicción de maduración"
        // de arriba).
        const intro =
            `<p class="text-muted small mb-3">Evaluación retrospectiva: compara lo que los modelos habrían predicho con datos previos, contra lo que realmente ocurrió. No es una predicción del estado actual del lote.</p>`;

        if (evaluation.targetReached === null) {

            container.innerHTML =
                intro +
                `<p class="mb-0">No se puede determinar si el lote alcanzó el objetivo: no hay suficientes mediciones o no hay un objetivo configurado.</p>`;

            return;

        }

        if (evaluation.targetReached === false) {

            container.innerHTML =
                intro +
                `<p class="mb-0">El lote no alcanzó el objetivo (${this.formatValue(evaluation.target)}) con las mediciones registradas.</p>`;

            return;

        }

        const reasonLabels = {

            insufficient_data: "No hubo suficientes datos",

            no_target_configured: "No hay objetivo configurado",

            trend_diverging: "La tendencia se alejaba del objetivo",

            model_not_available: "El modelo no pudo generar una ETA",

            model_not_fitted: "El modelo no pudo ajustarse",

            target_not_reachable: "El modelo determinó que el objetivo no era alcanzable",

            target_not_reached: "El lote terminó antes de alcanzar el objetivo"

        };

        const formatModelRow = (name, model) => {

            if (!model || model.status !== "EVALUATED") {

                const reason =
                    model ? (reasonLabels[model.reason] || model.reason || "No evaluable") : "No evaluable";

                return `<tr><td>${name}</td><td colspan="3" class="text-muted">${reason}</td></tr>`;

            }

            return `

                <tr>

                    <td>${name}</td>

                    <td>${this.formatValue(model.predictedHours)} h</td>

                    <td>${this.formatValue(model.actualHours)} h</td>

                    <td>${this.formatValue(model.absoluteErrorHours)} h</td>

                </tr>

            `;

        };

        const linearEvaluated =
            evaluation.linear && evaluation.linear.status === "EVALUATED";

        const exponentialEvaluated =
            evaluation.exponential && evaluation.exponential.status === "EVALUATED";

        let bestPredictionLine = "";

        if (linearEvaluated && exponentialEvaluated) {

            const best =
                evaluation.linear.absoluteErrorHours <= evaluation.exponential.absoluteErrorHours
                    ? "lineal"
                    : "exponencial";

            bestPredictionLine =
                `<p class="mb-0"><strong>Mejor predicción:</strong> el modelo ${best} tuvo menor error.</p>`;

        } else if (linearEvaluated || exponentialEvaluated) {

            const which =
                linearEvaluated ? "lineal" : "exponencial";

            bestPredictionLine =
                `<p class="mb-0"><strong>Mejor predicción:</strong> solo el modelo ${which} pudo evaluarse.</p>`;

        } else {

            bestPredictionLine =
                `<p class="text-muted mb-0">Ninguno de los dos modelos pudo evaluarse retrospectivamente.</p>`;

        }

        container.innerHTML =
            intro +
            `
            <ul class="list-unstyled small mb-3">

                <li><strong>Objetivo:</strong> ${this.formatValue(evaluation.target)}</li>

                <li><strong>Objetivo alcanzado:</strong> Sí</li>

                <li><strong>Alcanzado a las:</strong> ${this.formatValue(evaluation.targetReachedHours)} h (${this.formatDate(evaluation.targetReachedAt)})</li>

            </ul>

            <table class="table table-sm table-bordered mb-2">

                <thead>

                    <tr><th>Modelo</th><th>ETA predicho</th><th>Momento real</th><th>Error absoluto</th></tr>

                </thead>

                <tbody>

                    ${formatModelRow("Lineal", evaluation.linear)}

                    ${formatModelRow("Exponencial", evaluation.exponential)}

                </tbody>

            </table>

            ${bestPredictionLine}
        `;

    }

    /*
     * Entrega 2.6.1.12 -- "Predicción actual (auditable)": distinta del
     * bloque analítico "Predicción de maduración F1" de arriba (que
     * recalcula en vivo en cada carga de página, sección 2.6.1.0-2.6.1.1).
     * Esta tarjeta muestra la ÚLTIMA fila persistida (isCurrent=true) de
     * MaturationPrediction -- la fotografía trazable de qué modelo/
     * configuración/datos produjeron esa predicción exacta, generada
     * automáticamente al registrar mediciones F1 (nunca en cada GET).
     */
    async renderCurrentPrediction() {

        const container =
            document.getElementById("currentPrediction");

        if (!container)
            return;

        try {

            // Entrega 2.6.1.13: getBatchAnalysis() es superconjunto de
            // getHistory() -- trae las mismas predicciones (en orden
            // cronológico ascendente) YA evaluadas contra la maduración
            // real del lote (batch.finishedAt), así que una sola
            // llamada alimenta tanto la tarjeta "actual" como el
            // historial con sus columnas Real/Error/Dirección.
            const analysis =
                await this.predictionApi.getBatchAnalysis();

            this.predictionHistory =
                analysis.predictions || [];

            this.predictionActual =
                analysis.actual || { maturationAt: null };

            // Entrega 2.7.0.2, secciones 7/8 -- ver comentario del
            // constructor.
            this.predictionConvergence =
                analysis.convergence || null;

            // Entrega 2.7.0.1 -- estado operativo en vivo (rango de
            // confianza / cerca del límite / fuera de predicción, más
            // alerta de deriva), cargado junto con el historial. Falla
            // en silencio (indicador puramente informativo, mismo
            // criterio que loadCalibrationHealthWarning() más abajo) --
            // nunca bloquea el resto de la tarjeta si este endpoint no
            // responde.
            try {

                this.operationalStatus =
                    await this.predictionApi.getOperationalStatus();

            } catch (err) {

                this.operationalStatus = null;

            }

            this.renderCurrentPredictionBlock();

        }

        catch (err) {

            container.innerHTML =
                `<p class="text-danger mb-0">No fue posible obtener la predicción auditable: ${err.message}</p>`;

        }

    }

    modelLabel(modelType) {

        const labels = {

            LINEAR: "Lineal",

            EXPONENTIAL: "Exponencial"

        };

        return labels[modelType] || modelType || "—";

    }

    /*
     * Entrega 2.6.1.13 -- etiqueta en español para la dirección del
     * error (sección 7). Mantiene distinguibles PENDING/UNAVAILABLE de
     * un resultado evaluado (criterios de aceptación: "no debemos
     * considerar una diferencia de minutos como error" y "PENDING ≠
     * EXACT").
     */
    directionLabel(direction) {

        const labels = {

            EARLY: "Adelantada",

            LATE: "Retrasada",

            EXACT: "Exacta"

        };

        return labels[direction] || "—";

    }

    /*
     * Renderiza, para UNA predicción ya evaluada (objeto con
     * status/errorHours/absoluteErrorHours/direction, sea que venga de
     * getBatchAnalysis() o de detail.evaluation), las celdas/textos de
     * "Real" y "Error" -- centraliza la distinción PENDING/UNAVAILABLE/
     * EVALUATED para que la tarjeta, el historial y el detalle nunca
     * la repitan de forma inconsistente.
     */
    evaluationRealText(evaluation, actualMaturationAt) {

        if (evaluation.status === "PENDING") {

            return "Pendiente (F1 no finalizado)";

        }

        if (evaluation.status === "UNAVAILABLE") {

            return "No disponible";

        }

        return this.formatDate(actualMaturationAt);

    }

    evaluationErrorText(evaluation) {

        if (evaluation.status === "PENDING") {

            return "Pendiente";

        }

        if (evaluation.status === "UNAVAILABLE") {

            return "—";

        }

        const sign =
            evaluation.errorHours > 0 ? "+" : "";

        return `${sign}${evaluation.errorHours} h`;

    }

    /*
     * Entrega 2.6.1.16 -- "Predicción calibrada" (sección 15): nunca
     * esconde la predicción original. `calibration` viene ya resuelto
     * por el backend (MaturationPredictionService._serializeCalibration())
     * -- este archivo solo lo presenta, nunca decide si una predicción
     * "debería" estar calibrada.
     */
    calibrationBadgeHtml(calibration) {

        if (!calibration || !calibration.applied) {

            return "";

        }

        return `<span class="badge bg-info ms-1" title="Predicción calibrada">Calibrada</span>`;

    }

    calibrationDetailBlockHtml(calibration) {

        if (!calibration || !calibration.applied) {

            return "";

        }

        const sign =
            calibration.offsetHours > 0 ? "+" : "";

        return `

            <p class="fw-bold mb-1">Predicción calibrada</p>

            <ul class="list-unstyled small mb-3">

                <li><strong>Predicción original (sin calibrar):</strong> ${this.formatDate(calibration.rawPredictedMaturationAt)}</li>

                <li><strong>Offset aplicado:</strong> ${sign}${calibration.offsetHours} h (calibración #${calibration.calibrationId})</li>

                <li><strong>Predicción final:</strong> ${this.formatDate(calibration.finalPredictedMaturationAt)}</li>

            </ul>

            ${this.calibrationUsedBlockHtml(calibration)}

        `;

    }

    /*
     * Entrega 2.6.1.26, secciones 1/3/4 -- "Calibración utilizada".
     * `calibrationId` es la referencia INMUTABLE (nunca cambia aunque
     * esta calibración deje de ser la ACTIVE más adelante, sección 2) --
     * este bloque, en cambio, muestra deliberadamente el estado ACTUAL
     * de esa calibración (`calibration.record.status`), que puede
     * legítimamente ser INACTIVE si ya fue reemplazada por una versión
     * más nueva (sección 3, criterio de aceptación explícito: "es
     * válido que la calibración usada aparezca como INACTIVE"). Nunca
     * se recalcula ni se "actualiza" la predicción por esto -- solo se
     * informa qué versión se usó y en qué estado está hoy.
     *
     * `calibration.record` viene del backend (MaturationPredictionService.
     * _serializeCalibration(), 2.6.1.26) y puede ser null si el
     * repositorio no pudo resolver la fila de calibración (nunca debería
     * pasar en la práctica, ya que calibrationId solo se estampa cuando
     * existía una calibración ACTIVE real -- pero se contempla de todos
     * modos para no romper la tarjeta si algún día faltara el join).
     */
    calibrationUsedBlockHtml(calibration) {

        const record =
            calibration.record;

        if (!record) {

            return "";

        }

        const link =
            `/maturation/calibrations?openVersionsId=${record.id}`;

        return `

            <ul class="list-unstyled small mb-3">

                <li><strong>Calibración utilizada:</strong> #${record.id} (v${this.formatValue(record.version)})</li>

                <li><strong>Estado de calibración:</strong> <span class="badge bg-${CALIBRATION_USED_STATUS_BADGES[record.status] || "secondary"}">${record.status}</span></li>

                <li><strong>Fecha de calibración:</strong> ${this.formatDate(record.createdAt)}</li>

                <li><a href="${link}" target="_blank" rel="noopener">Ver detalle completo de esta calibración →</a></li>

            </ul>

        `;

    }

    /*
     * Entrega 2.6.1.18, sección 18 -- indicador de que la predicción
     * usa una calibración cuya salud ACTUAL (no la que tenía cuando se
     * generó la predicción) es WARNING o DEGRADED. Deliberado: la
     * predicción SIGUE usando esa calibración de todos modos -- este
     * bloque solo informa, nunca oculta ni recalcula la ETA (criterio
     * de aceptación explícito). Los textos son exactamente los del
     * mockup de esa sección -- no se redactan variantes.
     */
    calibrationHealthWarningHtml(health) {

        if (!health || (health.health !== "WARNING" && health.health !== "DEGRADED")) {

            return "";

        }

        const message =
            health.health === "DEGRADED"
                ? "⚠ Esta predicción utiliza una calibración con desempeño degradado."
                : "⚠ Esta predicción utiliza una calibración cuyo desempeño reciente está disminuyendo.";

        const alertClass =
            health.health === "DEGRADED" ? "alert-danger" : "alert-warning";

        return `<div class="alert ${alertClass} small py-2 px-3 mb-3">${message}</div>`;

    }

    /*
     * Fetch perezoso: solo se llama cuando `calibration.applied` es
     * true (sección 18 -- nunca se pide la salud de una calibración
     * que ni siquiera se está usando). Si el fetch falla, el bloque
     * simplemente queda vacío -- nunca bloquea ni ensucia el resto de
     * la tarjeta/detalle con un mensaje de error por un indicador que
     * es puramente informativo.
     */
    async loadCalibrationHealthWarning(calibrationId, containerId) {

        try {

            const health =
                await this.predictionApi.getCalibrationHealth(calibrationId);

            const container =
                document.getElementById(containerId);

            if (container) {

                container.innerHTML =
                    this.calibrationHealthWarningHtml(health);

            }

        } catch (err) {

            // Indicador puramente informativo -- ver comentario de
            // arriba, silencioso a propósito.

        }

    }

    /*
     * Entrega 2.7.0.1, sección 3 -- 🟢 EN RANGO / 🟡 CERCA DEL LÍMITE /
     * 🔴 FUERA DE PREDICCIÓN. Presenta tal cual el `code`/`label`/`emoji`
     * que ya calculó `BatchOperationalStatus.classifyRangeStatus()` en
     * el backend -- este archivo nunca decide el estado, solo lo pinta.
     */
    rangeStatusBadgeHtml(rangeStatus) {

        if (!rangeStatus || rangeStatus.code === "UNAVAILABLE") {

            return "";

        }

        const classes = {

            IN_RANGE: "success",

            NEAR_LIMIT: "warning",

            OUT_OF_RANGE: "danger"

        };

        return `<span class="badge bg-${classes[rangeStatus.code] || "secondary"} fs-6 mb-2">${rangeStatus.emoji} ${rangeStatus.label}</span>`;

    }

    /*
     * Sección 1 -- "Rango esperado" / "Confianza". Sin evidencia
     * histórica suficiente todavía (lote/modelo nuevo), se explica por
     * qué en vez de mostrar un guion sin contexto.
     */
    confidenceWindowHtml(confidence) {

        if (!confidence || !confidence.applicable) {

            return `<li><strong>Rango esperado:</strong> <span class="text-muted">Sin evidencia histórica suficiente todavía</span></li>`;

        }

        return `
            <li><strong>Rango esperado:</strong> ${this.formatDate(confidence.lowerBound)} – ${this.formatDate(confidence.upperBound)}</li>
            <li><strong>Confianza:</strong> ${confidence.confidencePercentage}%</li>
        `;

    }

    /*
     * Sección 6 -- alerta OPERATIVA (deriva entre las dos predicciones
     * vigentes más recientes del lote), deliberadamente distinta de las
     * alertas de degradación del modelo (2.6.1.21/28, que viven en
     * /maturation/alerts) -- nunca se mezclan ni se muestran en el mismo
     * bloque (sección 7).
     */
    driftAlertHtml(status) {

        if (!status || !status.applicable || !status.drift || status.drift.code !== "SIGNIFICANT" || !status.previous || !status.current) {

            return "";

        }

        const directionText =
            status.drift.direction === "SLOWER"
                ? "La fermentación está avanzando más lentamente de lo esperado."
                : "La fermentación está avanzando más rápido de lo esperado.";

        return `
            <div class="alert alert-warning small py-2 px-3 mb-3">
                <strong>⚠ Desviación operativa</strong><br>
                ${directionText}<br>
                Predicción anterior: ${this.formatDate(status.previous.predictedMaturationAt)} — Nueva estimación: ${this.formatDate(status.current.predictedMaturationAt)}
            </div>
        `;

    }

    renderCurrentPredictionBlock() {

        const container =
            document.getElementById("currentPrediction");

        if (!container)
            return;

        const current =
            (this.predictionHistory || []).find(p => p.isCurrent);

        if (!current) {

            // Entrega 2.7.0.2, sección 9 -- "Predicción: NO DISPONIBLE"
            // / "Predicción: ESPERANDO DATOS", tal como ya lo distingue
            // operationalStatus.reason (BatchOperationalPredictionService,
            // misma llamada que alimenta el badge/alerta de arriba).
            const reason =
                (this.operationalStatus || {}).reason || null;

            const message =
                reason === "ESPERANDO_DATOS"
                    ? "Predicción: ESPERANDO DATOS. Todavía no hay mediciones F1 registradas para este lote."
                    : reason === "NO_DISPONIBLE"
                        ? "Predicción: NO DISPONIBLE. Hay mediciones registradas, pero todavía no fue posible generar una predicción (verifique que exista un modelo activo configurado para la receta)."
                        : "Todavía no se ha generado ninguna predicción auditable para este lote. Se genera automáticamente al registrar una medición F1, siempre que exista un modelo activo configurado para la receta.";

            container.innerHTML =
                `<p class="text-muted mb-0">${message}</p>`;

            return;

        }

        // Entrega 2.6.1.13 -- Predicción vs. Real, directamente en la
        // tarjeta principal (criterio de aceptación: "la interfaz
        // muestre Predicción vs. Real" / "muestre el error").
        const actualMaturationAt =
            (this.predictionActual || {}).maturationAt ?? null;

        const evaluation = {

            status: current.status,

            errorHours: current.errorHours,

            absoluteErrorHours: current.absoluteErrorHours,

            direction: current.direction

        };

        const evaluationLine =
            evaluation.status === "EVALUATED"
                ? `<li><strong>Dirección:</strong> ${this.directionLabel(evaluation.direction)}</li>`
                : "";

        const operational =
            this.operationalStatus;

        container.innerHTML = `

            ${operational ? this.rangeStatusBadgeHtml(operational.rangeStatus) : ""}

            ${operational ? this.driftAlertHtml(operational) : ""}

            <ul class="list-unstyled small mb-3">

                <li><strong>ETA predicha:</strong> ${this.formatDate(current.predictedMaturationAt)} ${this.calibrationBadgeHtml(current.calibration)}</li>

                <li><strong>Modelo:</strong> ${this.modelLabel(current.modelType)}</li>

                <li><strong>Predicción generada:</strong> ${this.formatDate(current.predictedAt)}</li>

                <li><strong>Duración estimada:</strong> ${this.formatValue(current.predictedDurationHours)} h</li>

                ${this.confidenceWindowHtml(current.confidence)}

                <li><strong>Maduración real:</strong> ${this.evaluationRealText(evaluation, actualMaturationAt)}</li>

                <li><strong>Error:</strong> ${this.evaluationErrorText(evaluation)}</li>

                ${evaluationLine}

            </ul>

            ${this.calibrationDetailBlockHtml(current.calibration)}

            <div id="currentPredictionCalibrationHealthWarning"></div>

            <button type="button" class="btn btn-outline-primary btn-sm" id="btnPredictionDetail">
                Ver detalle
            </button>

        `;

        document

            .getElementById("btnPredictionDetail")

            .addEventListener(

                "click",

                () => this.openPredictionDetail(current.id)

            );

        if (current.calibration && current.calibration.applied) {

            this.loadCalibrationHealthWarning(current.calibration.calibrationId, "currentPredictionCalibrationHealthWarning");

        }

    }

    /*
     * Entrega 2.7.0.2, secciones 7/8 -- "CONVERGENCIA DE LA PREDICCIÓN":
     * presenta tal cual el resumen que ya calculó
     * PredictionConvergence.summarize() en el backend (predicción
     * inicial/intermedia/final con su error absoluto, más la
     * tendencia) -- este archivo nunca decide ni recalcula nada, solo
     * lo pinta, mismo criterio que rangeStatusBadgeHtml()/driftAlertHtml()
     * de 2.7.0.1.
     */
    convergenceBlockHtml(convergence) {

        if (!convergence || !convergence.applicable) {

            return `<p class="text-muted small mb-0">Convergencia: sin suficientes predicciones evaluadas todavía (el lote debe finalizar F1 para poder comparar contra el resultado real).</p>`;

        }

        const trendLabels = {

            MEJORANDO: "MEJORANDO",

            EMPEORANDO: "EMPEORANDO",

            ESTABLE: "ESTABLE",

            INSUFFICIENT_DATA: "Datos insuficientes"

        };

        const errorLine = (label, point) =>

            point
                ? `<li><strong>${label}:</strong> ±${point.absoluteErrorHours} h (${this.formatDate(point.predictedAt)})</li>`
                : "";

        return `

            <p class="fw-bold mb-1 mt-3">Convergencia de la predicción</p>

            <ul class="list-unstyled small mb-0">

                ${errorLine("Predicción inicial", convergence.initial)}

                ${errorLine("Predicción intermedia", convergence.intermediate)}

                ${errorLine("Predicción final", convergence.final)}

                <li><strong>Tendencia:</strong> ${trendLabels[convergence.trend] || convergence.trend}</li>

            </ul>

        `;

    }

    openPredictionHistory() {

        this.renderPredictionHistoryBody();

        const convergenceContainer =
            document.getElementById("predictionConvergenceBlock");

        if (convergenceContainer) {

            convergenceContainer.innerHTML =
                this.convergenceBlockHtml(this.predictionConvergence);

        }

        this.predictionHistoryModal.show();

    }

    renderPredictionHistoryBody() {

        const tbody =
            document.getElementById("predictionHistoryBody");

        if (!tbody)
            return;

        const history =
            this.predictionHistory || [];

        if (history.length === 0) {

            tbody.innerHTML =
                `<tr><td colspan="9" class="text-muted">Sin predicciones registradas.</td></tr>`;

            return;

        }

        const actualMaturationAt =
            (this.predictionActual || {}).maturationAt ?? null;

        tbody.innerHTML =
            history

                .map(p => {

                    const evaluation = {

                        status: p.status,

                        errorHours: p.errorHours,

                        absoluteErrorHours: p.absoluteErrorHours,

                        direction: p.direction

                    };

                    const directionCell =
                        evaluation.status === "EVALUATED"
                            ? this.directionLabel(evaluation.direction)
                            : "—";

                    // Entrega 2.7.0.1, sección 5 -- columna "Ventana"
                    // del historial, para poder observar si la
                    // predicción se fue acercando correctamente al
                    // resultado real conforme se estrechaba la ventana.
                    const windowCell =
                        p.confidence && p.confidence.applicable
                            ? `±${(p.confidence.windowHours / 2).toFixed(1)} h`
                            : "—";

                    return `

                    <tr>

                        <td>${this.formatDate(p.predictedAt)}</td>

                        <td>${this.modelLabel(p.modelType)}</td>

                        <td>${this.formatDate(p.predictedMaturationAt)} ${this.calibrationBadgeHtml(p.calibration)}</td>

                        <td>${windowCell}</td>

                        <td>${this.evaluationRealText(evaluation, actualMaturationAt)}</td>

                        <td>${this.evaluationErrorText(evaluation)}</td>

                        <td>${directionCell}</td>

                        <td>${p.isCurrent ? '<span class="badge bg-success">Vigente</span>' : "—"}</td>

                        <td><button type="button" class="btn btn-outline-primary btn-sm" data-prediction-id="${p.id}">Ver detalle</button></td>

                    </tr>

                `;

                })

                .join("");

        tbody

            .querySelectorAll("button[data-prediction-id]")

            .forEach(btn => {

                btn.addEventListener(

                    "click",

                    () => this.openPredictionDetail(Number(btn.dataset.predictionId))

                );

            });

    }

    /*
     * Entrega 2.7.0.3 -- "ESTADO DE PREDICCIÓN" (sección 11): alerta de
     * desviación ACTIVE del lote, cargada junto con el resto de la
     * pantalla en load(). Capa OPERATIVA de LOTE, deliberadamente
     * distinta del badge 🟢/🟡/🔴 de "cerca del límite/fuera de
     * predicción" (2.7.0.1, que compara AHORA contra la ventana de la
     * predicción vigente) y de las alertas de degradación del MODELO
     * (/maturation/alerts, sección 10 del spec) -- esta tarjeta responde
     * "¿la ETA se está alejando de lo que esperábamos?", no "¿ya se nos
     * pasó el tiempo prometido?" ni "¿el modelo en general dejó de
     * funcionar bien?".
     */
    async renderPredictionAlert() {

        const container =
            document.getElementById("predictionAlertStatus");

        if (!container)
            return;

        try {

            const active =
                await this.predictionApi.getActiveAlert();

            this.predictionActiveAlert =
                active.active || null;

            this.renderPredictionAlertStatusBlock(this.predictionActiveAlert);

        }

        catch (err) {

            container.innerHTML =
                `<p class="text-danger mb-0">No fue posible obtener el estado de predicción: ${err.message}</p>`;

        }

    }

    alertSeverityBadgeHtml(severity) {

        const meta = {

            WARNING: { emoji: "🟡", label: "ADVERTENCIA", classAttr: "bg-warning text-dark" },

            SIGNIFICANT: { emoji: "🟠", label: "DESVIACIÓN SIGNIFICATIVA", styleAttr: "background-color:#fd7e14;color:#fff;" },

            CRITICAL: { emoji: "🔴", label: "DESVIACIÓN CRÍTICA", classAttr: "bg-danger" },

            // Entrega 2.7.0.6 -- "Después" de una acción puede quedar en
            // NORMAL (severityAfter cuando la alerta se resolvió, o
            // simplemente dentro de rango). No existía en el vocabulario
            // de 2.7.0.3 (esa entrega nunca mostraba severidades NORMAL,
            // solo alertas activas).
            NORMAL: { emoji: "🟢", label: "NORMAL", classAttr: "bg-success" }

        };

        const m =
            meta[severity] || { emoji: "⚪", label: severity || "—", classAttr: "bg-secondary" };

        const classAttr =
            m.classAttr ? ` ${m.classAttr}` : "";

        const styleAttr =
            m.styleAttr ? ` style="${m.styleAttr}"` : "";

        return `<span class="badge${classAttr} fs-6"${styleAttr}>${m.emoji} ${m.label}</span>`;

    }

    /*
     * "+2h 15m" / "-0h 40m" -- mismo formato del mockup (sección 11).
     */
    formatDeviationMinutes(minutes) {

        if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {

            return "—";

        }

        const sign =
            minutes > 0 ? "+" : minutes < 0 ? "-" : "";

        const absMinutes =
            Math.round(Math.abs(minutes));

        const hours =
            Math.floor(absMinutes / 60);

        const remainingMinutes =
            absMinutes % 60;

        return `${sign}${hours}h ${remainingMinutes}m`;

    }

    /*
     * Sección 11 -- mockup literal: severidad, finalización esperada,
     * predicción actual, desviación, mensaje. Sección 9: el texto del
     * mensaje (ya redactado por el backend, ver
     * ProductionPredictionAlertService._buildDeviationMessage()) nunca
     * habla de contaminación/pérdida del lote -- solo describe el
     * alejamiento respecto al modelo.
     */
    renderPredictionAlertStatusBlock(active) {

        const container =
            document.getElementById("predictionAlertStatus");

        if (!container)
            return;

        if (!active) {

            container.innerHTML =
                `<p class="text-muted mb-0">✓ Sin desviaciones activas. El comportamiento del lote está dentro de lo esperado.</p>`;

            return;

        }

        container.innerHTML = `

            <p class="mb-2">${this.alertSeverityBadgeHtml(active.severity)}</p>

            <ul class="list-unstyled small mb-2">

                <li><strong>Finalización esperada:</strong> ${this.formatDate(active.expectedFinishAt)}</li>

                <li><strong>Predicción actual:</strong> ${this.formatDate(active.predictedFinishAt)}</li>

                <li><strong>Desviación:</strong> ${this.formatDeviationMinutes(active.deviationMinutes)}</li>

            </ul>

            <p class="mb-2">${active.message}</p>

            <button type="button" class="btn btn-outline-primary btn-sm" id="btnRegisterAlertAction">
                Registrar acción
            </button>

        `;

        document

            .getElementById("btnRegisterAlertAction")

            .addEventListener(

                "click",

                () => this.openAlertActionModal(active)

            );

    }

    async openPredictionAlertHistory() {

        try {

            const history =
                await this.predictionApi.getAlertHistory();

            this.predictionAlertHistory =
                history.alerts || [];

        }

        catch (err) {

            this.predictionAlertHistory =
                [];

        }

        this.renderPredictionAlertHistoryBody();

        this.predictionAlertHistoryModal.show();

    }

    renderPredictionAlertHistoryBody() {

        const tbody =
            document.getElementById("predictionAlertHistoryBody");

        if (!tbody)
            return;

        const history =
            this.predictionAlertHistory || [];

        if (history.length === 0) {

            tbody.innerHTML =
                `<tr><td colspan="7" class="text-muted">Sin alertas registradas.</td></tr>`;

            return;

        }

        tbody.innerHTML =

            history

                .map(a => `

                    <tr>

                        <td>${this.formatDate(a.createdAt)}</td>

                        <td>${this.alertSeverityBadgeHtml(a.severity)}</td>

                        <td>${this.formatDeviationMinutes(a.deviationMinutes)}</td>

                        <td>${a.message}</td>

                        <td>${a.status === "RESOLVED" ? '<span class="badge bg-success">Resuelta</span>' : '<span class="badge bg-secondary">Activa</span>'}</td>

                        <td>${a.resolvedAt ? this.formatDate(a.resolvedAt) : "—"}</td>

                        <td><button type="button" class="btn btn-outline-primary btn-sm" data-alert-action-id="${a.id}">Acciones</button></td>

                    </tr>

                `)

                .join("");

        // Entrega 2.7.0.5 -- "Acciones" abre el historial de acciones +
        // el formulario de registro para ESA fila concreta (activa o ya
        // resuelta -- registrar una acción no depende de que la alerta
        // siga abierta, sección 12).
        tbody

            .querySelectorAll("button[data-alert-action-id]")

            .forEach(button => {

                const alert =
                    history.find(a => a.id === Number(button.dataset.alertActionId));

                if (alert) {

                    button.addEventListener(

                        "click",

                        () => this.openAlertActionModal(alert)

                    );

                }

            });

    }

    /*
     * Entrega 2.7.0.5 -- "Acciones de la alerta": un único modal que
     * combina el historial cronológico (sección 12: detección + acciones
     * + resolución) y el formulario de registro (sección 2), en vez de
     * dos modales apilados -- Bootstrap no maneja bien el apilamiento de
     * modales sin plomería adicional, y ambos bloques (REVISIÓN →
     * ACCIÓN) pertenecen naturalmente juntos en el mismo flujo (sección
     * 1). Decisión de implementación, no un cambio de alcance: todos los
     * campos del mockup de la sección 2 siguen presentes.
     */
    openAlertActionModal(alert) {

        this.currentActionAlert =
            alert;

        document.getElementById("alertActionBatchLabel").textContent =
            window.BATCH_NUMBER || `#${window.BATCH_ID}`;

        document.getElementById("alertActionAlertLabel").innerHTML =
            this.alertSeverityBadgeHtml(alert.severity);

        this.resetAlertActionForm();

        this.loadAlertActionTimeline(alert);

        this.alertActionModal.show();

    }

    resetAlertActionForm() {

        document.getElementById("alertActionType").value =
            "";

        document.getElementById("alertActionDescription").value =
            "";

        document.getElementById("alertActionExpectedResult").value =
            "";

        document.getElementById("alertActionNotes").value =
            "";

        document.getElementById("alertActionCreatedBy").value =
            "";

        document.getElementById("alertActionDescriptionHint").textContent =
            "";

        const errorBox =
            document.getElementById("alertActionFormError");

        errorBox.style.display =
            "none";

        errorBox.textContent =
            "";

    }

    async loadAlertActionTimeline(alert) {

        const container =
            document.getElementById("alertActionTimeline");

        container.innerHTML =
            `<p class="text-muted small mb-0">Cargando...</p>`;

        try {

            const history =
                await this.predictionApi.getAlertActions(alert.id);

            this.renderAlertActionTimeline(alert, history.actions || []);

        } catch (err) {

            container.innerHTML =
                `<p class="text-danger small mb-0">No fue posible obtener el historial: ${err.message}</p>`;

        }

    }

    /*
     * Sección 12 -- línea de tiempo combinada: detección (createdAt +
     * mensaje ya redactado por el backend, 2.7.0.3), cada acción del
     * operador en orden cronológico, y la resolución si ya ocurrió
     * (resolvedAt). Nunca inventa eventos -- si la alerta sigue ACTIVE,
     * simplemente no hay entrada final todavía (sección 9: la
     * resolución es un mecanismo aparte de las acciones).
     */
    renderAlertActionTimeline(alert, actions) {

        const container =
            document.getElementById("alertActionTimeline");

        const entries =
            [];

        entries.push(`
            <li>
                <strong>${this.formatDate(alert.createdAt)}</strong>
                ${this.alertSeverityBadgeHtml(alert.severity)}
                Alerta creada — ${alert.message}
            </li>
        `);

        actions.forEach(action => {

            const detailParts =
                [];

            if (action.description) {

                detailParts.push(`"${action.description}"`);

            }

            if (action.expectedResult) {

                detailParts.push(`Resultado esperado: "${action.expectedResult}"`);

            }

            if (action.notes) {

                detailParts.push(`Observaciones: "${action.notes}"`);

            }

            entries.push(`
                <li>
                    <strong>${this.formatDate(action.createdAt)}</strong>
                    👤 ${action.createdBy || "Operador"} —
                    <strong>${action.typeLabel}</strong>
                    ${detailParts.length ? `<br><span class="text-muted">${detailParts.join(" · ")}</span>` : ""}
                    ${this.actionEffectivenessBlockHtml(action)}
                </li>
            `);

        });

        if (alert.status === "RESOLVED" && alert.resolvedAt) {

            entries.push(`
                <li>
                    <strong>${this.formatDate(alert.resolvedAt)}</strong>
                    ✓ Alerta resuelta
                </li>
            `);

        }

        container.innerHTML =
            `<ul class="list-unstyled small mb-0">${entries.join("")}</ul>`;

    }

    /*
     * Entrega 2.7.0.6, secciones 5/6 -- línea de resultado por estado de
     * efectividad. El texto es deliberadamente OBSERVACIONAL, nunca
     * causal (sección 2: "mejora observada después de la acción", nunca
     * "la acción resolvió el problema") -- y RESOLVED usa un texto
     * distinto de IMPROVED a propósito (sección 6: no deben mezclarse,
     * "el lote mejoró pero puede seguir fuera de rango" es un caso
     * distinto de "la condición de alerta dejó de existir").
     */
    effectivenessStatusLineHtml(status) {

        const meta = {

            PENDING: { text: "⏳ Esperando datos posteriores", cls: "text-muted" },

            IMPROVED: { text: "✓ Mejora observada", cls: "text-success" },

            UNCHANGED: { text: "— Sin cambio significativo", cls: "text-muted" },

            WORSENED: { text: "⚠ Empeoramiento observado", cls: "text-danger" },

            RESOLVED: { text: "✓ Alerta resuelta después de la acción", cls: "text-success" }

        };

        const m =
            meta[status] || meta.PENDING;

        return `<span class="${m.cls} fw-bold">${m.text}</span>`;

    }

    /*
     * Sección 9/17 -- bloque "Antes / Después / Resultado / Cambio" por
     * acción. Para PENDING (sección 13: "no debemos inventar un
     * resultado") solo se muestra la línea de espera, sin comparar nada
     * -- todavía no hay un "después" que mostrar.
     */
    actionEffectivenessBlockHtml(action) {

        if (!action.effectivenessStatus || action.effectivenessStatus === "PENDING") {

            return `<br>${this.effectivenessStatusLineHtml("PENDING")}`;

        }

        const beforeBadge =
            action.alertSeverityAtAction ? this.alertSeverityBadgeHtml(action.alertSeverityAtAction) : "—";

        const afterBadge =
            action.severityAfter ? this.alertSeverityBadgeHtml(action.severityAfter) : "—";

        const changeLine =
            action.changeMinutes !== null && action.changeMinutes !== undefined
                ? `<br><span class="text-muted">Cambio: ${this.formatDeviationMinutes(action.changeMinutes)}</span>`
                : "";

        return `
            <div class="border rounded p-2 mt-1 mb-1 small">
                <div>Antes: ${beforeBadge} ${this.formatDeviationMinutes(action.deviationMinutesAtAction)}</div>
                <div>Después: ${afterBadge} ${this.formatDeviationMinutes(action.deviationMinutesAfter)}</div>
                <div class="mt-1">${this.effectivenessStatusLineHtml(action.effectivenessStatus)}</div>
                ${changeLine}
                ${action.effectivenessEvaluatedAt ? `<div class="text-muted">Evaluado: ${this.formatDate(action.effectivenessEvaluatedAt)}</div>` : ""}
            </div>
        `;

    }

    /*
     * Sección 4/14 -- la descripción es obligatoria SOLO para "Otra".
     * Puramente informativo en el frontend (el backend es quien realmente
     * lo exige, sección 14: "no debemos confiar únicamente en la
     * validación JavaScript del formulario").
     */
    updateAlertActionDescriptionHint() {

        const type =
            document.getElementById("alertActionType").value;

        const hint =
            document.getElementById("alertActionDescriptionHint");

        hint.textContent =
            type === "OTHER" ? "(obligatoria para \"Otra\")" : "";

    }

    async handleSaveAlertAction() {

        if (!this.currentActionAlert) {

            return;

        }

        const errorBox =
            document.getElementById("alertActionFormError");

        errorBox.style.display =
            "none";

        const payload = {

            type: document.getElementById("alertActionType").value,

            description: document.getElementById("alertActionDescription").value,

            expectedResult: document.getElementById("alertActionExpectedResult").value,

            notes: document.getElementById("alertActionNotes").value,

            createdBy: document.getElementById("alertActionCreatedBy").value

        };

        try {

            await this.predictionApi.createAlertAction(this.currentActionAlert.id, payload);

            // Sección 7 -- una misma alerta puede tener varias acciones:
            // se limpia el formulario y se refresca la línea de tiempo
            // en el lugar, sin cerrar el modal, para facilitar registrar
            // más de una acción seguida.
            this.resetAlertActionForm();

            await this.loadAlertActionTimeline(this.currentActionAlert);

            if (typeof UI.success === "function") {

                UI.success("Acción registrada correctamente.");

            }

        } catch (err) {

            errorBox.textContent =
                err.message;

            errorBox.style.display =
                "";

        }

    }

    async openPredictionDetail(id) {

        const body =
            document.getElementById("predictionDetailBody");

        if (!body)
            return;

        body.innerHTML =
            `<p class="text-muted mb-0">Cargando...</p>`;

        this.predictionDetailModal.show();

        try {

            const detail =
                await this.predictionApi.getDetail(id);

            this.renderPredictionDetailBody(detail);

        }

        catch (err) {

            body.innerHTML =
                `<p class="text-danger mb-0">No fue posible obtener el detalle: ${err.message}</p>`;

        }

    }

    renderPredictionDetailBody(detail) {

        const body =
            document.getElementById("predictionDetailBody");

        if (!body)
            return;

        const inputs =
            detail.inputs || {};

        // Entrega 2.6.1.13 -- getDetail() ya trae `actual`/`evaluation`
        // calculados por el backend (aditivo sobre 2.6.1.12, sin tocar
        // ningún campo existente de la predicción).
        const actualMaturationAt =
            (detail.actual || {}).maturationAt ?? null;

        const evaluation =
            detail.evaluation || { status: "PENDING" };

        const evaluationDirectionLine =
            evaluation.status === "EVALUATED"
                ? `<li><strong>Dirección:</strong> ${this.directionLabel(evaluation.direction)}</li>`
                : "";

        const evaluationPercentageLine =
            evaluation.status === "EVALUATED" && evaluation.errorPercentage !== null
                ? `<li><strong>Error porcentual:</strong> ${evaluation.errorPercentage}%</li>`
                : "";

        body.innerHTML = `

            <p class="fw-bold mb-1">Modelo</p>

            <ul class="list-unstyled small mb-3">

                <li><strong>Tipo:</strong> ${this.modelLabel(detail.model.type)}</li>

                <li><strong>Configuración:</strong> #${this.formatValue(detail.model.configurationId)}</li>

                <li><strong>Activado:</strong> ${this.formatDate(detail.model.activatedAt)}</li>

                <li><strong>Origen:</strong> ${detail.model.source || "—"}</li>

            </ul>

            <p class="fw-bold mb-1">Predicción</p>

            <ul class="list-unstyled small mb-3">

                <li><strong>Generada:</strong> ${this.formatDate(detail.prediction.predictedAt)}</li>

                <li><strong>ETA:</strong> ${this.formatDate(detail.prediction.predictedMaturationAt)}</li>

                <li><strong>Duración estimada:</strong> ${this.formatValue(detail.prediction.durationHours)} h</li>

                <li><strong>Vigente:</strong> ${detail.isCurrent ? "Sí" : "No (superada por una predicción más reciente)"}</li>

            </ul>

            ${this.calibrationDetailBlockHtml(detail.calibration)}

            <div id="predictionDetailCalibrationHealthWarning"></div>

            <p class="fw-bold mb-1">Predicción vs. Real</p>

            <ul class="list-unstyled small mb-3">

                <li><strong>Maduración real:</strong> ${this.evaluationRealText(evaluation, actualMaturationAt)}</li>

                <li><strong>Error:</strong> ${this.evaluationErrorText(evaluation)}</li>

                ${evaluationDirectionLine}

                ${evaluationPercentageLine}

            </ul>

            <p class="fw-bold mb-1">Datos de entrada usados</p>

            <ul class="list-unstyled small mb-0">

                <li><strong>pH inicial:</strong> ${this.formatValue(inputs.startingPh)}</li>

                <li><strong>°Brix inicial:</strong> ${this.formatValue(inputs.startingBrix)}</li>

                <li><strong>Temp. líquido inicial:</strong> ${this.formatValue(inputs.startingTemperature)}</li>

                <li><strong>Temp. ambiente:</strong> ${this.formatValue(inputs.ambientTemperature)}</li>

                <li><strong>Volumen objetivo:</strong> ${this.formatValue(inputs.targetVolume)}</li>

                <li><strong>Versión de receta:</strong> #${this.formatValue(inputs.recipeVersionId)}</li>

            </ul>

        `;

        if (detail.calibration && detail.calibration.applied) {

            this.loadCalibrationHealthWarning(detail.calibration.calibrationId, "predictionDetailCalibrationHealthWarning");

        }

    }

    /*
     * Entrega 2.7.0.5, sección 15 -- "[Ver alerta]" desde el panel
     * operativo (2.7.0.4) navega aquí con `?openAlertId=X`; se abre
     * directamente el modal de acciones de esa alerta, mismo patrón ya
     * usado en MaturationAlertCenterPage.init() (2.6.1.24, `?openAlertId=`
     * sobre un tipo de alerta distinto). Silencioso ante cualquier
     * fallo -- es una comodidad de navegación, nunca debe romper la
     * carga normal de la página si el parámetro es inválido o la
     * llamada falla.
     */
    async init() {

        const params =
            new URLSearchParams(window.location.search);

        const openAlertId =
            params.get("openAlertId");

        if (!openAlertId) {

            return;

        }

        try {

            const history =
                await this.predictionApi.getAlertHistory();

            const alert =
                (history.alerts || []).find(a => a.id === Number(openAlertId));

            if (alert) {

                this.openAlertActionModal(alert);

            }

        } catch (err) {

            // Silencioso a propósito -- ver comentario de arriba.

        }

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

        await window.measurementsPage.init();

    }

);
