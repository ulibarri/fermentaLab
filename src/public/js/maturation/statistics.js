/*
 * Página "Precisión histórica" (Entrega 2.6.1.3) + sección "Influencia
 * de temperatura" (Entrega 2.6.1.4) + sección "Análisis por volumen"
 * (Entrega 2.6.1.5) + sección "Comparación de modelos" (Entrega 2.6.1.7)
 * + sección "Validación temporal" (Entrega 2.6.1.8) + bloque "Modelo
 * recomendado" (Entrega 2.6.1.10) + bloque "Modelo activo" e historial
 * (Entrega 2.6.1.11). Consume GET /api/maturation/statistics,
 * GET /api/maturation/analysis/temperature, GET /api/maturation/analysis/volume,
 * GET /api/maturation/analysis/models, GET /api/maturation/analysis/temporal-validation,
 * GET /api/maturation/analysis/model-recommendation, GET /api/maturation/models/status
 * y POST /api/maturation/models/activate[-recommendation] (todos con
 * filtro opcional ?productId=) tal cual los entrega el backend — no
 * recalcula MAE/RMSE/correlaciones aquí, solo los presenta. El texto de
 * correlación que llega del backend ya usa lenguaje de correlación, no
 * de causalidad; este archivo no debe agregar frases como "provoca" o
 * "causa". Las razones de la recomendación de modelo también vienen ya
 * redactadas del backend (sección 3 de la especificación 2.6.1.10) —
 * este archivo solo las lista, nunca genera texto nuevo para ellas.
 *
 * El análisis de volumen nunca mezcla productos distintos: cuando el
 * filtro de producto está en "Todos", el backend regresa un análisis
 * segmentado por producto (analysis.products) en vez de uno solo
 * combinado — este archivo debe respetar esa segmentación al renderizar,
 * no aplanarla.
 *
 * La validación temporal (2.6.1.8) es puramente analítica: no cambia el
 * modelo que FermentaLab usa para predicciones nuevas. Cuando el
 * backend marca `insufficientData: true`, este archivo debe mostrar la
 * advertencia en vez de una tabla de resultados con "falsa precisión" —
 * nunca debe inventar un ganador con muy pocos lotes de validación.
 *
 * "Modelo activo" (2.6.1.11) es distinto de "modelo recomendado": el
 * activo es el que el usuario aprobó explícitamente para producción, y
 * SOLO cambia cuando el usuario pulsa "Activar modelo recomendado" o
 * "Cambiar modelo" — este archivo nunca activa nada automáticamente.
 * El estado del modelo activo se consulta POR recipeVersionId (uno por
 * cada scope que ya trajo la recomendación), no por producto, así que
 * loadModelStatus() se dispara DESPUÉS de tener la recomendación
 * cargada, reutilizando la lista de recipeVersionId de sus scopes.
 */

class MaturationStatisticsPage {

    constructor() {

        this.api =
            new MaturationStatisticsApi();

        this.filterEl =
            document.getElementById("filterProduct");

        if (this.filterEl) {

            this.filterEl.addEventListener(

                "change",

                () => this.load()

            );

        }

    }

    async load() {

        UI.loading(true);

        try {

            await Promise.all([

                this.loadStatistics(),

                this.loadTemperatureAnalysis(),

                this.loadVolumeAnalysis(),

                this.loadMultivariableAnalysis(),

                this.loadModelComparison(),

                this.loadTemporalValidation(),

                this.loadModelRecommendation(),

                this.loadModelAccuracyMetrics(),

                this.loadModelCalibrationAnalysis()

            ]);

        }

        finally {

            UI.loading(false);

        }

    }

    get productIdFilter() {

        return this.filterEl ? (this.filterEl.value || null) : null;

    }

    async loadStatistics() {

        try {

            const stats =
                await this.api.getStatistics({ productId: this.productIdFilter });

            this.render(stats);

        }

        catch (err) {

            const container =
                document.getElementById("maturationStatistics");

            if (container) {

                container.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener la estadística histórica: ${err.message}</p>`;

            }

        }

    }

    async loadTemperatureAnalysis() {

        try {

            const analysis =
                await this.api.getTemperatureAnalysis({ productId: this.productIdFilter });

            this.renderTemperatureAnalysis(analysis);

        }

        catch (err) {

            const container =
                document.getElementById("temperatureAnalysis");

            if (container) {

                container.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener el análisis de temperatura: ${err.message}</p>`;

            }

        }

    }

    async loadVolumeAnalysis() {

        try {

            const analysis =
                await this.api.getVolumeAnalysis({ productId: this.productIdFilter });

            this.renderVolumeAnalysis(analysis);

        }

        catch (err) {

            const container =
                document.getElementById("volumeAnalysis");

            if (container) {

                container.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener el análisis de volumen: ${err.message}</p>`;

            }

        }

    }

    async loadMultivariableAnalysis() {

        try {

            const analysis =
                await this.api.getMultivariableAnalysis({ productId: this.productIdFilter });

            this.renderMultivariableAnalysis(analysis);

        }

        catch (err) {

            const container =
                document.getElementById("multivariableAnalysis");

            if (container) {

                container.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener el análisis multivariable: ${err.message}</p>`;

            }

            this.hideScatterPlots("No fue posible obtener los datos para graficar.");

        }

    }

    async loadModelComparison() {

        try {

            const analysis =
                await this.api.getModelComparison({ productId: this.productIdFilter });

            this.renderModelComparison(analysis);

        }

        catch (err) {

            const container =
                document.getElementById("modelComparison");

            if (container) {

                container.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener la comparación de modelos: ${err.message}</p>`;

            }

        }

    }

    async loadTemporalValidation() {

        try {

            const analysis =
                await this.api.getTemporalValidation({ productId: this.productIdFilter });

            this.renderTemporalValidation(analysis);

        }

        catch (err) {

            const container =
                document.getElementById("temporalValidation");

            if (container) {

                container.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener la validación temporal: ${err.message}</p>`;

            }

        }

    }

    async loadModelRecommendation() {

        try {

            const analysis =
                await this.api.getModelRecommendation({ productId: this.productIdFilter });

            this.renderModelRecommendation(analysis);

            // El estado del modelo activo se consulta por recipeVersionId
            // -- necesitamos que la recomendación ya haya resuelto los
            // scopes antes de poder pedirlo.
            await this.loadModelActive(analysis);

        }

        catch (err) {

            const container =
                document.getElementById("modelRecommendation");

            if (container) {

                container.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener el modelo recomendado: ${err.message}</p>`;

            }

            const activeContainer =
                document.getElementById("modelActive");

            if (activeContainer) {

                activeContainer.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener el modelo activo: ${err.message}</p>`;

            }

        }

    }

    async loadModelAccuracyMetrics() {

        try {

            const metrics =
                await this.api.getModelAccuracyMetrics({ productId: this.productIdFilter });

            this.renderModelAccuracyMetrics(metrics);

        }

        catch (err) {

            const container =
                document.getElementById("modelAccuracyMetrics");

            if (container) {

                container.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener el rendimiento real de los modelos: ${err.message}</p>`;

            }

        }

    }

    async loadModelCalibrationAnalysis() {

        try {

            const analysis =
                await this.api.getModelCalibrationAnalysis({ productId: this.productIdFilter });

            this.renderModelCalibrationAnalysis(analysis);

        }

        catch (err) {

            const container =
                document.getElementById("modelCalibrationAnalysis");

            if (container) {

                container.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener el análisis de calibración: ${err.message}</p>`;

            }

        }

    }

    scopesFromAnalysis(analysis) {

        const groups =
            analysis && analysis.groups ? analysis.groups : (analysis ? [analysis] : []);

        return groups
            .filter(g => g && g.scope && g.scope.recipeVersionId)
            .map(g => ({ scope: g.scope, recommendation: g.recommendation }));

    }

    async loadModelActive(recommendationAnalysis) {

        const container =
            document.getElementById("modelActive");

        if (!container)
            return;

        const scopes =
            this.scopesFromAnalysis(recommendationAnalysis);

        if (scopes.length === 0) {

            container.innerHTML =
                `<p class="text-muted mb-0">Todavía no hay una versión de receta con lotes evaluables para gestionar su modelo activo.</p>`;

            return;

        }

        try {

            const entries =
                await Promise.all(scopes.map(async ({ scope, recommendation }) => {

                    try {

                        const status =
                            await this.api.getModelStatus({ recipeVersionId: scope.recipeVersionId });

                        return { scope, recommendation, status, error: null };

                    } catch (err) {

                        return { scope, recommendation, status: null, error: err.message };

                    }

                }));

            this.renderModelActive(entries);

        }

        catch (err) {

            container.innerHTML =
                `<p class="text-danger mb-0">No fue posible obtener el modelo activo: ${err.message}</p>`;

        }

    }

    formatValue(value) {

        return (value === null || value === undefined)
            ? "—"
            : value;

    }

    formatHours(value) {

        return (value === null || value === undefined)
            ? "—"
            : `${value} h`;

    }

    formatPercent(value) {

        return (value === null || value === undefined)
            ? "—"
            : `${value}%`;

    }

    render(stats) {

        const container =
            document.getElementById("maturationStatistics");

        if (!container)
            return;

        if (stats.evaluated === 0) {

            container.innerHTML = `

                <p class="mb-2">Lotes evaluables: 0 de ${stats.sampleSize}.</p>

                <p class="text-muted mb-0">Todavía no hay lotes con suficiente información para calcular una estadística histórica.</p>

            `;

            return;

        }

        const confidenceLabels = {

            INSUFFICIENT: "Insuficiente",

            LOW: "Baja",

            MEDIUM: "Media",

            HIGH: "Alta"

        };

        const modelLabels = {

            LINEAR: "Lineal",

            EXPONENTIAL: "Exponencial"

        };

        const linear =
            stats.linear || {};

        const exponential =
            stats.exponential || {};

        const comparison =
            stats.comparison || { recommendedModel: null, confidence: "INSUFFICIENT", message: null };

        const conclusionLine =
            comparison.recommendedModel
                ? `

                    <p class="mb-1">Modelo con mejor desempeño: <strong>${modelLabels[comparison.recommendedModel] || comparison.recommendedModel}</strong></p>

                    <p class="mb-0">Confianza: ${confidenceLabels[comparison.confidence] || comparison.confidence}${comparison.maeDifferenceHours !== null ? ` (diferencia de MAE: ${this.formatHours(comparison.maeDifferenceHours)})` : ""}</p>

                `
                : `<p class="text-muted mb-0">${comparison.message || "Datos insuficientes para comparar modelos."}</p>`;

        container.innerHTML = `

            <ul class="list-unstyled small mb-3">

                <li><strong>Lotes evaluados:</strong> ${stats.evaluated} de ${stats.sampleSize} (excluidos: ${stats.excluded})</li>

            </ul>

            <table class="table table-sm table-bordered mb-3">

                <thead>

                    <tr><th>Métrica</th><th>Lineal</th><th>Exponencial</th></tr>

                </thead>

                <tbody>

                    <tr>

                        <td>Lotes evaluados</td>

                        <td>${this.formatValue(linear.count)}</td>

                        <td>${this.formatValue(exponential.count)}</td>

                    </tr>

                    <tr>

                        <td>MAE</td>

                        <td>${this.formatHours(linear.maeHours)}</td>

                        <td>${this.formatHours(exponential.maeHours)}</td>

                    </tr>

                    <tr>

                        <td>RMSE</td>

                        <td>${this.formatHours(linear.rmseHours)}</td>

                        <td>${this.formatHours(exponential.rmseHours)}</td>

                    </tr>

                    <tr>

                        <td>Error mínimo</td>

                        <td>${this.formatHours(linear.minErrorHours)}</td>

                        <td>${this.formatHours(exponential.minErrorHours)}</td>

                    </tr>

                    <tr>

                        <td>Error máximo</td>

                        <td>${this.formatHours(linear.maxErrorHours)}</td>

                        <td>${this.formatHours(exponential.maxErrorHours)}</td>

                    </tr>

                    <tr>

                        <td>≤ 2 h de error</td>

                        <td>${this.formatPercent(linear.within2Hours)}</td>

                        <td>${this.formatPercent(exponential.within2Hours)}</td>

                    </tr>

                    <tr>

                        <td>≤ 6 h de error</td>

                        <td>${this.formatPercent(linear.within6Hours)}</td>

                        <td>${this.formatPercent(exponential.within6Hours)}</td>

                    </tr>

                </tbody>

            </table>

            ${conclusionLine}

        `;

    }

    formatTemperature(value) {

        return (value === null || value === undefined)
            ? "—"
            : `${value} °C`;

    }

    formatRate(value) {

        return (value === null || value === undefined)
            ? "—"
            : `${value} /h`;

    }

    formatCorrelation(value) {

        return (value === null || value === undefined)
            ? "—"
            : (value > 0 ? `+${value}` : `${value}`);

    }

    renderTemperatureAnalysis(analysis) {

        const container =
            document.getElementById("temperatureAnalysis");

        if (!container)
            return;

        if (analysis.sampleSize === 0) {

            container.innerHTML =
                `<p class="text-muted mb-0">Todavía no hay lotes con información suficiente para este análisis.</p>`;

            return;

        }

        const product =
            analysis.productTemperature || {};

        const ambient =
            analysis.ambientTemperature || {};

        const correlation =
            analysis.correlation || {};

        const rateCorrelation =
            correlation.temperatureVsFermentationRate || { value: null, label: "—" };

        const linearErrorCorrelation =
            correlation.temperatureVsPredictionErrorLinear || { value: null, label: "—" };

        const exponentialErrorCorrelation =
            correlation.temperatureVsPredictionErrorExponential || { value: null, label: "—" };

        const ranges =
            analysis.ranges || [];

        const rangeRows =
            ranges.map(range => `

                <tr>

                    <td>${range.label}</td>

                    <td>${range.batchCount}</td>

                    <td>${this.formatRate(range.averageFermentationRate)}</td>

                    <td>${this.formatHours(range.averageLinearErrorHours)}</td>

                    <td>${this.formatHours(range.averageExponentialErrorHours)}</td>

                </tr>

            `).join("");

        container.innerHTML = `

            <p class="text-muted small mb-3">Análisis exploratorio: describe relaciones observadas en los datos, no relaciones de causa y efecto.</p>

            <div class="row mb-3">

                <div class="col-md-6">

                    <p class="fw-bold mb-1">Temperatura del producto</p>

                    <ul class="list-unstyled small mb-0">

                        <li>Promedio: ${this.formatTemperature(product.average)}</li>

                        <li>Mínimo: ${this.formatTemperature(product.min)}</li>

                        <li>Máximo: ${this.formatTemperature(product.max)}</li>

                        <li class="text-muted">Lotes con dato: ${analysis.batchesWithProductTemperature}</li>

                    </ul>

                </div>

                <div class="col-md-6">

                    <p class="fw-bold mb-1">Temperatura ambiente</p>

                    <ul class="list-unstyled small mb-0">

                        <li>Promedio: ${this.formatTemperature(ambient.average)}</li>

                        <li>Mínimo: ${this.formatTemperature(ambient.min)}</li>

                        <li>Máximo: ${this.formatTemperature(ambient.max)}</li>

                        <li class="text-muted">Lotes con dato: ${analysis.batchesWithAmbientTemperature}</li>

                    </ul>

                </div>

            </div>

            <p class="fw-bold mb-2">Correlación</p>

            <ul class="list-unstyled small mb-3">

                <li><strong>Temperatura ↔ velocidad de fermentación:</strong> ${this.formatCorrelation(rateCorrelation.value)}<br><span class="text-muted">${rateCorrelation.label}</span></li>

                <li class="mt-2"><strong>Temperatura ↔ error de predicción (lineal):</strong> ${this.formatCorrelation(linearErrorCorrelation.value)}<br><span class="text-muted">${linearErrorCorrelation.label}</span></li>

                <li class="mt-2"><strong>Temperatura ↔ error de predicción (exponencial):</strong> ${this.formatCorrelation(exponentialErrorCorrelation.value)}<br><span class="text-muted">${exponentialErrorCorrelation.label}</span></li>

            </ul>

            <p class="fw-bold mb-2">Comparación por rangos de temperatura</p>

            <table class="table table-sm table-bordered mb-0">

                <thead>

                    <tr><th>Rango</th><th>Lotes</th><th>Velocidad promedio</th><th>Error promedio (lineal)</th><th>Error promedio (exponencial)</th></tr>

                </thead>

                <tbody>

                    ${rangeRows}

                </tbody>

            </table>

        `;

    }

    formatVolume(value) {

        return (value === null || value === undefined)
            ? "—"
            : `${value} L`;

    }

    buildVolumeProductHtml(productAnalysis) {

        const correlation =
            productAnalysis.correlation || {};

        const rateCorrelation =
            correlation.volumeVsFermentationRate || { value: null, label: "—" };

        const linearErrorCorrelation =
            correlation.volumeVsLinearError || { value: null, label: "—" };

        const exponentialErrorCorrelation =
            correlation.volumeVsExponentialError || { value: null, label: "—" };

        const volumes =
            productAnalysis.volumes || [];

        if (volumes.length === 0) {

            return `<p class="text-muted mb-0">Todavía no hay lotes con volumen planeado registrado para este producto.</p>`;

        }

        const volumeRows =
            volumes.map(group => `

                <tr>

                    <td>${this.formatVolume(group.volume)}</td>

                    <td>${group.sampleSize}${group.smallSample ? " ⚠" : ""}</td>

                    <td>${this.formatRate(group.averageFermentationRate)}</td>

                    <td>${this.formatTemperature(group.averageProductTemperature)}</td>

                    <td>${this.formatHours(group.linear ? group.linear.maeHours : null)}</td>

                    <td>${this.formatHours(group.exponential ? group.exponential.maeHours : null)}</td>

                </tr>

                ${group.warning ? `<tr><td colspan="6" class="text-muted small">⚠ ${group.warning}</td></tr>` : ""}

            `).join("");

        return `

            <table class="table table-sm table-bordered mb-3">

                <thead>

                    <tr><th>Volumen</th><th>Lotes</th><th>Velocidad promedio</th><th>Temp. promedio</th><th>MAE lineal</th><th>MAE exponencial</th></tr>

                </thead>

                <tbody>

                    ${volumeRows}

                </tbody>

            </table>

            <p class="fw-bold mb-2">Correlación</p>

            <ul class="list-unstyled small mb-2">

                <li><strong>Volumen ↔ velocidad de fermentación:</strong> ${this.formatCorrelation(rateCorrelation.value)}<br><span class="text-muted">${rateCorrelation.label}</span></li>

                <li class="mt-2"><strong>Volumen ↔ error de predicción (lineal):</strong> ${this.formatCorrelation(linearErrorCorrelation.value)}<br><span class="text-muted">${linearErrorCorrelation.label}</span></li>

                <li class="mt-2"><strong>Volumen ↔ error de predicción (exponencial):</strong> ${this.formatCorrelation(exponentialErrorCorrelation.value)}<br><span class="text-muted">${exponentialErrorCorrelation.label}</span></li>

            </ul>

            <p class="text-muted small mb-0">${productAnalysis.note || ""}</p>

        `;

    }

    renderVolumeAnalysis(analysis) {

        const container =
            document.getElementById("volumeAnalysis");

        if (!container)
            return;

        if (analysis.segmentedByProduct) {

            const products =
                analysis.products || [];

            if (products.length === 0) {

                container.innerHTML =
                    `<p class="text-muted mb-0">Todavía no hay lotes con información suficiente para este análisis.</p>`;

                return;

            }

            container.innerHTML = `

                <p class="text-muted small mb-3">Selecciona un producto en el filtro de arriba para ver su análisis por volumen, o revisa cada producto por separado — nunca se combinan volúmenes de productos distintos.</p>

                ${products.map(productAnalysis => `

                    <div class="mb-4">

                        <p class="fw-bold mb-2">${productAnalysis.productName || "Producto sin nombre"}</p>

                        ${this.buildVolumeProductHtml(productAnalysis)}

                    </div>

                `).join("")}

            `;

            return;

        }

        if (analysis.sampleSize === 0) {

            container.innerHTML =
                `<p class="text-muted mb-0">Todavía no hay lotes con información suficiente para este análisis.</p>`;

            return;

        }

        container.innerHTML =
            this.buildVolumeProductHtml(analysis);

    }

    hideScatterPlots(message) {

        [

            { canvas: "temperatureVsRateScatter", message: "temperatureScatterMessage" },

            { canvas: "volumeVsRateScatter", message: "volumeScatterMessage" }

        ].forEach(({ canvas, message: messageId }) => {

            const canvasEl =
                document.getElementById(canvas);

            const messageEl =
                document.getElementById(messageId);

            if (canvasEl) {

                canvasEl.style.display = "none";

            }

            if (messageEl) {

                messageEl.textContent = message;

                messageEl.style.display = "block";

            }

        });

    }

    errorClassificationLabel(key) {

        return ({

            excellent: "Excelente",

            good: "Bueno",

            moderate: "Moderado",

            high: "Alto"

        })[key] || key;

    }

    buildErrorClassificationTable(modelErrors, thresholds) {

        const linear =
            modelErrors.linear || { excellent: 0, good: 0, moderate: 0, high: 0, count: 0 };

        const exponential =
            modelErrors.exponential || { excellent: 0, good: 0, moderate: 0, high: 0, count: 0 };

        const thresholdNote =
            thresholds
                ? `<p class="text-muted small mb-2">Excelente ≤ ${thresholds.excellentMaxHours} h · Bueno ≤ ${thresholds.goodMaxHours} h · Moderado ≤ ${thresholds.moderateMaxHours} h · Alto &gt; ${thresholds.moderateMaxHours} h (umbrales provisionales, configurables)</p>`
                : "";

        return `

            ${thresholdNote}

            <table class="table table-sm table-bordered mb-0">

                <thead>

                    <tr><th>Clasificación</th><th>Lineal</th><th>Exponencial</th></tr>

                </thead>

                <tbody>

                    ${["excellent", "good", "moderate", "high"].map(key => `

                        <tr>

                            <td>${this.errorClassificationLabel(key)}</td>

                            <td>${linear[key]}</td>

                            <td>${exponential[key]}</td>

                        </tr>

                    `).join("")}

                    <tr class="text-muted small">

                        <td>Total clasificado</td>

                        <td>${linear.count}</td>

                        <td>${exponential.count}</td>

                    </tr>

                </tbody>

            </table>

        `;

    }

    buildCorrelationMatrixTable(correlations, variables) {

        const varLabels = {

            volume: "Volumen",

            averageProductTemperature: "Temp. producto",

            averageAmbientTemperature: "Temp. ambiente",

            fermentationRate: "Velocidad",

            linearError: "Error lineal",

            exponentialError: "Error exponencial"

        };

        const cellText = cell => {

            if (!cell)
                return "—";

            if (cell.value === null || cell.value === undefined) {

                return `<span class="text-muted" title="${cell.label || "Muestra insuficiente"}">insuf.</span>`;

            }

            return this.formatCorrelation(cell.value);

        };

        return `

            <div class="table-responsive">

                <table class="table table-sm table-bordered mb-0 text-center">

                    <thead>

                        <tr>

                            <th></th>

                            ${variables.map(v => `<th>${varLabels[v] || v}</th>`).join("")}

                        </tr>

                    </thead>

                    <tbody>

                        ${variables.map(rowKey => `

                            <tr>

                                <th class="text-start">${varLabels[rowKey] || rowKey}</th>

                                ${variables.map(colKey => `<td>${cellText(correlations[rowKey] ? correlations[rowKey][colKey] : null)}</td>`).join("")}

                            </tr>

                        `).join("")}

                    </tbody>

                </table>

            </div>

        `;

    }

    buildMultivariableProductHtml(productAnalysis) {

        if (productAnalysis.sampleSize === 0) {

            return `<p class="text-muted mb-0">Todavía no hay lotes con información suficiente para este análisis.</p>`;

        }

        return `

            <p class="mb-2"><strong>Lotes analizados:</strong> ${productAnalysis.sampleSize}</p>

            <p class="text-muted small mb-3">Matriz de correlaciones. Cada celda indica su tamaño de muestra; cuando la muestra es menor a ${productAnalysis.minSampleSizeForCorrelation} lotes, se muestra "insuf." en vez de un número — no se presenta una correlación poco confiable como conclusión.</p>

            ${this.buildCorrelationMatrixTable(productAnalysis.correlations || {}, productAnalysis.variables || [])}

            <p class="fw-bold mb-2 mt-3">Precisión de los modelos</p>

            ${this.buildErrorClassificationTable(productAnalysis.modelErrors || {}, productAnalysis.errorClassificationThresholds)}

            <p class="text-muted small mb-0 mt-3">${productAnalysis.note || ""}</p>

        `;

    }

    renderMultivariableAnalysis(analysis) {

        const container =
            document.getElementById("multivariableAnalysis");

        if (!container)
            return;

        if (analysis.segmentedByProduct) {

            const products =
                analysis.products || [];

            if (products.length === 0) {

                container.innerHTML =
                    `<p class="text-muted mb-0">Todavía no hay lotes con información suficiente para este análisis.</p>`;

                this.hideScatterPlots("Selecciona un producto para ver este gráfico.");

                return;

            }

            container.innerHTML = `

                <p class="text-muted small mb-3">Selecciona un producto en el filtro de arriba para ver su matriz de correlaciones completa y los gráficos — nunca se combinan lotes de productos distintos.</p>

                ${products.map(productAnalysis => `

                    <div class="mb-4">

                        <p class="fw-bold mb-2">${productAnalysis.productName || "Producto sin nombre"} (${productAnalysis.sampleSize} lotes)</p>

                    </div>

                `).join("")}

            `;

            this.hideScatterPlots("Selecciona un producto para ver este gráfico.");

            return;

        }

        container.innerHTML =
            this.buildMultivariableProductHtml(analysis);

        const scatterData =
            analysis.scatterData || { temperatureVsRate: [], volumeVsRate: [] };

        if (typeof MultivariableScatterChart !== "undefined") {

            MultivariableScatterChart.render({

                canvasId: "temperatureVsRateScatter",

                messageElementId: "temperatureScatterMessage",

                xLabel: "Temperatura del producto (°C)",

                yLabel: "Velocidad de fermentación (/h)",

                points: scatterData.temperatureVsRate

            });

            MultivariableScatterChart.render({

                canvasId: "volumeVsRateScatter",

                messageElementId: "volumeScatterMessage",

                xLabel: "Volumen (L)",

                yLabel: "Velocidad de fermentación (/h)",

                points: scatterData.volumeVsRate

            });

        }

    }

    formatScope(scope) {

        if (!scope)
            return "—";

        const parts = [];

        if (scope.productName)
            parts.push(scope.productName);

        if (scope.recipeName && scope.recipeName !== scope.productName)
            parts.push(scope.recipeName);

        if (scope.version !== null && scope.version !== undefined)
            parts.push(`v${scope.version}`);

        return parts.length > 0 ? parts.join(" · ") : "—";

    }

    bestModelLabel(bestModel) {

        return ({

            LINEAR: "Lineal",

            EXPONENTIAL: "Exponencial",

            SIMILAR: "Similar (sin diferencia relevante)"

        })[bestModel] || "—";

    }

    buildModelComparisonGroupHtml(groupAnalysis, canvasId) {

        if (!groupAnalysis || groupAnalysis.sampleSize === 0) {

            return `<p class="text-muted mb-0">Todavía no hay lotes evaluables con ambos modelos para este alcance.</p>`;

        }

        const linear =
            groupAnalysis.models ? groupAnalysis.models.linear : {};

        const exponential =
            groupAnalysis.models ? groupAnalysis.models.exponential : {};

        const comparison =
            groupAnalysis.comparison || { bestModel: null, confidence: "INSUFFICIENT", message: null };

        const confidenceLabels = {

            INSUFFICIENT: "Insuficiente",

            LOW: "Baja",

            MEDIUM: "Media",

            HIGH: "Alta"

        };

        const verdictLine =
            comparison.bestModel === "SIMILAR"
                ? `<p class="mb-0">No existe una diferencia relevante entre los modelos.</p>`
                : comparison.bestModel
                    ? `<p class="mb-0">Modelo histórico con mejor desempeño: <strong>${this.bestModelLabel(comparison.bestModel)}</strong> (confianza: ${confidenceLabels[comparison.confidence] || comparison.confidence})</p>`
                    : `<p class="text-muted mb-0">${comparison.message || "Datos insuficientes para comparar modelos."}</p>`;

        const excludedNote =
            groupAnalysis.batchesExcluded > 0
                ? `<p class="text-muted small mb-2">${groupAnalysis.batchesExcluded} de ${groupAnalysis.batchesConsidered} lotes candidatos se excluyeron de esta comparación porque al menos uno de los dos modelos no pudo evaluarse en ellos (se registran en la API para auditoría).</p>`
                : "";

        return `

            <ul class="list-unstyled small mb-2">

                <li><strong>Producto:</strong> ${groupAnalysis.scope ? (groupAnalysis.scope.productName || "—") : "—"}</li>

                <li><strong>Receta:</strong> ${groupAnalysis.scope ? (groupAnalysis.scope.recipeName || "—") : "—"}</li>

                <li><strong>Versión:</strong> ${groupAnalysis.scope && groupAnalysis.scope.version !== null && groupAnalysis.scope.version !== undefined ? `v${groupAnalysis.scope.version}` : "—"}</li>

                <li><strong>Lotes evaluados:</strong> ${groupAnalysis.sampleSize}</li>

            </ul>

            ${excludedNote}

            <table class="table table-sm table-bordered mb-3">

                <thead>

                    <tr><th>Métrica</th><th>Lineal</th><th>Exponencial</th></tr>

                </thead>

                <tbody>

                    <tr><td>MAE</td><td>${this.formatHours(linear.maeHours)}</td><td>${this.formatHours(exponential.maeHours)}</td></tr>

                    <tr><td>RMSE</td><td>${this.formatHours(linear.rmseHours)}</td><td>${this.formatHours(exponential.rmseHours)}</td></tr>

                    <tr><td>Error máximo</td><td>${this.formatHours(linear.maxAbsoluteErrorHours)}</td><td>${this.formatHours(exponential.maxAbsoluteErrorHours)}</td></tr>

                </tbody>

            </table>

            <p class="fw-bold mb-2">Estabilidad (distribución del error)</p>

            <table class="table table-sm table-bordered mb-3">

                <thead>

                    <tr><th>Percentil</th><th>Lineal</th><th>Exponencial</th></tr>

                </thead>

                <tbody>

                    <tr><td>P25</td><td>${this.formatHours(linear.p25Hours)}</td><td>${this.formatHours(exponential.p25Hours)}</td></tr>

                    <tr><td>P50</td><td>${this.formatHours(linear.p50Hours)}</td><td>${this.formatHours(exponential.p50Hours)}</td></tr>

                    <tr><td>P75</td><td>${this.formatHours(linear.p75Hours)}</td><td>${this.formatHours(exponential.p75Hours)}</td></tr>

                    <tr><td>Máximo</td><td>${this.formatHours(linear.maxAbsoluteErrorHours)}</td><td>${this.formatHours(exponential.maxAbsoluteErrorHours)}</td></tr>

                </tbody>

            </table>

            <canvas id="${canvasId}" height="90"></canvas>

            ${verdictLine}

            <p class="text-muted small mb-0 mt-2">${groupAnalysis.note || ""}</p>

        `;

    }

    renderModelComparison(analysis) {

        const container =
            document.getElementById("modelComparison");

        if (!container)
            return;

        const groups =
            analysis && analysis.groups ? analysis.groups : (analysis ? [analysis] : []);

        if (groups.length === 0) {

            container.innerHTML =
                `<p class="text-muted mb-0">Todavía no hay lotes evaluables con ambos modelos para este alcance.</p>`;

            return;

        }

        container.innerHTML = groups.map((group, index) => {

            const canvasId =
                `modelComparisonChart-${index}`;

            const heading =
                groups.length > 1
                    ? `<p class="fw-bold mb-2">${this.formatScope(group.scope)}</p>`
                    : "";

            return `

                <div class="mb-4">

                    ${heading}

                    ${this.buildModelComparisonGroupHtml(group, canvasId)}

                </div>

            `;

        }).join("");

        groups.forEach((group, index) => {

            if (!group || group.sampleSize === 0 || !group.models)
                return;

            if (typeof ModelComparisonChart === "undefined")
                return;

            ModelComparisonChart.render({

                canvasId: `modelComparisonChart-${index}`,

                linearMaeHours: group.models.linear ? group.models.linear.maeHours : null,

                exponentialMaeHours: group.models.exponential ? group.models.exponential.maeHours : null

            });

        });

    }

    bestValidationModelLabel(bestModel) {

        return ({

            LINEAR: "Lineal",

            EXPONENTIAL: "Exponencial"

        })[bestModel] || "—";

    }

    buildTemporalValidationGroupHtml(groupAnalysis) {

        if (!groupAnalysis || groupAnalysis.sampleSize === 0) {

            return `<p class="text-muted mb-0">Todavía no hay lotes evaluables con ambos modelos para este alcance.</p>`;

        }

        const summaryList = `

            <ul class="list-unstyled small mb-3">

                <li><strong>Lotes disponibles:</strong> ${groupAnalysis.sampleSize}</li>

                <li><strong>Lotes entrenamiento:</strong> ${groupAnalysis.trainingSize}</li>

                <li><strong>Lotes validación:</strong> ${groupAnalysis.validationSize}</li>

            </ul>

        `;

        if (groupAnalysis.insufficientData) {

            return `

                ${summaryList}

                <p class="text-muted mb-0">${groupAnalysis.message || "Datos insuficientes para validación temporal. Se requieren más lotes históricos."}</p>

            `;

        }

        const linear =
            groupAnalysis.linear || {};

        const exponential =
            groupAnalysis.exponential || {};

        const linearTraining =
            linear.training || {};

        const linearValidation =
            linear.validation || {};

        const exponentialTraining =
            exponential.training || {};

        const exponentialValidation =
            exponential.validation || {};

        const conclusion =
            groupAnalysis.bestValidationModel
                ? `<p class="mb-0">Mejor desempeño sobre lotes no utilizados para construir el modelo: <strong>${this.bestValidationModelLabel(groupAnalysis.bestValidationModel)}</strong></p>`
                : `<p class="text-muted mb-0">No hay una diferencia identificable entre los modelos sobre el conjunto de validación.</p>`;

        return `

            ${summaryList}

            <table class="table table-sm table-bordered mb-3">

                <thead>

                    <tr><th>Resultado</th><th>Lineal</th><th>Exponencial</th></tr>

                </thead>

                <tbody>

                    <tr><td>MAE entrenamiento</td><td>${this.formatHours(linearTraining.maeHours)}</td><td>${this.formatHours(exponentialTraining.maeHours)}</td></tr>

                    <tr><td>MAE validación</td><td>${this.formatHours(linearValidation.maeHours)}</td><td>${this.formatHours(exponentialValidation.maeHours)}</td></tr>

                    <tr><td>RMSE validación</td><td>${this.formatHours(linearValidation.rmseHours)}</td><td>${this.formatHours(exponentialValidation.rmseHours)}</td></tr>

                    <tr><td>Error máximo</td><td>${this.formatHours(linearValidation.maxAbsoluteErrorHours)}</td><td>${this.formatHours(exponentialValidation.maxAbsoluteErrorHours)}</td></tr>

                    <tr><td>Gap (sobreajuste)</td><td>${this.formatHours(linear.generalizationGapHours)}</td><td>${this.formatHours(exponential.generalizationGapHours)}</td></tr>

                </tbody>

            </table>

            ${conclusion}

            <p class="text-muted small mb-0 mt-2">${groupAnalysis.note || ""}</p>

        `;

    }

    renderTemporalValidation(analysis) {

        const container =
            document.getElementById("temporalValidation");

        if (!container)
            return;

        const groups =
            analysis && analysis.groups ? analysis.groups : (analysis ? [analysis] : []);

        if (groups.length === 0) {

            container.innerHTML =
                `<p class="text-muted mb-0">Todavía no hay lotes evaluables con ambos modelos para este alcance.</p>`;

            return;

        }

        container.innerHTML = groups.map(group => {

            const heading =
                groups.length > 1
                    ? `<p class="fw-bold mb-2">${this.formatScope(group.scope)}</p>`
                    : "";

            return `

                <div class="mb-4">

                    ${heading}

                    ${this.buildTemporalValidationGroupHtml(group)}

                </div>

            `;

        }).join("");

    }

    buildRecommendationReasonsList(reasons, withCheckmarks) {

        const list =
            reasons || [];

        if (list.length === 0) {

            return "";

        }

        const prefix =
            withCheckmarks ? "✓ " : "";

        return `<ul class="list-unstyled small mb-0">${list.map(r => `<li>${prefix}${r}</li>`).join("")}</ul>`;

    }

    buildModelRecommendationGroupHtml(groupAnalysis) {

        if (!groupAnalysis) {

            return `<p class="text-muted mb-0">Todavía no hay información suficiente para este alcance.</p>`;

        }

        const recommendation =
            groupAnalysis.recommendation || { model: null, confidence: "LOW", status: "NO_DECISION" };

        const sampleSizeLine =
            `<p class="text-muted small mb-0">${groupAnalysis.sampleSize ?? 0} lotes evaluados</p>`;

        if (recommendation.status !== "RECOMMENDED" || !recommendation.model) {

            return `

                <div class="text-center py-3">

                    <h5 class="text-muted mb-2">NO HAY RECOMENDACIÓN</h5>

                    <p class="text-muted mb-2">Los datos actuales no permiten determinar un modelo claramente superior.</p>

                    ${this.buildRecommendationReasonsList(groupAnalysis.reasons, false)}

                    ${sampleSizeLine}

                </div>

            `;

        }

        const confidenceLabels = {

            HIGH: "ALTA",

            MEDIUM: "MEDIA",

            LOW: "BAJA"

        };

        return `

            <div class="text-center py-3">

                <h3 class="fw-bold mb-2">${recommendation.model}</h3>

                <p class="mb-1">Confianza: <strong>${confidenceLabels[recommendation.confidence] || recommendation.confidence}</strong></p>

                ${sampleSizeLine}

            </div>

            <p class="fw-bold mb-2">¿Por qué?</p>

            ${this.buildRecommendationReasonsList(groupAnalysis.reasons, true)}

            <p class="text-muted small mb-0 mt-2">${groupAnalysis.note || ""}</p>

        `;

    }

    renderModelRecommendation(analysis) {

        const container =
            document.getElementById("modelRecommendation");

        if (!container)
            return;

        const groups =
            analysis && analysis.groups ? analysis.groups : (analysis ? [analysis] : []);

        if (groups.length === 0) {

            container.innerHTML =
                `<p class="text-muted mb-0">Todavía no hay lotes evaluables con ambos modelos para este alcance.</p>`;

            return;

        }

        container.innerHTML = groups.map(group => {

            const heading =
                groups.length > 1
                    ? `<p class="fw-bold mb-2">${this.formatScope(group.scope)}</p>`
                    : "";

            return `

                <div class="mb-4">

                    ${heading}

                    ${this.buildModelRecommendationGroupHtml(group)}

                </div>

            `;

        }).join("");

    }

    formatDateTime(value) {

        if (!value)
            return "—";

        const date =
            new Date(value);

        if (Number.isNaN(date.getTime()))
            return "—";

        const pad = n => String(n).padStart(2, "0");

        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

    }

    sourceLabel(source) {

        return ({

            MANUAL: "MANUAL",

            RECOMMENDATION: "RECOMMENDATION"

        })[source] || source || "—";

    }

    buildModelHistoryTableHtml(history) {

        const rows =
            history || [];

        if (rows.length === 0) {

            return `<p class="text-muted small mb-0">Todavía no hay historial de modelos para esta versión de receta.</p>`;

        }

        return `

            <table class="table table-sm table-bordered mb-0">

                <thead>

                    <tr><th>Modelo</th><th>Estado</th><th>Activado</th><th>Desactivado</th><th>Origen</th></tr>

                </thead>

                <tbody>

                    ${rows.map(row => `

                        <tr>

                            <td>${row.modelType}</td>

                            <td>${row.status === "ACTIVE" ? '<span class="badge bg-success">ACTIVE</span>' : '<span class="badge bg-secondary">INACTIVE</span>'}</td>

                            <td>${this.formatDateTime(row.activatedAt)}</td>

                            <td>${row.deactivatedAt ? this.formatDateTime(row.deactivatedAt) : "—"}</td>

                            <td>${this.sourceLabel(row.source)}</td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        `;

    }

    buildModelActiveGroupHtml(entry, index) {

        const { scope, recommendation, status, error } = entry;

        const heading =
            `<p class="fw-bold mb-2">${this.formatScope(scope)}</p>`;

        if (error) {

            return `${heading}<p class="text-danger mb-0">No fue posible obtener el modelo activo: ${error}</p>`;

        }

        const active =
            status ? status.active : null;

        const activeBlock =
            active
                ? `

                    <div class="text-center py-2">

                        <h4 class="fw-bold mb-2">${active.modelType}</h4>

                        <p class="mb-1 small">Activado: ${this.formatDateTime(active.activatedAt)}</p>

                        <p class="mb-0 small">Origen: ${this.sourceLabel(active.source)}</p>

                    </div>

                `
                : `

                    <div class="text-center py-2">

                        <h5 class="text-muted mb-2">SIN MODELO ACTIVO</h5>

                        <p class="text-muted small mb-0">Todavía no se ha configurado un modelo activo para esta versión de receta.</p>

                    </div>

                `;

        const matchesRecommendation =
            active && recommendation && recommendation.status === "RECOMMENDED" && recommendation.model === active.modelType;

        const matchNote =
            matchesRecommendation
                ? `<p class="text-success small text-center mb-2">El modelo activo coincide con la recomendación actual.</p>`
                : "";

        const canActivateRecommendation =
            recommendation && recommendation.status === "RECOMMENDED" && recommendation.model;

        const activateRecommendedButton =
            canActivateRecommendation
                ? `<button type="button" class="btn btn-sm btn-success" id="activateRecommendedBtn-${index}" ${matchesRecommendation ? "disabled" : ""}>Activar modelo recomendado</button>`
                : `<button type="button" class="btn btn-sm btn-success" disabled title="No hay una recomendación válida (NO_DECISION) para activar">Activar modelo recomendado</button>`;

        return `

            ${heading}

            ${activeBlock}

            ${matchNote}

            <div class="d-flex gap-2 justify-content-center mb-2 flex-wrap">

                ${activateRecommendedButton}

                <button type="button" class="btn btn-sm btn-outline-secondary" id="toggleChangeModelBtn-${index}">Cambiar modelo</button>

            </div>

            <div id="changeModelForm-${index}" class="border rounded p-2 mb-3" style="display:none">

                <div class="row g-2 align-items-end">

                    <div class="col-auto">

                        <label class="form-label small mb-1">Modelo</label>

                        <select class="form-select form-select-sm" id="changeModelSelect-${index}">

                            <option value="LINEAR">LINEAR</option>

                            <option value="EXPONENTIAL">EXPONENTIAL</option>

                        </select>

                    </div>

                    <div class="col">

                        <label class="form-label small mb-1">Notas (opcional)</label>

                        <input type="text" class="form-control form-control-sm" id="changeModelNotes-${index}" placeholder="Justificación">

                    </div>

                    <div class="col-auto">

                        <button type="button" class="btn btn-sm btn-primary" id="confirmChangeModelBtn-${index}">Confirmar</button>

                    </div>

                </div>

            </div>

            <div id="modelActionMessage-${index}" class="small mb-2"></div>

            <p class="fw-bold small mb-2">Historial de modelos</p>

            ${this.buildModelHistoryTableHtml(status ? status.history : [])}

        `;

    }

    renderModelActive(entries) {

        const container =
            document.getElementById("modelActive");

        if (!container)
            return;

        container.innerHTML = entries.map((entry, index) => `

            <div class="mb-4 pb-3 ${index < entries.length - 1 ? "border-bottom" : ""}">

                ${this.buildModelActiveGroupHtml(entry, index)}

            </div>

        `).join("");

        entries.forEach((entry, index) => {

            const recipeVersionId =
                entry.scope ? entry.scope.recipeVersionId : null;

            const recommendBtn =
                document.getElementById(`activateRecommendedBtn-${index}`);

            if (recommendBtn) {

                recommendBtn.addEventListener("click", () => this.handleActivateRecommended(recipeVersionId, index));

            }

            const toggleBtn =
                document.getElementById(`toggleChangeModelBtn-${index}`);

            if (toggleBtn) {

                toggleBtn.addEventListener("click", () => this.toggleChangeModelForm(index));

            }

            const confirmBtn =
                document.getElementById(`confirmChangeModelBtn-${index}`);

            if (confirmBtn) {

                confirmBtn.addEventListener("click", () => this.handleActivateManual(recipeVersionId, index));

            }

        });

    }

    toggleChangeModelForm(index) {

        const form =
            document.getElementById(`changeModelForm-${index}`);

        if (!form)
            return;

        form.style.display =
            form.style.display === "none" ? "block" : "none";

    }

    showModelActionMessage(index, message, isError) {

        const el =
            document.getElementById(`modelActionMessage-${index}`);

        if (!el)
            return;

        el.className =
            `small mb-2 ${isError ? "text-danger" : "text-success"}`;

        el.textContent =
            message;

    }

    async handleActivateRecommended(recipeVersionId, index) {

        if (!recipeVersionId)
            return;

        try {

            await this.api.activateRecommendedModel({ recipeVersionId });

            this.showModelActionMessage(index, "Modelo recomendado activado.", false);

            await this.loadModelRecommendation();

        }

        catch (err) {

            this.showModelActionMessage(index, `No fue posible activar el modelo recomendado: ${err.message}`, true);

        }

    }

    async handleActivateManual(recipeVersionId, index) {

        if (!recipeVersionId)
            return;

        const select =
            document.getElementById(`changeModelSelect-${index}`);

        const notesInput =
            document.getElementById(`changeModelNotes-${index}`);

        const modelType =
            select ? select.value : null;

        const notes =
            notesInput ? notesInput.value : null;

        try {

            await this.api.activateModel({ recipeVersionId, modelType, notes: notes || null });

            this.showModelActionMessage(index, `Modelo ${modelType} activado manualmente.`, false);

            await this.loadModelRecommendation();

        }

        catch (err) {

            this.showModelActionMessage(index, `No fue posible activar el modelo: ${err.message}`, true);

        }

    }

    /*
     * Entrega 2.6.1.14 -- "Rendimiento real de modelos": a diferencia
     * de "Comparación de modelos" (2.6.1.7, backtest retrospectivo
     * sobre TODAS las mediciones históricas) y "Modelo recomendado"
     * (2.6.1.10, motor de reglas), este bloque consume únicamente
     * predicciones vigentes que ya fueron comparadas contra la
     * maduración REAL registrada (2.6.1.13) -- una fuente de evidencia
     * nueva e independiente, sección 14: no modifica ni alimenta la
     * recomendación automática todavía.
     */
    sampleClassificationLabel(classification) {

        return ({

            LOW_SAMPLE: "Muestra baja",

            SUFFICIENT_SAMPLE: "Muestra suficiente"

        })[classification] || classification || "—";

    }

    buildModelAccuracyCardHtml(model) {

        const isLowSample =
            model.sampleClassification === "LOW_SAMPLE";

        const badgeClass =
            isLowSample ? "bg-warning text-dark" : "bg-success";

        if (model.sampleSize === 0) {

            return `

                <div class="border rounded p-3 h-100">

                    <p class="fw-bold mb-1">${model.modelType}</p>

                    <p class="text-muted small mb-0">Todavía no hay predicciones evaluadas contra maduración real para este modelo.</p>

                </div>

            `;

        }

        const biasSign =
            model.biasHours !== null && model.biasHours > 0 ? "+" : "";

        return `

            <div class="border rounded p-3 h-100">

                <div class="d-flex justify-content-between align-items-start mb-2">

                    <p class="fw-bold mb-0">${model.modelType}</p>

                    <span class="badge ${badgeClass}">${this.sampleClassificationLabel(model.sampleClassification)}</span>

                </div>

                <p class="text-muted small mb-2">Muestras: ${model.sampleSize}</p>

                <table class="table table-sm table-borderless mb-2">

                    <tbody>

                        <tr><td>MAE</td><td class="text-end">${this.formatHours(model.maeHours)}</td></tr>

                        <tr><td>RMSE</td><td class="text-end">${this.formatHours(model.rmseHours)}</td></tr>

                        <tr><td>Bias</td><td class="text-end">${model.biasHours === null ? "—" : `${biasSign}${model.biasHours} h`}</td></tr>

                    </tbody>

                </table>

                <table class="table table-sm table-borderless mb-0">

                    <tbody>

                        <tr><td>Early</td><td class="text-end">${this.formatPercent(model.earlyPercentage)} (${model.earlyCount})</td></tr>

                        <tr><td>Late</td><td class="text-end">${this.formatPercent(model.latePercentage)} (${model.lateCount})</td></tr>

                        <tr><td>Exact</td><td class="text-end">${this.formatPercent(model.exactPercentage)} (${model.exactCount})</td></tr>

                    </tbody>

                </table>

            </div>

        `;

    }

    buildModelAccuracyComparisonTableHtml(models, comparison) {

        if (!Array.isArray(models) || models.length !== 2) {

            return "";

        }

        const [a, b] = models;

        const winnerMark = (metricValue, winnerModelType, model) =>

            winnerModelType && model.modelType === winnerModelType
                ? " ✓"
                : "";

        return `

            <p class="fw-bold mb-2 mt-4">Comparación</p>

            <table class="table table-sm table-bordered mb-2">

                <thead>

                    <tr><th></th><th>${a.modelType}</th><th>${b.modelType}</th></tr>

                </thead>

                <tbody>

                    <tr><td>Muestras</td><td>${a.sampleSize}</td><td>${b.sampleSize}</td></tr>

                    <tr><td>MAE</td><td>${this.formatHours(a.maeHours)}${winnerMark(a.maeHours, comparison.lowerMae, a)}</td><td>${this.formatHours(b.maeHours)}${winnerMark(b.maeHours, comparison.lowerMae, b)}</td></tr>

                    <tr><td>RMSE</td><td>${this.formatHours(a.rmseHours)}${winnerMark(a.rmseHours, comparison.lowerRmse, a)}</td><td>${this.formatHours(b.rmseHours)}${winnerMark(b.rmseHours, comparison.lowerRmse, b)}</td></tr>

                    <tr><td>Bias</td><td>${a.biasHours === null ? "—" : `${a.biasHours > 0 ? "+" : ""}${a.biasHours} h`}</td><td>${b.biasHours === null ? "—" : `${b.biasHours > 0 ? "+" : ""}${b.biasHours} h`}</td></tr>

                </tbody>

            </table>

            <ul class="list-unstyled small mb-0">

                <li>Menor MAE: ${comparison.lowerMae || "—"}</li>

                <li>Menor RMSE: ${comparison.lowerRmse || "—"}</li>

            </ul>

        `;

    }

    renderModelAccuracyMetrics(metrics) {

        const container =
            document.getElementById("modelAccuracyMetrics");

        if (!container)
            return;

        const models =
            metrics && metrics.models ? metrics.models : [];

        const anySample =
            models.some(m => m.sampleSize > 0);

        if (!anySample) {

            container.innerHTML =
                `<p class="text-muted mb-0">Todavía no hay predicciones evaluadas contra una maduración real registrada para este alcance.</p>`;

            return;

        }

        const comparison =
            metrics.comparison || { lowerMae: null, lowerRmse: null };

        const interpretation =
            metrics.interpretation || [];

        const interpretationHtml =
            interpretation.length > 0
                ? `<ul class="list-unstyled small mb-0 mt-3">${interpretation.map(s => `<li>${s}</li>`).join("")}</ul>`
                : "";

        const excludedNote =
            metrics.batchesExcluded > 0
                ? `<p class="text-muted small mb-3">${metrics.batchesExcluded} lote(s) del alcance solicitado se excluyeron (sin maduración real todavía, sin ninguna predicción, o predicción sin ETA calculable) — nunca se cuentan como error 0.</p>`
                : "";

        container.innerHTML = `

            ${excludedNote}

            <div class="row g-3">

                ${models.map(model => `<div class="col-md-6">${this.buildModelAccuracyCardHtml(model)}</div>`).join("")}

            </div>

            ${this.buildModelAccuracyComparisonTableHtml(models, comparison)}

            ${interpretationHtml}

            <p class="text-muted small mb-0 mt-3">${metrics.note || ""}</p>

        `;

    }

    /*
     * Entrega 2.6.1.15 -- "Calibración y sesgo": consume
     * GET /api/maturation/models/calibration-analysis, que ya trae
     * cada modelo con directionConsistency/biasClassification/
     * calibrationRecommendation resueltos por el backend (no se
     * recalcula nada de esto aquí). Puramente informativo: esta
     * página nunca ofrece un botón para "aplicar" la calibración --
     * eso queda para una entrega futura (sección 7/11 del spec).
     */
    biasClassificationLabel(classification) {

        return ({

            EARLY_BIASED: "EARLY_BIASED",

            LATE_BIASED: "LATE_BIASED",

            WELL_CALIBRATED: "WELL_CALIBRATED",

            INSUFFICIENT_DATA: "INSUFFICIENT_DATA"

        })[classification] || classification || "—";

    }

    buildModelCalibrationCardHtml(model) {

        const classification =
            model.biasClassification;

        if (classification === "INSUFFICIENT_DATA") {

            return `

                <div class="border rounded p-3 h-100">

                    <div class="d-flex justify-content-between align-items-start mb-2">

                        <p class="fw-bold mb-0">${model.modelType}</p>

                        <span class="badge bg-secondary">${this.biasClassificationLabel(classification)}</span>

                    </div>

                    <p class="text-muted small mb-0">${model.interpretation ? model.interpretation.headline : "Datos insuficientes."}</p>

                </div>

            `;

        }

        const badgeClass = ({

            EARLY_BIASED: "bg-warning text-dark",

            LATE_BIASED: "bg-warning text-dark",

            WELL_CALIBRATED: "bg-success"

        })[classification] || "bg-secondary";

        const biasSign =
            model.biasHours !== null && model.biasHours > 0 ? "+" : "";

        const recommendation =
            model.calibrationRecommendation || { recommended: false, offsetHours: null };

        const recommendationBlock =
            recommendation.recommended
                ? `

                    <div class="alert alert-warning small py-2 px-3 mb-2">

                        ⚠ ${model.interpretation ? model.interpretation.recommendationMessage : "Considerar calibración manual."}

                    </div>

                    <a href="/maturation/calibrations?modelType=${encodeURIComponent(model.modelType)}&offsetHours=${encodeURIComponent(recommendation.offsetHours)}&sampleSize=${encodeURIComponent(model.sampleSize)}&biasHours=${encodeURIComponent(model.biasHours)}" class="btn btn-sm btn-outline-warning w-100">Crear propuesta de calibración</a>

                `
                : `

                    <div class="alert alert-success small py-2 px-3 mb-0">

                        ✓ ${model.interpretation ? model.interpretation.recommendationMessage : "No requiere calibración."}

                    </div>

                `;

        return `

            <div class="border rounded p-3 h-100">

                <div class="d-flex justify-content-between align-items-start mb-2">

                    <p class="fw-bold mb-0">${model.modelType}</p>

                    <span class="badge ${badgeClass}">${this.biasClassificationLabel(classification)}</span>

                </div>

                <p class="text-muted small mb-2">${model.interpretation ? model.interpretation.headline : ""}</p>

                <table class="table table-sm table-borderless mb-2">

                    <tbody>

                        <tr><td>Bias</td><td class="text-end">${model.biasHours === null ? "—" : `${biasSign}${model.biasHours} h`}</td></tr>

                        <tr><td>Consistencia</td><td class="text-end">${this.formatPercent(model.directionConsistency)}</td></tr>

                        <tr><td>Muestras</td><td class="text-end">${model.sampleSize}</td></tr>

                    </tbody>

                </table>

                ${recommendationBlock}

            </div>

        `;

    }

    renderModelCalibrationAnalysis(analysis) {

        const container =
            document.getElementById("modelCalibrationAnalysis");

        if (!container)
            return;

        const models =
            analysis && analysis.models ? analysis.models : [];

        const anySample =
            models.some(m => m.sampleSize > 0);

        if (!anySample) {

            container.innerHTML =
                `<p class="text-muted mb-0">Todavía no hay predicciones evaluadas contra una maduración real registrada para este alcance.</p>`;

            return;

        }

        container.innerHTML = `

            <div class="row g-3">

                ${models.map(model => `<div class="col-md-6">${this.buildModelCalibrationCardHtml(model)}</div>`).join("")}

            </div>

            <p class="text-muted small mb-0 mt-3">${analysis.note || ""}</p>

        `;

    }

}

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        window.maturationStatisticsPage =

            new MaturationStatisticsPage();

        await window.maturationStatisticsPage.load();

    }

);
