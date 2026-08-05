const UnitService =
    require("../../services/UnitService");

const service =
    new UnitService();

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