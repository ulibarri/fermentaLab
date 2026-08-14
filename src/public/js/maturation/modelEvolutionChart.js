/*
 * Gráfico de evolución temporal de UNA métrica a través de la cadena de
 * calibraciones (Entrega 2.6.1.31, sección 3). No calcula nada -- solo
 * dibuja los números que el backend ya entrega (mismo criterio que
 * ModelComparisonChart, 2.6.1.7).
 *
 * Sección 3, criterio explícito: "no recomiendo combinar las tres
 * métricas en una sola gráfica porque utilizan escalas diferentes" --
 * por eso este helper dibuja UNA métrica por instancia, nunca varias en
 * el mismo canvas; la página llama a `render()` tres veces (MAE/RMSE/
 * Bias), cada una con su propio canvas.
 *
 * Sección 7, criterio explícito: "una calibración que empeoró no
 * desaparece ni se oculta" -- el punto correspondiente a una versión
 * cuya `comparisonWithPrevious.result === "DEGRADED"` se pinta de un
 * color distinto (rojo) en vez de excluirse o disimularse, para que la
 * degradación sea visible en la gráfica, no solo en la tabla.
 */

class ModelEvolutionChart {

    static render(config) {

        const {

            canvasId,

            versions,

            metricKey,

            label,

            color

        } = config;

        const canvas =
            document.getElementById(canvasId);

        if (!canvas) {

            return;

        }

        if (!ModelEvolutionChart._instances) {

            ModelEvolutionChart._instances = {};

        }

        if (ModelEvolutionChart._instances[canvasId]) {

            ModelEvolutionChart._instances[canvasId].destroy();

            ModelEvolutionChart._instances[canvasId] = null;

        }

        const labels =
            versions.map(v => `v${v.version}`);

        const data =
            versions.map(v => v.metrics ? v.metrics[metricKey] : null);

        const pointColors =
            versions.map(v => (v.comparisonWithPrevious && v.comparisonWithPrevious.result === "DEGRADED") ? "#dc3545" : color);

        if (data.every(value => value === null || value === undefined)) {

            return;

        }

        ModelEvolutionChart._instances[canvasId] = new Chart(

            canvas.getContext("2d"),

            {

                type: "line",

                data: {

                    labels,

                    datasets: [{

                        label,

                        data,

                        borderColor: color,

                        backgroundColor: color,

                        pointBackgroundColor: pointColors,

                        pointBorderColor: pointColors,

                        pointRadius: 5,

                        spanGaps: true,

                        tension: 0.15

                    }]

                },

                options: {

                    plugins: {

                        legend: { display: false }

                    },

                    scales: {

                        y: {

                            beginAtZero: true,

                            title: { display: true, text: `${label} (horas)` }

                        }

                    }

                }

            }

        );

    }

}

ModelEvolutionChart._instances = {};
