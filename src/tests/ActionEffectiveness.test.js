const assert =
    require("assert");

const ActionEffectiveness =
    require("../utils/ActionEffectiveness");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

// ---- classify() -- ejemplo literal sección 1 ----------------------------

{
    // Antes +4h30 (270 min), Después +1h15 (75 min) -> MEJORA OBSERVADA.
    const improved =
        ActionEffectiveness.classify({ deviationMinutesBefore: 270, deviationMinutesAfter: 75, alertStillActive: true });

    check(improved === "IMPROVED", `sección 1, ejemplo 1: +4h30->+1h15 -> IMPROVED -- got ${improved}`);

    // Antes +3h (180), Después +3h20 (200) -> SIN MEJORA SIGNIFICATIVA.
    const unchanged =
        ActionEffectiveness.classify({ deviationMinutesBefore: 180, deviationMinutesAfter: 200, alertStillActive: true });

    check(unchanged === "UNCHANGED", `sección 1, ejemplo 2: +3h->+3h20 -> UNCHANGED -- got ${unchanged}`);

    // Antes +3h (180), Después +7h (420) -> EMPEORAMIENTO OBSERVADO.
    const worsened =
        ActionEffectiveness.classify({ deviationMinutesBefore: 180, deviationMinutesAfter: 420, alertStillActive: true });

    check(worsened === "WORSENED", `sección 1, ejemplo 3: +3h->+7h -> WORSENED -- got ${worsened}`);
}

// ---- classify() -- sección 6, RESOLVED vs. IMPROVED ----------------------

{
    // Antes +5h (300), Después +1h (60), pero SIGUE activa (todavía fuera
    // de rango) -> IMPROVED, nunca RESOLVED.
    const stillActive =
        ActionEffectiveness.classify({ deviationMinutesBefore: 300, deviationMinutesAfter: 60, alertStillActive: true });

    check(stillActive === "IMPROVED", `sección 6: mejoró pero sigue fuera de rango -> IMPROVED, nunca RESOLVED -- got ${stillActive}`);

    // Antes +5h (300), la alerta ya NO está activa (volvió al rango) ->
    // RESOLVED, sin importar la magnitud del cambio.
    const resolved =
        ActionEffectiveness.classify({ deviationMinutesBefore: 300, deviationMinutesAfter: 20, alertStillActive: false });

    check(resolved === "RESOLVED", `sección 6: la alerta dejó de existir -> RESOLVED -- got ${resolved}`);

    // RESOLVED gana incluso sin deviationMinutesAfter numérico (no hay
    // una cifra "actual" que mostrar una vez resuelta la alerta).
    const resolvedWithoutAfter =
        ActionEffectiveness.classify({ deviationMinutesBefore: 300, deviationMinutesAfter: null, alertStillActive: false });

    check(resolvedWithoutAfter === "RESOLVED", "RESOLVED no depende de tener un valor numérico 'después' -- la ausencia de alerta activa basta");
}

// ---- classify() -- sección 7, umbral mínimo de mejora --------------------

{
    // Antes +4h (240), Después +3h50 (230) -> cambio de 10 min, por
    // debajo del umbral de 30 -> UNCHANGED.
    const smallChange =
        ActionEffectiveness.classify({ deviationMinutesBefore: 240, deviationMinutesAfter: 230, alertStillActive: true });

    check(smallChange === "UNCHANGED", `sección 7, ejemplo literal: +4h->+3h50 (10 min) por debajo del umbral -> UNCHANGED -- got ${smallChange}`);

    // Antes +4h (240), Después +3h (180) -> cambio de 60 min, por encima
    // del umbral de 30 -> IMPROVED.
    const bigChange =
        ActionEffectiveness.classify({ deviationMinutesBefore: 240, deviationMinutesAfter: 180, alertStillActive: true });

    check(bigChange === "IMPROVED", `sección 7, ejemplo literal: +4h->+3h (60 min) por encima del umbral -> IMPROVED -- got ${bigChange}`);

    // Umbral configurable -- con un umbral de 5 minutos, el mismo cambio
    // de 10 minutos del primer caso SÍ cuenta como mejora.
    const customThreshold =
        ActionEffectiveness.classify({ deviationMinutesBefore: 240, deviationMinutesAfter: 230, alertStillActive: true, minimumImprovementMinutes: 5 });

    check(customThreshold === "IMPROVED", "sección 7: 'deberá ser configurable' -- un umbral menor convierte el mismo cambio en IMPROVED");

    // Exactamente en el umbral (30) cuenta como mejora (>=, no >).
    const exactlyAtThreshold =
        ActionEffectiveness.classify({ deviationMinutesBefore: 240, deviationMinutesAfter: 210, alertStillActive: true });

    check(exactlyAtThreshold === "IMPROVED", "cambio exactamente igual al umbral (30 min) cuenta como IMPROVED (>=)");
}

// ---- classify() -- magnitud, no signo -------------------------------------

{
    // Antes +4h30 (270, SLOWER), Después -0h10 (-10, FASTER) -- cruzó de
    // "retrasado" a "adelantado", pero la MAGNITUD bajó de 270 a 10 ->
    // sigue siendo una mejora real.
    const crossedZero =
        ActionEffectiveness.classify({ deviationMinutesBefore: 270, deviationMinutesAfter: -10, alertStillActive: true });

    check(crossedZero === "IMPROVED", `la comparación usa magnitud (valor absoluto), no signo -- cruzar de SLOWER a FASTER con magnitud menor sigue siendo IMPROVED -- got ${crossedZero}`);
}

// ---- classify() -- PENDING defensivo --------------------------------------

{
    const noAfterYet =
        ActionEffectiveness.classify({ deviationMinutesBefore: 270, deviationMinutesAfter: null, alertStillActive: true });

    check(noAfterYet === "PENDING", "sección 13: sin observación posterior todavía (y la alerta sigue activa) -> PENDING, nunca inventa un resultado");

    const noBefore =
        ActionEffectiveness.classify({ deviationMinutesBefore: undefined, deviationMinutesAfter: 100, alertStillActive: true });

    check(noBefore === "PENDING", "sin valor 'antes' (caso defensivo) -> PENDING");
}

// ---- changeMinutes() (sección 9, "Cambio: -3h 10m") -----------------------

{
    // Sección 9, ejemplo literal del mockup: Antes +4h30 (270), Después
    // +1h20 (80) -> "Cambio: -3h 10m" = -190 minutos.
    check(ActionEffectiveness.changeMinutes(270, 80) === -190, `sección 9, ejemplo literal: "Cambio: -3h 10m" -- got ${ActionEffectiveness.changeMinutes(270, 80)}`);
    check(ActionEffectiveness.changeMinutes(180, 420) === 240, "empeoramiento -> cambio positivo (240 min más de magnitud)");
    check(ActionEffectiveness.changeMinutes(null, 100) === null, "sin 'antes' -> null, nunca fabricado");
    check(ActionEffectiveness.changeMinutes(100, undefined) === null, "sin 'después' -> null, nunca fabricado");
}

// ---- isValidStatus() -------------------------------------------------------

{
    check(ActionEffectiveness.isValidStatus("IMPROVED") === true, "IMPROVED es un estado válido");
    check(ActionEffectiveness.isValidStatus("BOGUS") === false, "un estado inventado no es válido");
    check(ActionEffectiveness.EFFECTIVENESS_STATUSES.length === 5, "sección 5: exactamente 5 estados -- PENDING/IMPROVED/UNCHANGED/WORSENED/RESOLVED");
}

console.log(`\n${passed} assertions passed.`);
