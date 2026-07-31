const db = require("../models");

async function initializeDatabase() {

    try {

        await db.sequelize.authenticate();

        console.log("SQLite conectado.");

        await db.sequelize.sync({
            alter: true
        });

        console.log("Base sincronizada.");

    }
    catch (err) {

        console.error(err);

    }

}

module.exports = initializeDatabase;