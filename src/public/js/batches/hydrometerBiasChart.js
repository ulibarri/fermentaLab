/*
 * Entrega 2.8.0.5, sección 8 -- "Evolución del error": una gráfica de
 * dispersión del error (Brix derivado - BrixMate real) a lo largo del
 * tiempo, para poder observar visualmente si el error crece, decrece,
 * se mantiene estable, o si hay un salto asociado a un cambio de
 * versión de tabla. No interpreta la tendencia por sí misma (sección
 * 8: "No se debe interpretar todavía como degradación del
 * instrumento") -- solo dibuja los puntos que ya calculó
 * `HydrometerBiasAnalysis.buildTimeline()` en el backend.
 *
 * Mismo patrón `static render(config)` / `static instance` que
 * `MaturationChart` (2.6.0.8) -- eje X por CATEGORÍA (fecha
 * formateada), no por escala de tiempo real, para no depender de un
 * adaptador de fechas de Chart.js que este proyecto no carga.
 */
class HydrometerBiasChart {

    static render({ canvasId, timeline }) {

        const canvas =
            document.getElementById(canvasId);

        if (!canvas) {

            return;

        }

        if (HydrometerBiasChart.instance) {

            HydrometerBiasChart.instance.destroy();

            HydrometerBiasChart.instance = null;

        }

        if (!timeline || timeline.length === 0) {

            canvas.style.display = "none";

            return;

        }

        canvas.style.display = "block";

        const labels =
            timeline.map(point => new Date(point.date).toLocaleDateString());

        // Sobreestimación en rojo, subestimación en azul, coincidencia
        // exacta en gris -- mismo criterio visual que el resto de la
        // aplicación (rojo = requiere atención).
        const pointColors =
            timeline.map(point =>

                point.error > 0 ? "#dc3545" : point.error < 0 ? "#0d6efd" : "#6c757d"

            );

        HydrometerBiasChart.instance = new Chart(

            canvas.getContext("2d"),

            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {

                            label: "Error (°Bx)",

                            data: timeline.map(point => point.error),

                            showLine: false,

                            pointBackgroundColor: pointColors,

                            pointBorderColor: pointColors,

                            pointRadius: 5,

                            pointHoverRadius: 7

                        },

                        {

                            label: "Sin error",

                            data: timeline.map(() => 0),

                            borderColor: "#adb5bd",

                            borderDash: [4, 4],

                            pointRadius: 0,

                            pointHitRadius: 0,

                            fill: false,

                            tension: 0

                        }

                    ]

                },

                options: {

                    scales: {

                        y: {

                            title: {

                                display: true,

                                text: "Error (°Bx)"

                            }

                        },

                        x: {

                            title: {

                                display: true,

                                text: "Fecha"

                            }

                        }

                    },

                    plugins: {

                        legend: {

                            display: false

                        },

                        tooltip: {

                            callbacks: {

                                label: item => {

                                    if (item.datasetIndex !== 0) {

                                        return null;

                                    }

                                    const point =
                                        timeline[item.dataIndex];

                                    const sign =
                                        point.error > 0 ? "+" : "";

                                    const tableLabel =
                                        point.tableName ? ` · Tabla: ${point.tableName} v${point.tableVersion}` : "";

                                    return `Error: ${sign}${point.error} °Bx${tableLabel}`;

                                }

                            }

                        }

                    }

                }

            }

        );

    }

}

HydrometerBiasChart.instance = null;
