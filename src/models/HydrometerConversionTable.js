const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.8.0.2 -- "fuente formal, validada y configurable" de la
 * tabla de conversión del fabricante (secciones 1-4). Reemplaza a
 * `src/data/hydrometerConversion.json` (2.6.1.x/2.8.0.1, embebida en
 * código) como fuente de verdad usada por las conversiones -- ver
 * `HydrometerConversionService` (reescrito en esta entrega para leer la
 * fila ACTIVE de este modelo en vez del JSON).
 *
 * Ciclo de vida (sección 12), calcado del de `MaturationModelCalibration`
 * (2.6.1.16): DRAFT -> VALIDATED -> ACTIVE -> INACTIVE. Nunca se salta
 * de DRAFT a ACTIVE directamente (una tabla con errores no puede
 * activarse, sección 12/17) y nunca hay más de una fila ACTIVE por
 * `instrument` a la vez -- garantizado por la transacción de activación
 * en `HydrometerConversionTableService`, no por una restricción de base
 * de datos (mismo criterio que MaturationModelCalibration).
 *
 * Versionado (sección 3): `version` es incremental DENTRO de
 * `instrument` (nunca global), calculado server-side. `parentTableId`
 * apunta a la versión que esta reemplaza (null en la primera versión de
 * un instrumento) -- mismo patrón que `parentCalibrationId`.
 */
const HydrometerConversionTable = sequelize.define("HydrometerConversionTable", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    // Nombre descriptivo, ej. "Brewer's Elite -- Tabla de fábrica".
    name: {

        type: DataTypes.STRING(150),

        allowNull: false

    },

    manufacturer: {

        type: DataTypes.STRING(150),

        allowNull: true

    },

    // Este proyecto NO soporta todavía múltiples modelos de instrumento
    // (cierre explícito de la sección de notas finales del spec: "no
    // agregar soporte multi-marca / multi-modelo de instrumento
    // todavía"). El campo existe (sección 2, lista conceptual de
    // campos) y es el alcance sobre el que se versiona/activa (sección
    // 3), pero `HydrometerConversionTableService` le asigna un valor
    // constante (`DEFAULT_INSTRUMENT`) cuando el llamador no especifica
    // uno -- deja la puerta abierta a un futuro selector de instrumento
    // sin otra migración.
    instrument: {

        type: DataTypes.STRING(60),

        allowNull: false

    },

    // Texto libre describiendo el origen de los datos (sección 2), ej.
    // "Ficha técnica impresa del fabricante, tabla @60°F".
    source: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    version: {

        type: DataTypes.INTEGER,

        allowNull: false,

        defaultValue: 1

    },

    parentTableId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    // "DRAFT" | "VALIDATED" | "ACTIVE" | "INACTIVE" (sección 12). Mismo
    // criterio de siempre en este proyecto: STRING + allow-list en el
    // servicio, nunca un Sequelize ENUM real.
    status: {

        type: DataTypes.STRING(20),

        allowNull: false,

        defaultValue: "DRAFT"

    },

    // Caché de presentación para la pantalla administrativa (sección
    // 10: "rango SG, número de filas") -- se recalcula cada vez que se
    // reemplazan las filas de la tabla (import o creación manual),
    // nunca se edita a mano.
    rowCount: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    minSg: {

        type: DataTypes.DECIMAL(10, 4),

        allowNull: true

    },

    maxSg: {

        type: DataTypes.DECIMAL(10, 4),

        allowNull: true

    },

    // Sección 17 -- errores de la validación MÁS RECIENTE (JSON
    // stringificado de un arreglo de strings), para que la pantalla
    // administrativa pueda mostrar "por qué esta tabla no puede
    // activarse" sin tener que volver a ejecutar la validación. Se
    // sobreescribe en cada intento de validar (éxito -> arreglo vacío,
    // fallo -> los mensajes específicos); nunca se acumula.
    lastValidationErrors: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    // Texto libre, sin sistema de autenticación en este proyecto (mismo
    // criterio que MaturationModelCalibration.createdBy).
    createdBy: {

        type: DataTypes.STRING(120),

        allowNull: true

    },

    validatedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    validatedBy: {

        type: DataTypes.STRING(120),

        allowNull: true

    },

    activatedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    activatedBy: {

        type: DataTypes.STRING(120),

        allowNull: true

    },

    deactivatedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    // Sección 14 -- "motivo del cambio". Capturado al crear una nueva
    // versión (reemplazo de una tabla existente), describe por qué se
    // reemplaza la versión anterior.
    changeReason: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    createdAt: {

        type: DataTypes.DATE,

        allowNull: false

    },

    updatedAt: {

        type: DataTypes.DATE,

        allowNull: false

    }

}, {

    tableName: "hydrometer_conversion_tables",

    timestamps: true

});

module.exports = HydrometerConversionTable;
