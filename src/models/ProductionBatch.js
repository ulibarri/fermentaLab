const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductionBatch = sequelize.define("ProductionBatch", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    batchNumber: {

        type: DataTypes.STRING(30),

        allowNull: false,

        unique: true

    },

    recipeVersionId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    plannedVolume: {

        type: DataTypes.DECIMAL(10, 3),

        allowNull: false

    },

    targetVolume: {

        type: DataTypes.DECIMAL(10, 3),

        allowNull: true

    },

    producedVolume: {

        type: DataTypes.DECIMAL(10, 3),

        allowNull: true

    },

    status: {

        type: DataTypes.STRING(30),

        allowNull: false,

        defaultValue: "PLANNED"

    },

    startedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    finishedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },
    secondFermentStartedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    secondFermentFinishedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },
    finalPsiReading: {

        type: DataTypes.DECIMAL(10, 3),

        allowNull: true

    },

    createdAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    updatedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },


    notes: {

        type: DataTypes.TEXT,

        allowNull: true

    }

}, {

    tableName: "production_batches",

    timestamps: true

});

module.exports = ProductionBatch;