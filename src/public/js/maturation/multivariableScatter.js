/*
 * Scatter plot genérico para el análisis multivariable (Entrega 2.6.1.6,
 * sección 9). A diferencia de maturationChart.js (que dibuja series de
 * tiempo con proyecciones), este componente solo dibuja puntos {x, y}
 * sin conectar — no calcula nada, solo grafica lo que el backend ya
 * entrega en scatterData.
 */

class MultivariableScatterChart {

    static render(config) {

        const {

            canvasId,

            messageElementId,

            xLabel,

            yLabel,

            points,

            minPointsToRender = 4

        } = config;

        const canvas =
            document.getElementById(canvasId);

        const messageEl =
            document.getElementById(messageElementId);

        if (!canvas) {

            return;

        }

        if (!MultivariableScatterChart._instances) {

            MultivariableScatterChart._instances = {};

        }

        if (MultivariableScatterChart._instances[canvasId]) {

            MultivariableScatterChart._instances[canvasId].destroy();

            MultivariableScatterChart._instances[canvasId] = null;

        }

        const validPoints =
            (points || []).filter(

                p =>
                    typeof p.x === "number" && Number.isFinite(p.x) &&
                    typeof p.y === "number" && Number.isFinite(p.y)

            );

        if (validPoints.length < minPointsToRender) {

            canvas.style.display = "none";

            if (messageEl) {

                messageEl.textContent =
                    `Datos insuficientes para graficar ${xLabel} vs. ${yLabel} (se necesitan al menos ${minPointsToRender} lotes).`;

                messageEl.style.display = "block";

            }

            return;

        }

        canvas.style.display = "block";

        if (messageEl) {

            messageEl.textContent = "";

            messageEl.style.display = "none";

        }

        MultivariableScatterChart._instances[canvasId] = new Chart(

            canvas.getContext("2d"),

            {

                type: "scatter",

                data: {

                    datasets: [{

                        label: `${xLabel} vs. ${yLabel}`,

                        data: validPoints,

                        backgroundColor: "#0d6efd",

                        pointRadius: 5,

                        pointHoverRadius: 7

                    }]

                },

                options: {

                    scales: {

                        x: {

                            title: { display: true, text: xLabel }

                        },

                        y: {

                            title: { display: true, text: yLabel }

                        }

                    },

                    plugins: {

                        legend: { display: false }

                    }

                }

            }

        );

    }

}

MultivariableScatterChart._instances = {};
