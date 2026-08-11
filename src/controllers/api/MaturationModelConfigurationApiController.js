const MaturationModelConfigurationService =
    require("../../services/MaturationModelConfigurationService");

const service =
    new MaturationModelConfigurationService();

exports.status = async (req, res) => {

    try {

        const recipeVersionId =
            req.query.recipeVersionId;

        const status =
            await service.getStatus(recipeVersionId);

        res.json({

            success: true,

            data: status

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.activate = async (req, res) => {

    try {

        if (!req.body) {

            throw new Error(

                "No se recibieron datos. Verifica el body y el header Content-Type: application/json."

            );

        }

        const configuration =
            await service.activateManual({

                recipeVersionId: req.body.recipeVersionId,

                modelType: req.body.modelType,

                notes: req.body.notes,

                activatedBy: req.body.activatedBy

            });

        res.status(201).json({

            success: true,

            data: configuration

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.activateRecommendation = async (req, res) => {

    try {

        if (!req.body) {

            throw new Error(

                "No se recibieron datos. Verifica el body y el header Content-Type: application/json."

            );

        }

        const configuration =
            await service.activateRecommendation({

                recipeVersionId: req.body.recipeVersionId,

                notes: req.body.notes,

                activatedBy: req.body.activatedBy

            });

        res.status(201).json({

            success: true,

            data: configuration

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
