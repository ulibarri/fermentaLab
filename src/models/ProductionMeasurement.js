const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductionMeasurement = sequelize.define("ProductionMeasurement", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    productionBatchId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    measurementDate: {

        type: DataTypes.DATE,

        allowNull: false

    },

    phase: {

        type: DataTypes.STRING(20),

        allowNull: false

    },

    ph: {

        type: DataTypes.DECIMAL(5, 2),

        allowNull: true

    },

    brix: {

        type: DataTypes.DECIMAL(5, 2),

        allowNull: true

    },

    brixLafmate: {

        type: DataTypes.DECIMAL(5, 2),

        allowNull: true

    },

    specificGravity: {

        type: DataTypes.DECIMAL(6, 4),

        allowNull: true

    },

    estimatedAlcohol: {

        type: DataTypes.DECIMAL(5, 2),

        allowNull: true

    },

    liquidTemperature: {

        type: DataTypes.DECIMAL(5, 2),

        allowNull: true

    },

    ambientTemperature: {

        type: DataTypes.DECIMAL(5, 2),

        allowNull: true

    },

    psi: {

        type: DataTypes.DECIMAL(10, 3),

        allowNull: true

    },

    co2Volumes: {

        type: DataTypes.DECIMAL(6, 3),

        allowNull: true

    },

    notes: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    // Entrega 2.8.0.1, sección 10 -- trazabilidad de la conversión
    // automática del hidrómetro. Los tres campos quedan NULL en
    // mediciones capturadas manualmente ANTES de esta entrega (nunca se
    // backfillea "MANUAL" retroactivamente, sección 11) y también en
    // mediciones nuevas capturadas manualmente (ver VALID_HYDROMETER_SCALES/
    // buildValues() en ProductionMeasurementService).
    hydrometerInputScale: {

        type: DataTypes.STRING(20),

        allowNull: true

    },

    hydrometerInputValue: {

        type: DataTypes.DECIMAL(10, 4),

        allowNull: true

    },

    hydrometerConversionMethod: {

        type: DataTypes.STRING(20),

        allowNull: true

    },

    // Entrega 2.8.0.2, sección 5 -- con qué VERSIÓN de tabla se calculó
    // una conversión automática. NULL en mediciones manuales y en
    // cualquier medición anterior a esta entrega (mismo criterio de
    // "nunca backfillear", ver la migración que agrega esta columna).
    hydrometerConversionTableId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    createdAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    updatedAt: {

        type: DataTypes.DATE,

        allowNull: true

    }

}, {

    tableName: "production_measurements",

    timestamps: true

});

module.exports = ProductionMeasurement;
