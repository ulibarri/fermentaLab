/*
 * Gráfica de evolución + predicción de maduración F1 (Entrega 2.6.0.8).
 *
 * Componente reutilizable: NO conoce nada de "pH" ni "Tepache" — recibe
 * metric/label/unit/target/measurements/prediction desde quien lo llama
 * (measurements.js), para poder reutilizarse sin cambios con otras
 * métricas (ej. Brix/SG de Kombucha) en el futuro.
 *
 * No recalcula tasas, asíntotas ni ETAs: toma esos valores ya calculados
 * de la respuesta de GET /api/batches/:id/maturation (Entrega 2.6.0.7).
 * Lo único que "calcula" aquí es la muestra de puntos de la curva
 * exponencial ya ajustada (evaluando la misma fórmula con los parámetros
 * que el backend entrega: asymptote, decayConstant, initialValueFit) —
 * es decir, dibuja una curva ya resuelta, no ajusta un modelo nuevo.
 */

class MaturationChart {

    static render(config) {

        const {

            canvasId,

            messageElementId,

            metric,

            label,

            unit,

            target,

            measurements,

            prediction

        } = config;

        const canvas =
            document.getElementById(canvasId);

        const messageEl =
            document.getElementById(messageElementId);

        if (!canvas) {

            return;

        }

        if (MaturationChart.instance) {

            MaturationChart.instance.destroy();

            MaturationChart.instance = null;

        }

        MaturationChart._clearMessage(messageEl);

        const points =
            MaturationChart._extractPoints(measurements, metric);

        if (points.length === 0) {

            canvas.style.display = "none";

            MaturationChart._setMessage(

                messageEl,

                "Aún no hay mediciones de F1 registradas para graficar."

            );

            return;

        }

        canvas.style.display = "block";

        const lastPoint =
            points[points.length - 1];

        const exponential =
            prediction.exponential || {};

        const linear =
            prediction.linear || null;

        // Ventana de proyección: hasta dónde se extiende el eje X para
        // acomodar las líneas de proyección, además de las lecturas reales.

        let etaHoursLinear = null;

        if (linear && linear.eta) {

            etaHoursLinear =
                MaturationChart._hoursFromT0(points, linear.eta);

        }

        const canDrawExponentialCurve =
            (exponential.confidence === "MEDIUM" || exponential.confidence === "HIGH") &&
            MaturationChart._isNumber(exponential.decayConstant) &&
            MaturationChart._isNumber(exponential.initialValueFit) &&
            MaturationChart._isNumber(exponential.asymptote);

        let curveEndX = null;

        if (canDrawExponentialCurve) {

            if (exponential.eta) {

                curveEndX =
                    MaturationChart._hoursFromT0(points, exponential.eta);

            } else {

                // Sin ETA (objetivo no alcanzable con este ajuste, o sin
                // objetivo configurado): igual mostramos hacia dónde
                // tiende la curva, con una ventana de proyección por
                // defecto — no es un ETA real, solo referencia visual.

                const elapsed =
                    lastPoint.x - points[0].x;

                curveEndX =
                    lastPoint.x + Math.max(24, elapsed * 0.5);

            }

        }

        const overallMaxX =
            Math.max(

                lastPoint.x,

                etaHoursLinear !== null ? etaHoursLinear : lastPoint.x,

                curveEndX !== null ? curveEndX : lastPoint.x

            );

        const datasets = [];

        datasets.push(

            MaturationChart._buildRealDataset(points, label)

        );

        if (target !== null && target !== undefined) {

            datasets.push(

                MaturationChart._buildHorizontalLine(

                    points[0].x,

                    overallMaxX,

                    target,

                    `Objetivo (${label})`,

                    "#dc3545"

                )

            );

        }

        if (MaturationChart._isNumber(exponential.asymptote)) {

            datasets.push(

                MaturationChart._buildHorizontalLine(

                    points[0].x,

                    overallMaxX,

                    exponential.asymptote,

                    "Asíntota estimada",

                    "#6f42c1"

                )

            );

        }

        if (linear && etaHoursLinear !== null && target !== null && target !== undefined) {

            datasets.push({

                label: "Proyección lineal",

                data: [

                    { x: lastPoint.x, y: lastPoint.y },

                    { x: etaHoursLinear, y: target }

                ],

                borderColor: "#fd7e14",

                borderDash: [6, 4],

                pointRadius: 0,

                pointHitRadius: 0,

                fill: false,

                tension: 0,

                isProjection: true

            });

        }

        let exponentialCurveDrawn = false;

        if (canDrawExponentialCurve && curveEndX > lastPoint.x) {

            const curvePoints =
                MaturationChart._sampleExponentialCurve(

                    lastPoint.x,

                    curveEndX,

                    exponential.asymptote,

                    exponential.decayConstant,

                    exponential.initialValueFit

                );

            if (curvePoints.length > 1) {

                datasets.push({

                    label: "Proyección exponencial",

                    data: curvePoints,

                    borderColor: "#20c997",

                    borderDash: [2, 3],

                    pointRadius: 0,

                    pointHitRadius: 0,

                    fill: false,

                    tension: 0.25,

                    isProjection: true

                });

                exponentialCurveDrawn = true;

            }

        }

        if (!exponentialCurveDrawn &&
            (exponential.confidence === "INSUFFICIENT" || exponential.confidence === "LOW")) {

            MaturationChart._setMessage(

                messageEl,

                "No hay suficientes datos para generar una proyección exponencial confiable."

            );

        }

        MaturationChart.instance = new Chart(

            canvas.getContext("2d"),

            {

                type: "line",

                data: { datasets },

                options: {

                    interaction: {

                        mode: "nearest",

                        intersect: true

                    },

                    scales: {

                        x: {

                            type: "linear",

                            title: {

                                display: true,

                                text: "Horas desde inicio F1"

                            },

                            ticks: {

                                callback: value => `${Math.round(value)}h`

                            }

                        },

                        y: {

                            title: {

                                display: true,

                                text: unit ? `${label} (${unit})` : label

                            }

                        }

                    },

                    plugins: {

                        legend: {

                            position: "bottom"

                        },

                        tooltip: {

                            callbacks: {

                                title: items => {

                                    const item = items[0];

                                    if (!item) {

                                        return "";

                                    }

                                    if (item.dataset.isRealData) {

                                        return item.raw.timestampLabel;

                                    }

                                    return item.dataset.label;

                                },

                                label: item => {

                                    if (item.dataset.isRealData) {

                                        return item.raw.tooltipLines;

                                    }

                                    return `${MaturationChart._round(item.parsed.y)}`;

                                }

                            }

                        }

                    }

                }

            }

        );

    }

    static _isNumber(value) {

        return typeof value === "number" && Number.isFinite(value);

    }

    static _round(value, decimals = 3) {

        if (!MaturationChart._isNumber(value)) {

            return value;

        }

        const factor = Math.pow(10, decimals);

        return Math.round(value * factor) / factor;

    }

    static _extractPoints(measurements, metric) {

        const f1 =
            (measurements || []).filter(m =>

                m.phase === "F1" &&
                m[metric] !== null &&
                m[metric] !== undefined &&
                m[metric] !== ""

            );

        if (f1.length === 0) {

            return [];

        }

        const sorted =
            [...f1].sort(

                (a, b) => new Date(a.measurementDate) - new Date(b.measurementDate)

            );

        const t0 =
            new Date(sorted[0].measurementDate).getTime();

        return sorted.map(m => {

            const timestamp =
                new Date(m.measurementDate);

            return {

                x: (timestamp.getTime() - t0) / (1000 * 60 * 60),

                y: Number(m[metric]),

                timestamp,

                raw: m

            };

        });

    }

    static _buildTooltipLines(point) {

        const m = point.raw;

        const lines = [

            `Tiempo F1: ${MaturationChart._round(point.x, 1)} h`

        ];

        if (m.ph !== null && m.ph !== undefined) {

            lines.push(`pH: ${m.ph}`);

        }

        if (m.brix !== null && m.brix !== undefined) {

            lines.push(`Brix: ${m.brix}`);

        }

        if (m.specificGravity !== null && m.specificGravity !== undefined) {

            lines.push(`SG: ${m.specificGravity}`);

        }

        if (m.liquidTemperature !== null && m.liquidTemperature !== undefined) {

            lines.push(`Temp: ${m.liquidTemperature} °C`);

        }

        return lines;

    }

    static _buildRealDataset(points, label) {

        const data =
            points.map(p => ({

                x: p.x,

                y: p.y,

                timestampLabel: p.timestamp.toLocaleString(),

                tooltipLines: MaturationChart._buildTooltipLines(p)

            }));

        return {

            label: `Mediciones reales (${label})`,

            data,

            borderColor: "#0d6efd",

            backgroundColor: "#0d6efd",

            pointRadius: 4,

            pointHoverRadius: 6,

            borderWidth: 2,

            showLine: true,

            fill: false,

            tension: 0,

            isRealData: true

        };

    }

    static _buildHorizontalLine(minX, maxX, value, label, color) {

        return {

            label,

            data: [

                { x: minX, y: value },

                { x: maxX, y: value }

            ],

            borderColor: color,

            borderDash: [4, 4],

            pointRadius: 0,

            pointHitRadius: 0,

            fill: false,

            tension: 0,

            isProjection: true

        };

    }

    static _hoursFromT0(points, isoTimestamp) {

        const t0 =
            points[0].timestamp.getTime();

        const t =
            new Date(isoTimestamp).getTime();

        return (t - t0) / (1000 * 60 * 60);

    }

    static _sampleExponentialCurve(xStart, xEnd, asymptote, decayConstant, initialValueFit) {

        if (!(xEnd > xStart)) {

            return [];

        }

        const STEPS = 24;

        const points = [];

        for (let i = 0; i <= STEPS; i++) {

            const x =
                xStart + (xEnd - xStart) * (i / STEPS);

            const y =
                asymptote + (initialValueFit - asymptote) * Math.exp(-decayConstant * x);

            points.push({ x, y });

        }

        return points;

    }

    static _setMessage(messageEl, text) {

        if (!messageEl) {

            return;

        }

        messageEl.textContent = text;

        messageEl.style.display = "block";

    }

    static _clearMessage(messageEl) {

        if (!messageEl) {

            return;

        }

        messageEl.textContent = "";

        messageEl.style.display = "none";

    }

}

MaturationChart.instance = null;
