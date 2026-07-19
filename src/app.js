const express = require("express");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");

const app = express();

app.use(helmet());
app.use(compression());
app.use(morgan("dev"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(expressLayouts);
app.set("layout", "layouts/main");

// Rutas
const routes = require("./routes");
app.use("/", routes);

// Error 404
app.use((req, res) => {
    res.status(404).render("errors/404", {
        title: "Página no encontrada",
        page: ""
    });
});

// Error 500
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).render("errors/500", {
        title: "Error",
        page: "",
        error: err
    });
});

module.exports = app;