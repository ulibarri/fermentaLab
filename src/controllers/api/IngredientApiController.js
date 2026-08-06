const IngredientService =
    require("../../services/IngredientService");

const service =
    new IngredientService();

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