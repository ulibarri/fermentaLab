const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Product = sequelize.define("Product", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },
    categoryId: {

        type: DataTypes.INTEGER,

        allowNull: false

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

    active: {

        type: DataTypes.BOOLEAN,

        defaultValue: true

    }

}, {

    tableName: "products",

    timestamps: true

});

module.exports = Product;