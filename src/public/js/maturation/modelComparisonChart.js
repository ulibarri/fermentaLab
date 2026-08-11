/*
 * Gráfico de barras horizontal para comparar el MAE de ambos modelos
 * (Entrega 2.6.1.7, sección 9). No calcula nada — solo dibuja los
 * números que el backend ya entrega.
 */

class ModelComparisonChart {

    static render(config) {

        const {

            canvasId,

            linearMaeHours,

            exponentialMaeHours

        } = config;

        const canvas =
            document.getElementById(canvasId);

        if (!canvas) {

            return;

        }

        if (!ModelComparisonChart._instances) {

            ModelComparisonChart._instances = {};

        }

        if (ModelComparisonChart._instances[canvasId]) {

            ModelComparisonChart._instances[canvasId].destroy();

            ModelComparisonChart._instances[canvasId] = null;

        }

        if (typeof linearMaeHours !== "number" && typeof exponentialMaeHours !== "number") {

            return;

        }

        ModelComparisonChart._instances[canvasId] = new Chart(

            canvas.getContext("2d"),

            {

                type: "bar",

                data: {

                    labels: ["Lineal", "Exponencial"],

                    datasets: [{

                        label: "MAE (horas)",

                        data: [linearMaeHours ?? null, exponentialMaeHours ?? null],

                        backgroundColor: ["#fd7e14", "#20c997"]

                    }]

                },

                options: {

                    indexAxis: "y",

                    plugins: {

                        legend: { display: false }

                    },

                    scales: {

                        x: {

                            beginAtZero: true,

                            title: { display: true, text: "MAE (horas)" }

                        }

                    }

                }

            }

        );

    }

}

ModelComparisonChart._instances = {};
