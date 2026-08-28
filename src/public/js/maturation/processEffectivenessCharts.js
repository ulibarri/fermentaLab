/*
 * Gráficas del análisis global del proceso de recalibración (Entrega
 * 2.6.1.33, secciones 6/8). Mismo criterio que ModelEvolutionChart
 * (2.6.1.31): no calcula nada, solo dibuja los agregados que el backend
 * ya entrega.
 */
class ProcessEffectivenessCharts {

    static _destroy(canvasId) {

        if (!ProcessEffectivenessCharts._instances) {

            ProcessEffectivenessCharts._instances = {};

        }

        if (ProcessEffectivenessCharts._instances[canvasId]) {

            ProcessEffectivenessCharts._instances[canvasId].destroy();

            ProcessEffectivenessCharts._instances[canvasId] = null;

        }

    }

    /*
     * Sección 6 -- distribución de efectividad en las 5 bandas que ya
     * calculó `RecalibrationProcessAnalysis.summarize()`.
     */
    static renderDistribution(canvasId, distribution) {

        const canvas =
            document.getElementById(canvasId);

        if (!canvas || !window.Chart) {

            return;

        }

        ProcessEffectivenessCharts._destroy(canvasId);

        ProcessEffectivenessCharts._instances[canvasId] = new Chart(

            canvas.getContext("2d"),

            {

                type: "bar",

                data: {

                    labels: distribution.map(band => band.label),

                    datasets: [{

                        label: "Recalibraciones",

                        data: distribution.map(band => band.count),

                        backgroundColor: ["#dc3545", "#fd7e14", "#ffc107", "#198754", "#0dcaf0"]

                    }]

                },

                options: {

                    plugins: { legend: { display: false } },

                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }

                }

            }

        );

    }

    /*
     * Sección 8 -- evolución temporal de la efectividad, un punto por
     * recalibración evaluada, ordenado cronológicamente por
     * `activatedAt` (ver RecalibrationProcessAnalysis.summarize()). Una
     * regresión no tiene score (sección 3 de 2.6.1.32) -- se dibuja en
     * y=0 y en rojo, para que sea visible en la gráfica y no un simple
     * hueco (mismo criterio de "nunca ocultar una degradación" que
     * ModelEvolutionChart, 2.6.1.31).
     */
    static renderTimeline(canvasId, timeline) {

        const canvas =
            document.getElementById(canvasId);

        if (!canvas || !window.Chart || !timeline || timeline.length === 0) {

            return;

        }

        ProcessEffectivenessCharts._destroy(canvasId);

        const pointColors =
            timeline.map(point => {

                if (point.isRegression) return "#dc3545";

                if (point.effectivenessScore === null || point.effectivenessScore === undefined) return "#adb5bd";

                if (point.effectivenessScore >= 90) return "#198754";

                if (point.effectivenessScore >= 70) return "#ffc107";

                return "#fd7e14";

            });

        ProcessEffectivenessCharts._instances[canvasId] = new Chart(

            canvas.getContext("2d"),

            {

                type: "line",

                data: {

                    labels: timeline.map(point => point.label),

                    datasets: [{

                        label: "Efectividad (%)",

                        data: timeline.map(point => point.isRegression ? 0 : point.effectivenessScore),

                        borderColor: "#0d6efd",

                        backgroundColor: "#0d6efd",

                        pointBackgroundColor: pointColors,

                        pointBorderColor: pointColors,

                        pointRadius: 6,

                        spanGaps: true,

                        tension: 0.15

                    }]

                },

                options: {

                    plugins: {

                        legend: { display: false },

                        tooltip: {

                            callbacks: {

                                label: context => {

                                    const point =
                                        timeline[context.dataIndex];

                                    return point.isRegression ? "⚠ Regresión" : `Efectividad: ${point.effectivenessScore}%`;

                                }

                            }

                        }

                    },

                    scales: {

                        y: { title: { display: true, text: "Efectividad (%)" } }

                    }

                }

            }

        );

    }

}

ProcessEffectivenessCharts._instances = {};
