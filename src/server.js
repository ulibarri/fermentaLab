require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 3190;

app.listen(PORT, () => {

    console.log("=================================");
    console.log("FermentaLab");
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
    console.log("=================================");

});