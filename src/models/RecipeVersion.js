const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const RecipeVersion = sequelize.define("RecipeVersion", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    recipeId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    version: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    notes: {

        type: DataTypes.STRING(255),

        defaultValue: ""

    },

    isCurrent: {

        type: DataTypes.BOOLEAN,

        defaultValue: true

    },

    active: {

        type: DataTypes.BOOLEAN,

        defaultValue: true

    },
    batchSize: {

        type: DataTypes.DECIMAL(10, 3),

        allowNull: false

    },

    batchUnitId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    maturationMetric: {

        type: DataTypes.STRING(30),

        allowNull: true

    },

    maturationTarget: {

        type: DataTypes.DECIMAL(10, 4),

        allowNull: true

    },

    maturationRateThreshold: {

        type: DataTypes.DECIMAL(10, 4),

        allowNull: true

    },

    maturationTargetTolerance: {

        type: DataTypes.DECIMAL(10, 4),

        allowNull: true

    },


}, {

    tableName: "recipe_versions",

    timestamps: true

});

module.exports = RecipeVersion;