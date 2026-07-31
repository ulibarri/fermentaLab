require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 3190;

const initializeDatabase = require("./database/initDatabase");

async function start() {

    await initializeDatabase();

    app.listen(PORT, () => {

        console.log("=================================");

        console.log(`Servidor iniciado en http://localhost:${PORT}`);

        console.log("=================================");

    });

}

start();
