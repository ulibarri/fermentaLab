const assert = require("assert");

const AlertTrendAnalysis =
    require("../utils/AlertTrendAnalysis");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

function alert({ id, status, severity, createdAt, resolvedAt = null, productId = null, productName = null, batchId = null, batchNumber = null }) {

    return { id, status, severity, createdAt, resolvedAt, productId, productName, batchId, batchNumber };

}

// --- buildSummary(): reproducción exacta del ejemplo literal, Sección 3/12 -

{

    const alerts =
        [

            ...Array(7).fill().map((_, i) => alert({ id: `a${i}`, status: "ACTIVE", severity: "WARNING", createdAt: "2026-08-20T10:00:00.000Z" })),

            ...Array(79).fill().map((_, i) => alert({ id: `r${i}`, status: "RESOLVED", severity: "WARNING", createdAt: "2026-08-01T10:00:00.000Z", resolvedAt: "2026-08-01T12:00:00.000Z" })),

            // 12 críticas dentro del total de 86 (7 activas + 79
            // resueltas ya suman 86 -- se reasignan 12 de las
            // resueltas a severidad CRITICAL para el ejemplo).

        ];

    // Reasigna 12 de las 79 resueltas a CRITICAL para reproducir "Críticas: 12".
    for (let i = 0; i < 12; i++) {

        alerts.find(a => a.id === `r${i}`).severity = "CRITICAL";

    }

    const summary =
        AlertTrendAnalysis.buildSummary(alerts);

    check(summary.total === 86, `Sección 3, ejemplo literal: Total 86 -- got ${summary.total}`);
    check(summary.active === 7, `Sección 3, ejemplo literal: Activas 7 -- got ${summary.active}`);
    check(summary.resolved === 79, `Sección 3, ejemplo literal: Resueltas 79 -- got ${summary.resolved}`);
    check(summary.critical === 12, `Sección 3, ejemplo literal: Críticas 12 -- got ${summary.critical}`);
    check(summary.resolutionRate === 91.9, `Sección 3, ejemplo literal: Tasa resolución 91.9% (79/86) -- got ${summary.resolutionRate}`);

}

// --- buildSummary(): sin alertas / división entre cero ------------------

{

    const summary =
        AlertTrendAnalysis.buildSummary([]);

    check(summary.total === 0 && summary.active === 0 && summary.resolved === 0, "sin alertas: todos los conteos en 0");
    check(summary.resolutionRate === null, "Sección 12: sin alertas -> tasa de resolución N/A (null), nunca división entre cero");

}

// --- buildSummary(): solo alertas activas --------------------------------

{

    const summary =
        AlertTrendAnalysis.buildSummary([

            alert({ id: 1, status: "ACTIVE", severity: "WARNING", createdAt: "2026-08-20T10:00:00.000Z" }),

            alert({ id: 2, status: "ACTIVE", severity: "CRITICAL", createdAt: "2026-08-21T10:00:00.000Z" })

        ]);

    check(summary.total === 2 && summary.active === 2 && summary.resolved === 0, "solo activas: 2 total, 2 activas, 0 resueltas");
    check(summary.resolutionRate === 0, "0 resueltas de 2 total -> 0% (no null -- el denominador SÍ es > 0 aquí)");

}

// --- buildDuration(): sin alertas resueltas (Sección 17) -----------------

{

    const duration =
        AlertTrendAnalysis.buildDuration([]);

    check(duration.sampleSize === 0, "sin alertas resueltas -> sampleSize 0");
    check(duration.averageMinutes === null && duration.medianMinutes === null && duration.minMinutes === null && duration.maxMinutes === null, "Sección 17: 'No existen alertas resueltas para calcular la duración' -- todos los campos null, nunca 0 ni NaN");
    check(duration.smallSample === false, "sin muestra, smallSample no se activa (no hay nada que describir)");

}

// --- buildDuration(): una sola alerta resuelta (Sección 17/18) -----------

{

    const duration =
        AlertTrendAnalysis.buildDuration([

            alert({ id: 1, status: "RESOLVED", severity: "WARNING", createdAt: "2026-08-20T10:00:00.000Z", resolvedAt: "2026-08-20T11:30:00.000Z" })

        ]);

    check(duration.sampleSize === 1, "1 alerta resuelta");
    check(duration.averageMinutes === 90 && duration.medianMinutes === 90 && duration.minMinutes === 90 && duration.maxMinutes === 90, `Sección 17: con 1 muestra, promedio/mediana/mín/máx son todos el mismo valor (90 min) -- got ${JSON.stringify(duration)}`);
    check(duration.smallSample === true, "Sección 18: 1 alerta resuelta es una muestra pequeña -- debe mostrarse el tamaño de la muestra");

}

// --- buildDuration(): promedio/mediana/mín/máx correctos ------------------

{

    // 5 alertas resueltas con duraciones conocidas: 10, 20, 30, 40, 400 min.
    const resolvedAlerts =
        [10, 20, 30, 40, 400].map((minutes, i) => alert({

            id: i,

            status: "RESOLVED",

            severity: "WARNING",

            createdAt: "2026-08-20T10:00:00.000Z",

            resolvedAt: new Date(new Date("2026-08-20T10:00:00.000Z").getTime() + minutes * 60000).toISOString()

        }));

    const duration =
        AlertTrendAnalysis.buildDuration(resolvedAlerts);

    check(duration.sampleSize === 5, "5 alertas resueltas");
    check(duration.averageMinutes === 100, `promedio (10+20+30+40+400)/5 = 100 -- got ${duration.averageMinutes}`);
    check(duration.medianMinutes === 30, `mediana del conjunto ordenado [10,20,30,40,400] = 30 -- got ${duration.medianMinutes}`);
    check(duration.minMinutes === 10 && duration.maxMinutes === 400, `Sección 8: mínima y máxima correctas -- got ${duration.minMinutes}/${duration.maxMinutes}`);
    check(duration.smallSample === false, "5 alertas alcanza el umbral mínimo confiable -- no es muestra pequeña");
    check(duration.medianMinutes < duration.averageMinutes, "Sección 8: la mediana (30) es mucho menor que el promedio (100) -- exactamente el caso que el spec advierte que un valor extremo (400) puede distorsionar");

}

// --- buildDurationBySeverity(): por severidad, orden canónico -----------

{

    const resolvedAlerts =
        [

            alert({ id: 1, status: "RESOLVED", severity: "WARNING", createdAt: "2026-08-20T10:00:00.000Z", resolvedAt: "2026-08-20T12:00:00.000Z" }), // 120 min

            alert({ id: 2, status: "RESOLVED", severity: "WARNING", createdAt: "2026-08-20T10:00:00.000Z", resolvedAt: "2026-08-20T12:20:00.000Z" }), // 140 min

            alert({ id: 3, status: "RESOLVED", severity: "CRITICAL", createdAt: "2026-08-20T10:00:00.000Z", resolvedAt: "2026-08-20T19:15:00.000Z" }), // 555 min

            alert({ id: 4, status: "RESOLVED", severity: "CRITICAL", createdAt: "2026-08-20T10:00:00.000Z", resolvedAt: "2026-08-20T19:15:00.000Z" }) // 555 min

        ];

    const bySeverity =
        AlertTrendAnalysis.buildDurationBySeverity(resolvedAlerts);

    check(bySeverity.length === 2, "solo WARNING y CRITICAL están presentes (SIGNIFICANT no aparece si no hay ninguna)");
    check(bySeverity[0].severity === "WARNING" && bySeverity[1].severity === "CRITICAL", "Sección 9: orden canónico WARNING antes que CRITICAL");
    check(bySeverity[0].averageMinutes === 130, `Sección 9, ejemplo literal: WARNING promedio 2h10m = 130 min -- got ${bySeverity[0].averageMinutes}`);
    check(bySeverity[1].averageMinutes === 555, `Sección 9, ejemplo literal: CRITICAL promedio 9h15m = 555 min -- got ${bySeverity[1].averageMinutes}`);

}

// --- buildSeverityDistribution(): reproducción exacta del ejemplo, Sección 6

{

    const alerts =
        [

            ...Array(48).fill().map((_, i) => alert({ id: `w${i}`, status: "ACTIVE", severity: "WARNING", createdAt: "2026-08-20T10:00:00.000Z" })),

            ...Array(26).fill().map((_, i) => alert({ id: `s${i}`, status: "ACTIVE", severity: "SIGNIFICANT", createdAt: "2026-08-20T10:00:00.000Z" })),

            ...Array(12).fill().map((_, i) => alert({ id: `c${i}`, status: "ACTIVE", severity: "CRITICAL", createdAt: "2026-08-20T10:00:00.000Z" }))

        ];

    const distribution =
        AlertTrendAnalysis.buildSeverityDistribution(alerts);

    check(distribution.length === 3, "3 severidades presentes");
    check(distribution[0].severity === "WARNING" && distribution[0].count === 48, `Sección 6, ejemplo literal: WARNING 48 -- got ${distribution[0].count}`);
    check(distribution[0].percentage === 55.8, `Sección 6, ejemplo literal: WARNING 55.8% -- got ${distribution[0].percentage}`);
    check(distribution[1].severity === "SIGNIFICANT" && distribution[1].count === 26 && distribution[1].percentage === 30.2, `Sección 6, ejemplo literal: SIGNIFICANT 26/30.2% -- got ${distribution[1].count}/${distribution[1].percentage}`);
    check(distribution[2].severity === "CRITICAL" && distribution[2].count === 12 && distribution[2].percentage === 14, `Sección 6, ejemplo literal: CRITICAL 12/14.0% -- got ${distribution[2].count}/${distribution[2].percentage}`);

}

// --- buildTimeline(): creadas vs. resueltas por semana (Sección 4/5) ----

{

    const alerts =
        [

            // Semana del 2026-08-03 (lunes) -- 3 creadas, resueltas la
            // semana SIGUIENTE (2026-08-10) para poder distinguir el
            // bucket de "creadas" del de "resueltas" (Sección 5).
            alert({ id: 1, status: "RESOLVED", severity: "WARNING", createdAt: "2026-08-03T09:00:00.000Z", resolvedAt: "2026-08-12T09:00:00.000Z" }),

            alert({ id: 2, status: "RESOLVED", severity: "WARNING", createdAt: "2026-08-04T09:00:00.000Z", resolvedAt: "2026-08-13T09:00:00.000Z" }),

            alert({ id: 3, status: "ACTIVE", severity: "SIGNIFICANT", createdAt: "2026-08-05T09:00:00.000Z" }),

            // Semana del 2026-08-10 -- 1 creada, y las 2 resueltas de
            // arriba caen aquí también (resolvedAt en esta semana).
            alert({ id: 4, status: "ACTIVE", severity: "WARNING", createdAt: "2026-08-11T09:00:00.000Z" })

        ];

    const timeline =
        AlertTrendAnalysis.buildTimeline(alerts, "WEEK");

    check(timeline.length === 2, `2 semanas con actividad -- got ${timeline.length}`);
    check(timeline[0].periodStart === "2026-08-03", `Sección 4/14: bucket semanal inicia en lunes -- got ${timeline[0].periodStart}`);
    check(timeline[0].created === 3, `Sección 4: 3 alertas creadas en la primera semana -- got ${timeline[0].created}`);
    check(timeline[0].resolved === 0, "ninguna resuelta DENTRO de esa misma semana en este ejemplo");
    check(timeline[0].bySeverity.WARNING === 2 && timeline[0].bySeverity.SIGNIFICANT === 1, `Sección 7: evolución de severidad por período -- got ${JSON.stringify(timeline[0].bySeverity)}`);

    check(timeline[1].periodStart === "2026-08-10", `segunda semana -- got ${timeline[1].periodStart}`);
    check(timeline[1].created === 1, "1 alerta creada en la segunda semana");
    check(timeline[1].resolved === 2, `Sección 5: 2 alertas RESUELTAS en la segunda semana (aunque fueron creadas en la primera) -- got ${timeline[1].resolved}`);

}

// --- buildTimeline(): agrupamiento por día y por mes ----------------------

{

    const alerts =
        [

            alert({ id: 1, status: "ACTIVE", severity: "WARNING", createdAt: "2026-08-01T08:00:00.000Z" }),

            alert({ id: 2, status: "ACTIVE", severity: "WARNING", createdAt: "2026-08-01T20:00:00.000Z" }),

            alert({ id: 3, status: "ACTIVE", severity: "WARNING", createdAt: "2026-08-02T08:00:00.000Z" })

        ];

    const byDay =
        AlertTrendAnalysis.buildTimeline(alerts, "DAY");

    check(byDay.length === 2 && byDay[0].created === 2 && byDay[1].created === 1, `Sección 4: 'por día' para períodos cortos -- got ${JSON.stringify(byDay.map(b => [b.periodStart, b.created]))}`);

    const byMonth =
        AlertTrendAnalysis.buildTimeline([

            alert({ id: 1, status: "ACTIVE", severity: "WARNING", createdAt: "2026-08-01T08:00:00.000Z" }),

            alert({ id: 2, status: "ACTIVE", severity: "WARNING", createdAt: "2026-08-28T08:00:00.000Z" }),

            alert({ id: 3, status: "ACTIVE", severity: "WARNING", createdAt: "2026-09-02T08:00:00.000Z" })

        ], "MONTH");

    check(byMonth.length === 2 && byMonth[0].periodStart === "2026-08-01" && byMonth[0].created === 2 && byMonth[1].periodStart === "2026-09-01" && byMonth[1].created === 1, `Sección 4: 'por mes' para períodos largos -- got ${JSON.stringify(byMonth)}`);

    // Un groupBy inválido/ausente cae de forma segura al default (WEEK),
    // nunca revienta.
    const byInvalid =
        AlertTrendAnalysis.buildTimeline(alerts, "BOGUS");

    check(byInvalid.every(b => b.groupBy === "WEEK"), "un groupBy no reconocido cae al default (WEEK) de forma segura");

}

// --- buildByProduct(): agrupación + Sección 11, sin normalizar ------------

{

    const alerts =
        [

            ...Array(35).fill().map((_, i) => alert({ id: `t${i}`, status: i < 32 ? "RESOLVED" : "ACTIVE", severity: i < 4 ? "CRITICAL" : "WARNING", createdAt: "2026-08-01T10:00:00.000Z", resolvedAt: i < 32 ? "2026-08-01T12:00:00.000Z" : null, productId: 1, productName: "Tepache Original" })),

            ...Array(28).fill().map((_, i) => alert({ id: `u${i}`, status: i < 26 ? "RESOLVED" : "ACTIVE", severity: i < 5 ? "CRITICAL" : "WARNING", createdAt: "2026-08-01T10:00:00.000Z", resolvedAt: i < 26 ? "2026-08-01T12:00:00.000Z" : null, productId: 2, productName: "Tepache Tamarindo" }))

        ];

    const byProduct =
        AlertTrendAnalysis.buildByProduct(alerts);

    check(byProduct.length === 2, "2 productos presentes");
    check(byProduct[0].productName === "Tepache Original" && byProduct[0].total === 35, `Sección 11, ejemplo literal: Tepache Original 35 alertas -- got ${byProduct[0].total}`);
    check(byProduct[0].resolved === 32 && byProduct[0].active === 3 && byProduct[0].critical === 4, `Sección 11, ejemplo literal: 32 resueltas/3 activas/4 críticas -- got ${byProduct[0].resolved}/${byProduct[0].active}/${byProduct[0].critical}`);
    check(byProduct[1].productName === "Tepache Tamarindo" && byProduct[1].total === 28 && byProduct[1].resolved === 26 && byProduct[1].active === 2 && byProduct[1].critical === 5, `Sección 11, ejemplo literal: Tepache Tamarindo 28/26/2/5 -- got ${byProduct[1].total}/${byProduct[1].resolved}/${byProduct[1].active}/${byProduct[1].critical}`);

}

// --- buildByProduct(): alertas sin producto identificable -----------------

{

    const byProduct =
        AlertTrendAnalysis.buildByProduct([

            alert({ id: 1, status: "ACTIVE", severity: "WARNING", createdAt: "2026-08-01T10:00:00.000Z", productId: null, productName: null })

        ]);

    check(byProduct.length === 1 && byProduct[0].productId === null, "alertas sin producto identificable se agrupan aparte, nunca se descartan");
    check(byProduct[0].productName === "Sin producto identificado", "etiqueta explícita para el grupo sin producto");

}

// --- buildOldestActive(): orden y minutos activos (Sección 10) -----------

{

    const now =
        new Date("2026-08-22T18:00:00.000Z");

    const alerts =
        [

            alert({ id: 1, status: "RESOLVED", severity: "WARNING", createdAt: "2026-08-01T10:00:00.000Z", resolvedAt: "2026-08-01T11:00:00.000Z" }),

            alert({ id: 2, status: "ACTIVE", severity: "SIGNIFICANT", createdAt: "2026-08-22T09:40:00.000Z", batchId: 5, batchNumber: "TP-20260821-003" }),

            alert({ id: 3, status: "ACTIVE", severity: "CRITICAL", createdAt: "2026-08-22T11:50:00.000Z", batchId: 6, batchNumber: "KT-20260822-001" })

        ];

    const oldest =
        AlertTrendAnalysis.buildOldestActive(alerts, { now });

    check(oldest.length === 2, "solo las 2 ACTIVE aparecen -- la RESOLVED nunca entra en 'más antiguas activas'");
    check(oldest[0].id === 2, "la alerta 2 (creada primero) aparece antes que la 3 -- orden de más antigua a más reciente");
    check(oldest[0].activeMinutes === 500, `Sección 10, ejemplo literal: 'Activa desde hace 8 h 20 min' = 500 min -- got ${oldest[0].activeMinutes}`);
    check(oldest[1].activeMinutes === 370, `Sección 10, ejemplo literal: 'Activa desde hace 6 h 10 min' = 370 min -- got ${oldest[1].activeMinutes}`);
    check(oldest[0].batchNumber === "TP-20260821-003", "conserva la referencia al lote, necesaria para '[Ver alerta]'");

}

// --- buildOldestActive(): respeta el límite --------------------------------

{

    const alerts =
        Array(15).fill().map((_, i) => alert({ id: i, status: "ACTIVE", severity: "WARNING", createdAt: `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00.000Z` }));

    const oldest =
        AlertTrendAnalysis.buildOldestActive(alerts, { limit: 10, now: new Date("2026-08-22T00:00:00.000Z") });

    check(oldest.length === 10, `Sección 10: la lista se limita a un tope razonable, nunca todas las activas sin límite -- got ${oldest.length}`);
    check(oldest[0].id === 0, "la más antigua de todas encabeza la lista, incluso truncada");

}

// --- buildTrendDTO(): forma completa del DTO (Sección 16) ----------------

{

    const dto =
        AlertTrendAnalysis.buildTrendDTO([

            alert({ id: 1, status: "RESOLVED", severity: "WARNING", createdAt: "2026-08-01T10:00:00.000Z", resolvedAt: "2026-08-01T12:00:00.000Z", productId: 1, productName: "Tepache" }),

            alert({ id: 2, status: "ACTIVE", severity: "CRITICAL", createdAt: "2026-08-20T10:00:00.000Z", productId: 1, productName: "Tepache" })

        ]);

    check(

        dto.summary && dto.duration && dto.durationBySeverity && dto.timeline && dto.bySeverity && dto.byProduct && dto.oldestActive,

        "Sección 16: el DTO tiene los siete bloques -- summary/duration/durationBySeverity/timeline/bySeverity/byProduct/oldestActive"

    );

    check(dto.summary.total === 2, "summary refleja el conjunto completo");
    check(Array.isArray(dto.timeline) && Array.isArray(dto.bySeverity) && Array.isArray(dto.byProduct) && Array.isArray(dto.oldestActive), "los cuatro desgloses son arrays");

}

// --- buildTrendDTO(): sin alertas (Sección 17) -----------------------------

{

    const dto =
        AlertTrendAnalysis.buildTrendDTO([]);

    check(dto.summary.total === 0, "Sección 17: 'No hay alertas registradas para el período seleccionado' -- summary.total = 0");
    check(dto.timeline.length === 0 && dto.bySeverity.length === 0 && dto.byProduct.length === 0 && dto.oldestActive.length === 0, "sin alertas -> todos los desgloses vacíos, nunca null/undefined");
    check(dto.duration.sampleSize === 0, "sin alertas -> duración sin muestra");

}

console.log(`${passed} assertions passed.`);
