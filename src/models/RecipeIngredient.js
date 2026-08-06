const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const RecipeIngredient = sequelize.define("RecipeIngredient", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    recipeVersionId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    ingredientId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    quantity: {

        type: DataTypes.DECIMAL(12, 3),

        allowNull: false

    },

    unitId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    sortOrder: {

        type: DataTypes.INTEGER,

        allowNull: false,

        defaultValue: 1

    },

    notes: {

        type: DataTypes.STRING(255),

        defaultValue: ""

    }

}, {

    tableName: "recipe_ingredients",

    timestamps: true

});

module.exports = RecipeIngredient;