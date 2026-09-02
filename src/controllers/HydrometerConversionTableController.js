/*
 * Entrega 2.8.0.2, sección 10 -- página administrativa "Configuración
 * → Hidrómetros → Tabla de conversión". Carga liviana, mismo criterio
 * que el resto de páginas administrativas del proyecto (ej.
 * `OperationalReportController`, 2.7.0.9): la vista no recibe ningún
 * dato precargado -- toda la lista/detalle se obtiene en vivo del lado
 * del cliente vía `/api/hydrometer/tables...` (mismo patrón que
 * `maturation/calibrations.ejs`).
 */
exports.index = (req, res) => {

    res.render("hydrometer/conversionTables", {

        title: "Tabla de conversión del hidrómetro",

        page: "hydrometer-conversion-tables"

    });

};
