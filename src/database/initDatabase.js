const db = require("../models");

async function initializeDatabase() {

    try {

        await db.sequelize.authenticate();

        console.log("SQLite conectado.");

    }
    catch (err) {

        console.error(err);

    }

}

module.exports = initializeDatabase;