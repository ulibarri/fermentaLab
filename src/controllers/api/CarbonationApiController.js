const CarbonationCalculator =
    require("../../utils/CarbonationCalculator");

exports.estimate = (req, res) => {

    try {

        const body =
            req.body || {};

        const result =
            CarbonationCalculator.calculate({

                psi: Number(body.psi),

                temperature: Number(body.temperature)

            });

        res.json({

            success: true,

            data: result

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
