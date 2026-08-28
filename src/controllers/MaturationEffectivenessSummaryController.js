/*
 * Entrega 2.6.1.33 -- "Predicción -> Evolución del modelo -> Análisis
 * global del proceso de recalibración". Mismo patrón mínimo que
 * MaturationModelHistoryController (2.6.1.31): esta página no necesita
 * ninguna lista para poblar filtros server-side (a diferencia de
 * `/maturation/model-history`, que sí precarga `recipeVersions` para su
 * selector -- esta vista solo filtra por `model`/`dateFrom`/`dateTo`,
 * los tres parámetros que expone el endpoint, sección 15) -- todos los
 * datos los trae el propio JS de la página vía la API REST.
 */
exports.index = async (req, res, next) => {

    try {

        res.render("maturation/effectivenessSummary", {

            title: "Análisis global del proceso de recalibración",

            page: "maturation"

        });

    } catch (err) {

        next(err);

    }

};
