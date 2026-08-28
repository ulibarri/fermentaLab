/*
 * Entrega 2.7.0.5, sección 3 -- catálogo de tipos de acción operativa.
 * Módulo puro (sin Sequelize/Express): única fuente de verdad de los
 * códigos válidos, reutilizada por el servicio (validación de backend,
 * sección 14) y por el frontend (contenido del <select>, sección 2/3).
 *
 * "No debemos asumir que estas acciones necesariamente solucionan la
 * desviación. Son simplemente acciones que el operador puede
 * registrar" -- por eso este catálogo es descriptivo, nunca prescribe
 * ni dispara ningún efecto sobre el lote.
 */

const ACTION_TYPES = [

    { code: "NO_INTERVENTION", label: "Sin intervención" },

    { code: "INSPECTION", label: "Inspección" },

    { code: "TEMPERATURE_ADJUSTMENT", label: "Ajuste de temperatura" },

    { code: "LOCATION_TRANSFER", label: "Traslado de ubicación" },

    { code: "MEASUREMENT_REVIEW", label: "Revisión de mediciones" },

    { code: "ADDITIONAL_SAMPLE", label: "Toma de muestra adicional" },

    { code: "FERMENTATION_CONDITIONS_CHANGE", label: "Cambio de condiciones de fermentación" },

    { code: "EARLY_TERMINATION", label: "Finalización anticipada" },

    // Sección 4 -- siempre debe existir, para registrar una acción
    // todavía no contemplada en el catálogo.
    { code: "OTHER", label: "Otra" }

];

const ACTION_TYPE_CODES =
    ACTION_TYPES.map(t => t.code);

class ProductionAlertActionCatalog {

    static isValidType(type) {

        return ACTION_TYPE_CODES.includes(type);

    }

    // Sección 4 -- "la descripción será obligatoria cuando se
    // seleccione Otra". Ningún otro tipo la exige (aunque el frontend
    // la ofrezca siempre como campo disponible).
    static requiresDescription(type) {

        return type === "OTHER";

    }

    static typeLabel(type) {

        const found =
            ACTION_TYPES.find(t => t.code === type);

        return found ? found.label : (type || "—");

    }

    /*
     * Sección 14 -- validación de backend, nunca confiar solo en la
     * validación de JavaScript del formulario. Pura: no toca la base de
     * datos ni sabe si la alerta/lote existen (eso lo valida el
     * servicio, que sí tiene acceso a los repositorios).
     */
    static validate({ type, description } = {}) {

        const errors =
            [];

        if (!type) {

            errors.push("El tipo de acción es obligatorio.");

        } else if (!this.isValidType(type)) {

            errors.push(`Tipo de acción no válido: "${type}".`);

        }

        if (this.requiresDescription(type) && (!description || !String(description).trim())) {

            errors.push('La descripción es obligatoria cuando el tipo de acción es "Otra".');

        }

        return {

            valid: errors.length === 0,

            errors

        };

    }

}

ProductionAlertActionCatalog.ACTION_TYPES =
    ACTION_TYPES;

module.exports =
    ProductionAlertActionCatalog;
