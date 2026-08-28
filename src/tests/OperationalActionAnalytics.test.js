const assert = require("assert");

const OperationalActionAnalytics =
    require("../utils/OperationalActionAnalytics");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

function action(type, effectivenessStatus, alertSeverityAtAction = "WARNING") {

    return { type, effectivenessStatus, alertSeverityAtAction };

}

// --- summarize(): división entre cero / sin acciones -----------------

{

    const empty =
        OperationalActionAnalytics.summarize([]);

    check(empty.total === 0 && empty.evaluated === 0 && empty.pending === 0, "sin acciones: todos los conteos en 0");
    check(empty.percentages.improved === null, "Acción 5: evaluated=0 -> porcentaje N/A (null), nunca 0/0");
    check(empty.smallSample === false, "sin acciones evaluadas, smallSample no se activa (no hay nada que describir)");

}

// --- summarize(): solo acciones PENDING -------------------------------

{

    const onlyPending =
        OperationalActionAnalytics.summarize([

            action("INSPECTION", "PENDING"),

            action("INSPECTION", null)

        ]);

    check(onlyPending.total === 2, "2 acciones en total");
    check(onlyPending.pending === 2, "ambas cuentan como pending (incluye effectivenessStatus null/ausente)");
    check(onlyPending.evaluated === 0, "Acción 2: PENDING nunca cuenta como evaluada");
    check(onlyPending.percentages.improved === null, "sin evaluadas -> N/A, no división entre cero");

}

// --- summarize(): reproducción exacta del ejemplo literal, Acción 4 --

{

    const actions =
        [

            ...Array(18).fill().map(() => action("INSPECTION", "IMPROVED")),

            ...Array(12).fill().map(() => action("INSPECTION", "UNCHANGED")),

            ...Array(5).fill().map(() => action("INSPECTION", "WORSENED")),

            ...Array(7).fill().map(() => action("INSPECTION", "RESOLVED")),

            ...Array(8).fill().map(() => action("INSPECTION", "PENDING"))

        ];

    const summary =
        OperationalActionAnalytics.summarize(actions);

    check(summary.total === 50, `Acción 4, ejemplo literal: Total 50 -- got ${summary.total}`);
    check(summary.evaluated === 42, `Acción 4, ejemplo literal: Evaluadas 42 -- got ${summary.evaluated}`);
    check(summary.pending === 8, `Acción 4, ejemplo literal: Pendientes 8 -- got ${summary.pending}`);
    check(summary.improved === 18 && summary.unchanged === 12 && summary.worsened === 5 && summary.resolved === 7, "Acción 4, ejemplo literal: 18/12/5/7");

    // Acción 5/12 -- 18/42 = 42.86% (texto), redondeado a 1 decimal
    // (mockup de tarjetas de la Acción 12: "42.9%").
    check(summary.percentages.improved === 42.9, `Acción 5/12, ejemplo literal: 18/42 -> 42.9% -- got ${summary.percentages.improved}`);
    check(summary.percentages.resolved === 16.7, `Acción 12, ejemplo literal: 7/42 -> 16.7% -- got ${summary.percentages.resolved}`);

}

// --- groupByActionType(): reproducción exacta de los tres ejemplos ---
// --- literales de las Acciones 6 y 13 ---------------------------------

{

    const actions =
        [

            // Inspección: Total 24, Evaluadas 22, Improved 10, Unchanged 6, Worsened 2, Resolved 4, Pending 2.
            ...Array(10).fill().map(() => action("INSPECTION", "IMPROVED")),
            ...Array(6).fill().map(() => action("INSPECTION", "UNCHANGED")),
            ...Array(2).fill().map(() => action("INSPECTION", "WORSENED")),
            ...Array(4).fill().map(() => action("INSPECTION", "RESOLVED")),
            ...Array(2).fill().map(() => action("INSPECTION", "PENDING")),

            // Ajuste temperatura: Total 18, Evaluadas 17, Improved 9, Unchanged 3, Worsened 1, Resolved 4, Pending 1.
            ...Array(9).fill().map(() => action("TEMPERATURE_ADJUSTMENT", "IMPROVED")),
            ...Array(3).fill().map(() => action("TEMPERATURE_ADJUSTMENT", "UNCHANGED")),
            ...Array(1).fill().map(() => action("TEMPERATURE_ADJUSTMENT", "WORSENED")),
            ...Array(4).fill().map(() => action("TEMPERATURE_ADJUSTMENT", "RESOLVED")),
            ...Array(1).fill().map(() => action("TEMPERATURE_ADJUSTMENT", "PENDING")),

            // Toma de muestra adicional: Total 15, Evaluadas 14, Improved 5, Unchanged 6, Worsened 1, Resolved 2, Pending 1.
            ...Array(5).fill().map(() => action("ADDITIONAL_SAMPLE", "IMPROVED")),
            ...Array(6).fill().map(() => action("ADDITIONAL_SAMPLE", "UNCHANGED")),
            ...Array(1).fill().map(() => action("ADDITIONAL_SAMPLE", "WORSENED")),
            ...Array(2).fill().map(() => action("ADDITIONAL_SAMPLE", "RESOLVED")),
            ...Array(1).fill().map(() => action("ADDITIONAL_SAMPLE", "PENDING"))

        ];

    const grouped =
        OperationalActionAnalytics.groupByActionType(actions);

    check(grouped.length === 3, `3 tipos presentes -- got ${grouped.length}`);

    // Acción 6 -- orden del catálogo (2.7.0.5): INSPECTION antes que
    // TEMPERATURE_ADJUSTMENT antes que ADDITIONAL_SAMPLE.
    check(grouped[0].type === "INSPECTION" && grouped[1].type === "TEMPERATURE_ADJUSTMENT" && grouped[2].type === "ADDITIONAL_SAMPLE", `orden del catálogo -- got ${grouped.map(g => g.type).join(",")}`);
    check(grouped[0].typeLabel === "Inspección", "typeLabel viene del catálogo de 2.7.0.5");

    const inspection =
        grouped[0];

    check(inspection.total === 24 && inspection.evaluated === 22 && inspection.pending === 2, `Acción 6, ejemplo literal Inspección: Total 24/Evaluadas 22/Pending 2 -- got ${inspection.total}/${inspection.evaluated}/${inspection.pending}`);
    check(inspection.percentages.improved === 45.5, `Acción 13, ejemplo literal: Inspección Mejoró 45.5% -- got ${inspection.percentages.improved}`);
    check(inspection.percentages.resolved === 18.2, `Acción 13, ejemplo literal: Inspección Resolvió 18.2% -- got ${inspection.percentages.resolved}`);

    const temperature =
        grouped[1];

    check(temperature.total === 18 && temperature.evaluated === 17, "Acción 6, ejemplo literal Ajuste temperatura: Total 18/Evaluadas 17");
    check(temperature.percentages.improved === 52.9, `Acción 13, ejemplo literal: Ajuste temperatura Mejoró 52.9% -- got ${temperature.percentages.improved}`);
    check(temperature.percentages.resolved === 23.5, `Acción 13, ejemplo literal: Ajuste temperatura Resolvió 23.5% -- got ${temperature.percentages.resolved}`);

    const sample =
        grouped[2];

    check(sample.total === 15 && sample.evaluated === 14, "Acción 6, ejemplo literal Toma muestra adicional: Total 15/Evaluadas 14");
    check(sample.percentages.improved === 35.7, `Acción 13, ejemplo literal: Toma muestra Mejoró 35.7% -- got ${sample.percentages.improved}`);
    check(sample.percentages.resolved === 14.3, `Acción 13, ejemplo literal: Toma muestra Resolvió 14.3% -- got ${sample.percentages.resolved}`);

    // Acción 14 -- ninguno de estos tres grupos es una "muestra
    // limitada" (todos tienen evaluated >= 5).
    check(!inspection.smallSample && !temperature.smallSample && !sample.smallSample, "ninguno de los tres grupos del ejemplo es una muestra pequeña (evaluated >= 5 en los tres)");

}

// --- groupByActionType(): un tipo nunca usado no aparece --------------

{

    const grouped =
        OperationalActionAnalytics.groupByActionType([

            action("INSPECTION", "IMPROVED")

        ]);

    check(grouped.length === 1, "solo el tipo con al menos una acción aparece -- el catálogo completo no se rellena con filas en 0");
    check(grouped[0].type === "INSPECTION", "el único tipo presente es INSPECTION");

}

// --- Acción 14 -- muestra pequeña: 1 acción evaluada, 100% ------------

{

    const grouped =
        OperationalActionAnalytics.groupByActionType([

            action("INSPECTION", "IMPROVED")

        ]);

    const inspection =
        grouped[0];

    check(inspection.evaluated === 1, "1 acción evaluada");
    check(inspection.percentages.improved === 100, `Acción 14, ejemplo literal: Improved 100% (1 de 1) -- got ${inspection.percentages.improved}`);
    check(inspection.smallSample === true, "Acción 14: con evaluated=1 (< umbral de 5) se marca como muestra limitada, aunque el resultado sea 100%");

}

// --- groupBySeverity(): reproducción del ejemplo de la Acción 7 -------
// (agregado por severidad, no crosstab -- ver bySeverity anidado abajo)

{

    const actions =
        [

            action("TEMPERATURE_ADJUSTMENT", "IMPROVED", "WARNING"),
            action("TEMPERATURE_ADJUSTMENT", "IMPROVED", "WARNING"),
            action("TEMPERATURE_ADJUSTMENT", "IMPROVED", "WARNING"),
            action("TEMPERATURE_ADJUSTMENT", "UNCHANGED", "WARNING"),
            action("TEMPERATURE_ADJUSTMENT", "UNCHANGED", "WARNING"),

            action("TEMPERATURE_ADJUSTMENT", "IMPROVED", "CRITICAL"),
            action("TEMPERATURE_ADJUSTMENT", "WORSENED", "CRITICAL"),
            action("TEMPERATURE_ADJUSTMENT", "WORSENED", "CRITICAL"),
            action("TEMPERATURE_ADJUSTMENT", "WORSENED", "CRITICAL"),
            action("TEMPERATURE_ADJUSTMENT", "WORSENED", "CRITICAL")

        ];

    const bySeverity =
        OperationalActionAnalytics.groupBySeverity(actions);

    check(bySeverity.length === 2, `solo WARNING y CRITICAL están presentes -- got ${bySeverity.length}`);
    check(bySeverity[0].severity === "WARNING" && bySeverity[1].severity === "CRITICAL", `orden canónico WARNING antes que CRITICAL (SIGNIFICANT ausente se salta) -- got ${bySeverity.map(s => s.severity).join(",")}`);
    check(bySeverity[0].percentages.improved === 60, `Acción 7, ejemplo literal: WARNING Improved 60% -- got ${bySeverity[0].percentages.improved}`);
    check(bySeverity[1].percentages.improved === 20, `Acción 7, ejemplo literal: CRITICAL Improved 20% -- got ${bySeverity[1].percentages.improved}`);

}

// --- groupByActionType()[].bySeverity -- crosstab tipo×severidad -----
// (aditivo sobre el DTO literal, ver comentario de cabecera del módulo)

{

    const actions =
        [

            action("TEMPERATURE_ADJUSTMENT", "IMPROVED", "WARNING"),
            action("TEMPERATURE_ADJUSTMENT", "IMPROVED", "WARNING"),
            action("TEMPERATURE_ADJUSTMENT", "IMPROVED", "WARNING"),
            action("TEMPERATURE_ADJUSTMENT", "UNCHANGED", "WARNING"),
            action("TEMPERATURE_ADJUSTMENT", "UNCHANGED", "WARNING"),

            action("TEMPERATURE_ADJUSTMENT", "IMPROVED", "SIGNIFICANT"),
            action("TEMPERATURE_ADJUSTMENT", "UNCHANGED", "SIGNIFICANT"),

            action("TEMPERATURE_ADJUSTMENT", "IMPROVED", "CRITICAL"),
            action("TEMPERATURE_ADJUSTMENT", "WORSENED", "CRITICAL"),
            action("TEMPERATURE_ADJUSTMENT", "WORSENED", "CRITICAL"),
            action("TEMPERATURE_ADJUSTMENT", "WORSENED", "CRITICAL"),
            action("TEMPERATURE_ADJUSTMENT", "WORSENED", "CRITICAL"),

            // Otro tipo -- nunca debe mezclarse en el crosstab de
            // "Ajuste de temperatura".
            action("INSPECTION", "IMPROVED", "WARNING")

        ];

    const grouped =
        OperationalActionAnalytics.groupByActionType(actions);

    const temperature =
        grouped.find(g => g.type === "TEMPERATURE_ADJUSTMENT");

    check(Array.isArray(temperature.bySeverity), "cada grupo por tipo incluye su propio desglose por severidad");
    check(temperature.bySeverity.length === 3, `las tres severidades del ejemplo -- got ${temperature.bySeverity.length}`);

    const warning =
        temperature.bySeverity.find(s => s.severity === "WARNING");

    const significant =
        temperature.bySeverity.find(s => s.severity === "SIGNIFICANT");

    const critical =
        temperature.bySeverity.find(s => s.severity === "CRITICAL");

    check(warning.percentages.improved === 60, `Acción 7, ejemplo literal: Ajuste temperatura / WARNING Improved 60% -- got ${warning.percentages.improved}`);
    check(significant.percentages.improved === 50, `Ajuste temperatura / SIGNIFICANT Improved 50% (1 de 2) -- got ${significant.percentages.improved}`);
    check(critical.percentages.improved === 20, `Acción 7, ejemplo literal: Ajuste temperatura / CRITICAL Improved 20% -- got ${critical.percentages.improved}`);
    check(temperature.total === 12, `el crosstab nunca contamina el total del tipo -- got ${temperature.total}`);

    const inspection =
        grouped.find(g => g.type === "INSPECTION");

    check(inspection.bySeverity.length === 1 && inspection.bySeverity[0].severity === "WARNING", "el crosstab de Inspección nunca incluye las filas de Ajuste de temperatura");

}

// --- buildAnalyticsDTO(): forma completa del DTO ----------------------

{

    const dto =
        OperationalActionAnalytics.buildAnalyticsDTO([

            action("INSPECTION", "IMPROVED", "WARNING"),

            action("INSPECTION", "PENDING", "WARNING")

        ]);

    check(dto.summary && dto.byActionType && dto.bySeverity, "Acción 10: el DTO tiene los tres bloques -- summary/byActionType/bySeverity");
    check(dto.summary.total === 2 && dto.summary.evaluated === 1, "el bloque summary refleja el conjunto completo pasado");
    check(Array.isArray(dto.byActionType) && dto.byActionType.length === 1, "byActionType es un array, un elemento para este ejemplo");
    check(Array.isArray(dto.bySeverity) && dto.bySeverity.length === 1, "bySeverity es un array, un elemento para este ejemplo");

}

// --- buildAnalyticsDTO(): sin acciones ---------------------------------

{

    const dto =
        OperationalActionAnalytics.buildAnalyticsDTO([]);

    check(dto.summary.total === 0, "Acción 16: sin acciones -> summary.total = 0 (el controlador/frontend decide el mensaje, este módulo solo refleja los datos)");
    check(dto.byActionType.length === 0 && dto.bySeverity.length === 0, "sin acciones -> ambos desgloses vacíos, nunca null/undefined");

}

console.log(`${passed} assertions passed.`);
