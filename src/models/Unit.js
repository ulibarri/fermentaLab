const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Unit = sequelize.define("Unit", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    code: {

        type: DataTypes.STRING(10),

        allowNull: false,

        unique: true

    },

    name: {

        type: DataTypes.STRING(50),

        allowNull: false

    },

    symbol: {

        type: DataTypes.STRING(10),

        allowNull: false

    },

    active: {

        type: DataTypes.BOOLEAN,

        defaultValue: true

    }

}, {

    tableName: "units",

    timestamps: true

});

module.exports = Unit;