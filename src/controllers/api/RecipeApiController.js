const RecipeService =
    require("../../services/RecipeService");

const service =
    new RecipeService();

exports.index =
    async (req, res, next) => {

        try {

            const data =
                await service.getAll();

            res.json({

                success: true,

                data

            });

        }

        catch (err) {

            next(err);

        }

    };