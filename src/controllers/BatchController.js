const RecipeVersionService = require("../services/RecipeVersionService");
const ProductionBatchService = require("../services/ProductionBatchService");

const recipeVersionService = new RecipeVersionService();
const batchService = new ProductionBatchService();

exports.index = async (req, res, next) => {

    try {

        const recipeVersions = await recipeVersionService.getAll();

        res.render("batches/index", {

            title: "Lotes de producción",

            page: "batches",

            recipeVersions

        });

    } catch (err) {

        next(err);

    }

};

exports.measurements = async (req, res, next) => {

    try {

        const batch = await batchService.get(req.params.id);

        if (!batch) {

            return res.status(404).render("errors/404", {

                title: "Página no encontrada",

                page: ""

            });

        }

        res.render("batches/measurements", {

            title: `Mediciones - ${batch.batchNumber}`,

            page: "batches",

            batch

        });

    } catch (err) {

        next(err);

    }

};
