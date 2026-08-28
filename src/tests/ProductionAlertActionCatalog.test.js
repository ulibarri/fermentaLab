const assert =
    require("assert");

const ProductionAlertActionCatalog =
    require("../utils/ProductionAlertActionCatalog");

let passed = 0;

function check(condition, message) {

    assert.ok(condition, message);

    passed++;

}

// ---- catálogo (sección 3) -------------------------------------------

{
    const codes =
        ProductionAlertActionCatalog.ACTION_TYPES.map(t => t.code);

    check(codes.length === 9, `sección 3: 9 tipos en el catálogo (8 propuestos + Otra) -- got ${codes.length}`);

    [ "NO_INTERVENTION", "INSPECTION", "TEMPERATURE_ADJUSTMENT", "LOCATION_TRANSFER", "MEASUREMENT_REVIEW", "ADDITIONAL_SAMPLE", "FERMENTATION_CONDITIONS_CHANGE", "EARLY_TERMINATION", "OTHER" ].forEach(code => {

        check(codes.includes(code), `catálogo incluye ${code}`);

    });

    check(codes[codes.length - 1] === "OTHER", "sección 4: 'Otra' siempre debe existir en el catálogo");
}

// ---- isValidType() ----------------------------------------------------

{
    check(ProductionAlertActionCatalog.isValidType("INSPECTION") === true, "INSPECTION es un tipo válido");
    check(ProductionAlertActionCatalog.isValidType("NOT_A_REAL_TYPE") === false, "un código inventado no es válido");
    check(ProductionAlertActionCatalog.isValidType(undefined) === false, "undefined no es válido");
}

// ---- requiresDescription() (sección 4) ---------------------------------

{
    check(ProductionAlertActionCatalog.requiresDescription("OTHER") === true, "sección 4: OTHER exige descripción");
    check(ProductionAlertActionCatalog.requiresDescription("INSPECTION") === false, "ningún otro tipo exige descripción por sí solo");
}

// ---- typeLabel() --------------------------------------------------------

{
    check(ProductionAlertActionCatalog.typeLabel("TEMPERATURE_ADJUSTMENT") === "Ajuste de temperatura", "typeLabel() -- etiqueta en español del mockup");
    check(ProductionAlertActionCatalog.typeLabel("UNKNOWN") === "UNKNOWN", "typeLabel() -- código desconocido se muestra tal cual, nunca lanza");
}

// ---- validate() (sección 14) --------------------------------------------

{
    const missingType =
        ProductionAlertActionCatalog.validate({ type: null, description: null });

    check(missingType.valid === false, "sin tipo -> inválido");
    check(missingType.errors.length === 1, "un solo error cuando falta el tipo");

    const invalidType =
        ProductionAlertActionCatalog.validate({ type: "BOGUS" });

    check(invalidType.valid === false, "tipo no perteneciente al catálogo -> inválido");

    const otherWithoutDescription =
        ProductionAlertActionCatalog.validate({ type: "OTHER", description: "" });

    check(otherWithoutDescription.valid === false, 'sección 4: OTHER sin descripción -> inválido');
    check(otherWithoutDescription.errors.some(e => e.includes("Otra")), "el mensaje de error menciona el requisito de 'Otra'");

    const otherWithWhitespaceOnly =
        ProductionAlertActionCatalog.validate({ type: "OTHER", description: "   " });

    check(otherWithWhitespaceOnly.valid === false, "descripción solo con espacios en blanco cuenta como vacía");

    const otherWithDescription =
        ProductionAlertActionCatalog.validate({ type: "OTHER", description: "Se descartó el lote por contaminación visible." });

    check(otherWithDescription.valid === true, "OTHER con descripción no vacía -> válido");

    const normalTypeWithoutDescription =
        ProductionAlertActionCatalog.validate({ type: "INSPECTION", description: null });

    check(normalTypeWithoutDescription.valid === true, "un tipo del catálogo sin OTHER no requiere descripción");
}

console.log(`\n${passed} assertions passed.`);
