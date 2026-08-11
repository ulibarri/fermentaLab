/*
 * Entrega 2.6.1.22, sección 8 -- indicador de atención en la
 * navegación principal ("Modelos > Alertas 🔴 2"). Este proyecto no
 * tiene una barra de navegación global persistente (ver layouts/
 * main.ejs) -- la "navegación principal" son los enlaces de cabecera
 * que ya se repiten en cada página de maduración, así que este script
 * se incluye en cada una de ellas y solo actualiza el badge junto al
 * enlace "Centro de alertas" si lo encuentra. El contador considera
 * ÚNICAMENTE alertas OPEN (sección 8, criterio 13) -- viene directo de
 * `summary.open`, que ya excluye ACKNOWLEDGED/RESOLVED.
 */
(function () {

    async function loadAlertBadge() {

        const badge =
            document.getElementById("navAlertsBadge");

        if (!badge || typeof Api === "undefined") {

            return;

        }

        try {

            const response =
                await Api.get("/api/maturation/alerts/summary");

            const open =
                response.data.open;

            if (open > 0) {

                badge.textContent = `🔴 ${open}`;

                badge.style.display = "";

            } else {

                badge.style.display = "none";

            }

        } catch (err) {

            badge.style.display = "none";

        }

    }

    document.addEventListener("DOMContentLoaded", loadAlertBadge);

})();
