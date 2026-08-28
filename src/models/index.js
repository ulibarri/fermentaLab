const sequelize = require("../config/database");

const Category = require("./Category");
const Product = require("./Product");
const Unit = require("./Unit");
const Ingredient = require("./Ingredient");
const Recipe = require("./Recipe");
const RecipeVersion = require("./RecipeVersion");
const RecipeIngredient = require("./RecipeIngredient");
const ProductionBatch = require("./ProductionBatch");
const ProductionMeasurement = require("./ProductionMeasurement");
const MaturationModelConfiguration = require("./MaturationModelConfiguration");
const MaturationPrediction = require("./MaturationPrediction");
const MaturationModelCalibration = require("./MaturationModelCalibration");
const MaturationCalibrationEvaluation = require("./MaturationCalibrationEvaluation");
const MaturationModelAlert = require("./MaturationModelAlert");
const MaturationAlertAuditLog = require("./MaturationAlertAuditLog");
const MaturationCalibrationDegradationEvent = require("./MaturationCalibrationDegradationEvent");
const RecalibrationProposalEvaluation = require("./RecalibrationProposalEvaluation");
const RecalibrationEffectivenessEvaluation = require("./RecalibrationEffectivenessEvaluation");
const ProductionPredictionAlert = require("./ProductionPredictionAlert");

Category.hasMany(Product, {

    foreignKey: "categoryId",

    as: "products"

});

Product.belongsTo(Category, {

    foreignKey: "categoryId",

    as: "category"

});
Unit.hasMany(Ingredient, {

    foreignKey: "unitId",

    as: "ingredients"

});

Ingredient.belongsTo(Unit, {

    foreignKey: "unitId",

    as: "unit"

});
Product.hasMany(Recipe, {

    foreignKey: "productId",

    as: "recipes"

});

Recipe.belongsTo(Product, {

    foreignKey: "productId",

    as: "product"

});
Recipe.hasMany(RecipeVersion, {

    foreignKey: "recipeId",

    as: "versions"

});

RecipeVersion.belongsTo(Recipe, {

    foreignKey: "recipeId",

    as: "recipe"

});

Unit.hasMany(RecipeVersion, {

    foreignKey: "batchUnitId",

    as: "recipeVersions"

});

RecipeVersion.belongsTo(Unit, {

    foreignKey: "batchUnitId",

    as: "batchUnit"

});

RecipeVersion.hasMany(RecipeIngredient, {

    foreignKey: "recipeVersionId",

    as: "ingredients"

});

RecipeIngredient.belongsTo(RecipeVersion, {

    foreignKey: "recipeVersionId",

    as: "recipeVersion"

});
Ingredient.hasMany(RecipeIngredient, {

    foreignKey: "ingredientId",

    as: "recipeIngredients"

});

RecipeIngredient.belongsTo(Ingredient, {

    foreignKey: "ingredientId",

    as: "ingredient"

});
Unit.hasMany(RecipeIngredient, {

    foreignKey: "unitId",

    as: "recipeIngredients"

});

RecipeIngredient.belongsTo(Unit, {

    foreignKey: "unitId",

    as: "unit"

});
RecipeVersion.hasMany(

    ProductionBatch,

    {

        foreignKey: "recipeVersionId",

        as: "productionBatches"

    }

);

ProductionBatch.belongsTo(

    RecipeVersion,

    {

        foreignKey: "recipeVersionId",

        as: "recipeVersion"

    }

);

ProductionBatch.hasMany(

    ProductionMeasurement,

    {

        foreignKey: "productionBatchId",

        as: "measurements"

    }

);

ProductionMeasurement.belongsTo(

    ProductionBatch,

    {

        foreignKey: "productionBatchId",

        as: "productionBatch"

    }

);

RecipeVersion.hasMany(

    MaturationModelConfiguration,

    {

        foreignKey: "recipeVersionId",

        as: "modelConfigurations"

    }

);

MaturationModelConfiguration.belongsTo(

    RecipeVersion,

    {

        foreignKey: "recipeVersionId",

        as: "recipeVersion"

    }

);

ProductionBatch.hasMany(

    MaturationPrediction,

    {

        foreignKey: "productionBatchId",

        as: "predictions"

    }

);

MaturationPrediction.belongsTo(

    ProductionBatch,

    {

        foreignKey: "productionBatchId",

        as: "productionBatch"

    }

);

MaturationModelConfiguration.hasMany(

    MaturationPrediction,

    {

        foreignKey: "modelConfigurationId",

        as: "predictions"

    }

);

MaturationPrediction.belongsTo(

    MaturationModelConfiguration,

    {

        foreignKey: "modelConfigurationId",

        as: "modelConfiguration"

    }

);

// --- Entrega 2.6.1.16: MaturationModelCalibration -----------------

RecipeVersion.hasMany(

    MaturationModelCalibration,

    {

        foreignKey: "recipeVersionId",

        as: "calibrations"

    }

);

MaturationModelCalibration.belongsTo(

    RecipeVersion,

    {

        foreignKey: "recipeVersionId",

        as: "recipeVersion"

    }

);

MaturationModelCalibration.hasMany(

    MaturationPrediction,

    {

        foreignKey: "calibrationId",

        as: "predictions"

    }

);

MaturationPrediction.belongsTo(

    MaturationModelCalibration,

    {

        foreignKey: "calibrationId",

        as: "calibration"

    }

);

// --- Entrega 2.6.1.19: cadena de versiones (self-referencial) ------
// Una calibración "reemplazo" apunta a la que reemplaza vía
// parentCalibrationId (sección 2) -- `as: "parentCalibration"` /
// `as: "childCalibrations"` para no chocar con el resto de alias de
// este modelo (recipeVersion/predictions/evaluations).

MaturationModelCalibration.belongsTo(

    MaturationModelCalibration,

    {

        foreignKey: "parentCalibrationId",

        as: "parentCalibration"

    }

);

MaturationModelCalibration.hasMany(

    MaturationModelCalibration,

    {

        foreignKey: "parentCalibrationId",

        as: "childCalibrations"

    }

);

// --- Entrega 2.6.1.17: MaturationCalibrationEvaluation -------------

MaturationModelCalibration.hasMany(

    MaturationCalibrationEvaluation,

    {

        foreignKey: "calibrationId",

        as: "evaluations"

    }

);

MaturationCalibrationEvaluation.belongsTo(

    MaturationModelCalibration,

    {

        foreignKey: "calibrationId",

        as: "calibration"

    }

);

// --- Entrega 2.6.1.21: MaturationModelAlert ------------------------

MaturationModelConfiguration.hasMany(

    MaturationModelAlert,

    {

        foreignKey: "modelConfigurationId",

        as: "alerts"

    }

);

MaturationModelAlert.belongsTo(

    MaturationModelConfiguration,

    {

        foreignKey: "modelConfigurationId",

        as: "modelConfiguration"

    }

);

MaturationModelCalibration.hasMany(

    MaturationModelAlert,

    {

        foreignKey: "calibrationId",

        as: "alerts"

    }

);

MaturationModelAlert.belongsTo(

    MaturationModelCalibration,

    {

        foreignKey: "calibrationId",

        as: "calibration"

    }

);

// --- Entrega 2.6.1.23: MaturationAlertAuditLog ---------------------
// Solo `belongsTo` en un sentido -- el log nunca se recorre "desde" un
// modelo/alerta/calibración en esta entrega (no hay pantalla de
// auditoría todavía), pero declarar las asociaciones deja la puerta
// abierta a un `include` futuro sin otra migración.

MaturationAlertAuditLog.belongsTo(

    MaturationModelConfiguration,

    {

        foreignKey: "modelId",

        as: "modelConfiguration"

    }

);

MaturationAlertAuditLog.belongsTo(

    MaturationModelAlert,

    {

        foreignKey: "alertId",

        as: "alert"

    }

);

MaturationAlertAuditLog.belongsTo(

    MaturationModelCalibration,

    {

        foreignKey: "sourceCalibrationId",

        as: "sourceCalibration"

    }

);

MaturationAlertAuditLog.belongsTo(

    MaturationModelCalibration,

    {

        foreignKey: "targetCalibrationId",

        as: "targetCalibration"

    }

);

// --- Entrega 2.6.1.28: MaturationCalibrationDegradationEvent -------
// Sección 12: "desde la alerta -> Calibración v4" y "desde la
// calibración -> Alertas de degradación" -- asociación bidireccional,
// a diferencia de MaturationAlertAuditLog (2.6.1.23, solo un sentido,
// sin pantalla que la recorra todavía). Aquí SÍ hay una pantalla en
// ambos sentidos (el detalle de la calibración muestra sus propios
// eventos de degradación).

MaturationModelCalibration.hasMany(

    MaturationCalibrationDegradationEvent,

    {

        foreignKey: "calibrationId",

        as: "degradationEvents"

    }

);

MaturationCalibrationDegradationEvent.belongsTo(

    MaturationModelCalibration,

    {

        foreignKey: "calibrationId",

        as: "calibration"

    }

);

// --- Entrega 2.6.1.30: RecalibrationProposalEvaluation -------------
// Bidireccional -- misma razón que MaturationCalibrationDegradationEvent
// (2.6.1.28): sí hay una pantalla que recorre ambos sentidos (el
// detalle de la propuesta muestra su historial de evaluaciones).

MaturationModelCalibration.hasMany(

    RecalibrationProposalEvaluation,

    {

        foreignKey: "calibrationId",

        as: "proposalEvaluations"

    }

);

RecalibrationProposalEvaluation.belongsTo(

    MaturationModelCalibration,

    {

        foreignKey: "calibrationId",

        as: "proposal"

    }

);

// --- Entrega 2.6.1.32: RecalibrationEffectivenessEvaluation --------
// Bidireccional, mismo criterio que RecalibrationProposalEvaluation
// (2.6.1.30) -- el detalle de una calibración activada muestra su
// propio historial de evaluaciones de efectividad.

MaturationModelCalibration.hasMany(

    RecalibrationEffectivenessEvaluation,

    {

        foreignKey: "calibrationId",

        as: "effectivenessEvaluations"

    }

);

RecalibrationEffectivenessEvaluation.belongsTo(

    MaturationModelCalibration,

    {

        foreignKey: "calibrationId",

        as: "calibration"

    }

);

// --- Entrega 2.7.0.3: ProductionPredictionAlert --------------------
// Bidireccional, mismo criterio que MaturationCalibrationDegradationEvent
// (2.6.1.28) -- el detalle del lote muestra su propio historial de
// alertas de desviación, y cada alerta necesita resolver qué predicción
// concreta la disparó/mantiene (asociación con MaturationPrediction,
// deliberadamente de UN SOLO sentido -- el detalle de una predicción no
// necesita listar "todas las alertas que alguna vez la referenciaron",
// a diferencia del lote).

ProductionBatch.hasMany(

    ProductionPredictionAlert,

    {

        foreignKey: "productionBatchId",

        as: "predictionAlerts"

    }

);

ProductionPredictionAlert.belongsTo(

    ProductionBatch,

    {

        foreignKey: "productionBatchId",

        as: "productionBatch"

    }

);

ProductionPredictionAlert.belongsTo(

    MaturationPrediction,

    {

        foreignKey: "predictionId",

        as: "prediction"

    }

);

module.exports = {

    sequelize,

    Category,

    Product,

    Unit,

    Ingredient,

    Recipe,

    RecipeVersion,

    RecipeIngredient,

    ProductionBatch,

    ProductionMeasurement,

    MaturationModelConfiguration,

    MaturationPrediction,

    MaturationModelCalibration,

    MaturationCalibrationEvaluation,

    MaturationModelAlert,

    MaturationAlertAuditLog,

    MaturationCalibrationDegradationEvent,

    RecalibrationProposalEvaluation,

    RecalibrationEffectivenessEvaluation,

    ProductionPredictionAlert
};