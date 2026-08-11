const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.6.1.11 — historial de qué modelo de maduración (LINEAR /
 * EXPONENTIAL, y los que se agreguen después — ver
 * src/utils/MaturationModelTypes.js) estuvo ACTIVE para cada
 * RecipeVersion, y por qué. Nunca se sobrescribe una fila: activar un
 * modelo nuevo desactiva (status=INACTIVE, deactivatedAt=ahora) la fila
 * ACTIVE anterior de esa misma recipeVersion y crea una fila nueva — el
 * historial completo queda preservado (ver
 * MaturationModelConfigurationService._activate()).
 */
const MaturationModelConfiguration = sequelize.define("MaturationModelConfiguration", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    recipeVersionId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    // "LINEAR" | "EXPONENTIAL" (ver MaturationModelTypes.AVAILABLE_MODEL_TYPES).
    modelType: {

        type: DataTypes.STRING(30),

        allowNull: false

    },

    // "ACTIVE" | "INACTIVE". Solo puede haber una fila ACTIVE por
    // recipeVersionId a la vez — garantizado por la transacción de
    // activación, no por una restricción de base de datos (ver la
    // migración que crea esta tabla).
    status: {

        type: DataTypes.STRING(20),

        allowNull: false,

        defaultValue: "INACTIVE"

    },

    activatedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    deactivatedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    // "MANUAL" | "RECOMMENDATION" — de dónde vino la decisión de
    // activar este modelo. Nunca lo decide el cliente: el servicio
    // siempre lo asigna según qué endpoint se invocó (ver
    // MaturationModelConfigurationService).
    source: {

        type: DataTypes.STRING(20),

        allowNull: false

    },

    // Texto libre: este proyecto no tiene sistema de usuarios/login, así
    // que "quién" activó el modelo se registra como texto (si el
    // cliente lo envía), no como una FK a una cuenta real.
    activatedBy: {

        type: DataTypes.STRING(120),

        allowNull: true

    },

    notes: {

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

    tableName: "maturation_model_configurations",

    timestamps: true

});

module.exports = MaturationModelConfiguration;
