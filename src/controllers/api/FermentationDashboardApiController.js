const FermentationDashboardService =
    require("../../services/FermentationDashboardService");

const service =
    new FermentationDashboardService();

/*
 * Entrega 2.7.0.4, sección 13 -- endpoint único agregado del panel
 * operativo. Mismo patrón try/catch -> res.json({success, data}) /
 * res.status(400).json({success:false, message}) que el resto de
 * controllers de este módulo.
 *
 * `alertsOnly` llega como query string ("true"/"false"/ausente) --
 * se traduce explícitamente a true/false/null (nunca al booleano
 * "truthy" de un string no vacío, que interpretaría "false" como
 * verdadero por error).
 */

// GET /api/fermentations/active
exports.active = async (req, res) => {

    try {

        let alertsOnly = null;

        if (req.query.alertsOnly === "true") {

            alertsOnly = true;

        } else if (req.query.alertsOnly === "false") {

            alertsOnly = false;

        }

        const dashboard =
            await service.getActiveFermentations({

                phase: req.query.phase || null,

                severity: req.query.severity || null,

                alertsOnly,

                productId: req.query.productId || null

            });

        res.json({

            success: true,

            data: dashboard

        });

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};
