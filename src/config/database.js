const { Sequelize } = require("sequelize");

const sequelize = new Sequelize({

    dialect: "sqlite",

    storage: "./src/database/fermentalab.db",

    logging: false

});

module.exports = sequelize;