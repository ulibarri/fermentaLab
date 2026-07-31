const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Category = sequelize.define("Category", {

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

        allowNull: true

    },

    active: {

        type: DataTypes.BOOLEAN,

        allowNull: false,

        defaultValue: true

    }

}, {

    tableName: "categories",

    timestamps: true

});

module.exports = Category;