const express = require("express");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");
const routes = require("./routes");
const productApiRoutes = require("./routes/api/products");






const app = express();

// app.use(express.static("public"));
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
// app.use(helmet());
// app.use(
//     helmet({
//         contentSecurityPolicy: {
//             directives: {
//                 defaultSrc: ["'self'"],

//                 scriptSrc: [
//                     "'self'",
//                     "https://cdn.jsdelivr.net"
//                 ],

//                 styleSrc: [
//                     "'self'",
//                     "'unsafe-inline'",
//                     "https://cdn.jsdelivr.net"
//                 ],

//                 fontSrc: [
//                     "'self'",
//                     "https://cdn.jsdelivr.net"
//                 ],

//                 imgSrc: [
//                     "'self'",
//                     "data:"
//                 ]
//             }
//         }
//     })
// );
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












// Rutas
// const routes = require("./routes");


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