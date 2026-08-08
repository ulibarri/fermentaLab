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
