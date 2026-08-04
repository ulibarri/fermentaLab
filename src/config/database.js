const path = require("path");
const { Sequelize } = require("sequelize");

const databasePath = path.resolve(
    __dirname,
    "../database/fermentalab.db"
);

const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: databasePath,
    logging: false
});

module.exports = sequelize;