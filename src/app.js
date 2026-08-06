const express = require("express");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");
const routes = require("./routes");
const productApiRoutes = require("./routes/api/products");
const unitApiRoutes = require("./routes/api/units");
const ingredientApiRoutes = require("./routes/api/ingredients");
const recipeApiRoutes = require("./routes/api/recipes");






const app = express();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
    "/bootstrap",
    express.static(
        path.join(
            __dirname,
            "../node_modules/bootstrap/dist"
        )
    )
);
app.use(compression());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));


//EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(expressLayouts);
app.set("layout", "layouts/main");

//ROUTES
app.use("/", routes);
app.use("/api/products", productApiRoutes);
app.use("/api/units", unitApiRoutes);
app.use("/api/ingredients", ingredientApiRoutes);
app.use("/api/recipes", recipeApiRoutes);



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