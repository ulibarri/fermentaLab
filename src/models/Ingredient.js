const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Ingredient = sequelize.define("Ingredient", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    code: {

        type: DataTypes.STRING(20),

        allowNull: false,

        unique: true

    },

    name: {

        type: DataTypes.STRING(100),

        allowNull: false

    },

    description: {

        type: DataTypes.STRING(255),

        defaultValue: ""

    },

    unitId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    active: {

        type: DataTypes.BOOLEAN,

        defaultValue: true

    }

}, {

    tableName: "ingredients",

    timestamps: true

});

module.exports = Ingredient;