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

        // Entrega 2.6.1.12 -- trazabilidad de predicciones. predictionHistory
        // se cachea tras el primer load() para no repetir la petición al
        // abrir el modal de historial (el detalle sigue pidiéndose siempre
        // fresco, por registro).
        this.predictionApi =
            new PredictionApi(batchId);

        this.predictionHistory = [];

        this.predictionDetailModal =
            bootstrap.Modal.getOrCreateInstance(

                document.getElementById("modalPredictionDetail")

            );

        this.predictionHistoryModal =
            bootstrap.Modal.getOrCreateInstance(

                document.getElementById("modalPredictionHistory")

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

            await this.renderMaturationEvaluation();

            await this.renderCurrentPrediction();

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

    renderCurrentPredictionBlock() {

        const container =
            document.getElementById("currentPrediction");

        if (!container)
            return;

        const current =
            (this.predictionHistory || []).find(p => p.isCurrent);

        if (!current) {

            container.innerHTML =
                `<p class="text-muted mb-0">Todavía no se ha generado ninguna predicción auditable para este lote. Se genera automáticamente al registrar una medición F1, siempre que exista un modelo activo configurado para la receta.</p>`;

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

        container.innerHTML = `

            <ul class="list-unstyled small mb-3">

                <li><strong>ETA predicha:</strong> ${this.formatDate(current.predictedMaturationAt)} ${this.calibrationBadgeHtml(current.calibration)}</li>

                <li><strong>Modelo:</strong> ${this.modelLabel(current.modelType)}</li>

                <li><strong>Predicción generada:</strong> ${this.formatDate(current.predictedAt)}</li>

                <li><strong>Duración estimada:</strong> ${this.formatValue(current.predictedDurationHours)} h</li>

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

    openPredictionHistory() {

        this.renderPredictionHistoryBody();

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
                `<tr><td colspan="8" class="text-muted">Sin predicciones registradas.</td></tr>`;

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

                    return `

                    <tr>

                        <td>${this.formatDate(p.predictedAt)}</td>

                        <td>${this.modelLabel(p.modelType)}</td>

                        <td>${this.formatDate(p.predictedMaturationAt)} ${this.calibrationBadgeHtml(p.calibration)}</td>

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
