const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.6.1.16 — gestión y activación de calibraciones.
 *
 * Separa DETECTAR un sesgo (2.6.1.15, puramente analítico, nunca
 * persiste nada) de UTILIZAR una calibración (esta entidad). Cada fila
 * es una propuesta de corrección para un (modelType, recipeVersionId)
 * específico -- nunca solo el modelType (sección 2: "Tepache Original
 * v3" y "Tepache Original v4" son alcances distintos, igual que
 * "Tamarindo v2").
 *
 * Ciclo de vida (sección 1):
 *   PROPOSED -> APPROVED -> ACTIVE -> INACTIVE
 *            -> REJECTED
 *
 * Nunca se salta un estado (no se puede activar directamente una
 * PROPOSED -- sección 13) y nunca hay más de una fila ACTIVE por
 * (modelType, recipeVersionId) a la vez -- igual que
 * MaturationModelConfiguration en 2.6.1.11, garantizado por la
 * transacción de activación (ver
 * MaturationModelCalibrationService._activate()), no por una
 * restricción de base de datos.
 */
const MaturationModelCalibration = sequelize.define("MaturationModelCalibration", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    // "LINEAR" | "EXPONENTIAL" (ver MaturationModelTypes.AVAILABLE_MODEL_TYPES).
    modelType: {

        type: DataTypes.STRING(30),

        allowNull: false

    },

    recipeVersionId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    // Horas a sumar a la predicción cruda del modelo. Puede ser
    // negativo (el modelo predice tarde -> hay que adelantar la
    // predicción final).
    offsetHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: false

    },

    // "PROPOSED" | "APPROVED" | "ACTIVE" | "REJECTED" | "INACTIVE".
    status: {

        type: DataTypes.STRING(20),

        allowNull: false,

        defaultValue: "PROPOSED"

    },

    // Tamaño de muestra y Bias del análisis (2.6.1.15) que originó esta
    // propuesta -- congelados al crearla, no se recalculan después.
    sampleSize: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    biasHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    reason: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    approvedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    rejectedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    // Entrega 2.6.1.24, secciones 7/8 -- quién aprobó/rechazó y por qué
    // se rechazó. Texto libre, mismo criterio que `createdBy` (sin
    // sistema de autenticación todavía).
    approvedBy: {

        type: DataTypes.STRING(100),

        allowNull: true

    },

    rejectedBy: {

        type: DataTypes.STRING(100),

        allowNull: true

    },

    rejectionReason: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    activatedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    // Entrega 2.6.1.25, sección 7 -- quién decidió activarla. Texto
    // libre, mismo criterio que approvedBy/rejectedBy/createdBy.
    activatedBy: {

        type: DataTypes.STRING(100),

        allowNull: true

    },

    deactivatedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    // Texto libre: este proyecto no tiene sistema de usuarios/login
    // (mismo criterio que MaturationModelConfiguration.activatedBy).
    createdBy: {

        type: DataTypes.STRING(120),

        allowNull: true

    },

    // Entrega 2.6.1.19 -- versionado (sección 2/3). `parentCalibrationId`
    // es null en la primera versión de una cadena para un (modelType,
    // recipeVersionId); en cualquier reemplazo apunta a la calibración
    // que reemplaza. `version` es incremental DENTRO de (modelType,
    // recipeVersionId) -- nunca global -- calculado por
    // MaturationModelCalibrationRepository.create(), nunca aceptado del
    // cliente.
    parentCalibrationId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    version: {

        type: DataTypes.INTEGER,

        allowNull: false,

        defaultValue: 1

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

    tableName: "maturation_model_calibrations",

    timestamps: true

});

module.exports = MaturationModelCalibration;
