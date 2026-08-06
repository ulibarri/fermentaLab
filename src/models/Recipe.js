const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Recipe = sequelize.define("Recipe", {

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

    productId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    name: {

        type: DataTypes.STRING(100),

        allowNull: false

    },

    description: {

        type: DataTypes.STRING(255),

        defaultValue: ""

    },

    active: {

        type: DataTypes.BOOLEAN,

        defaultValue: true

    }

}, {

    tableName: "recipes",

    timestamps: true

});

module.exports = Recipe;