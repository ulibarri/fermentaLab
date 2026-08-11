const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.6.1.12 — trazabilidad completa de predicciones: registra
 * cada predicción concreta hecha para un lote, con QUÉ configuración de
 * modelo la produjo (nunca solo el nombre "LINEAR"/"EXPONENTIAL"), CON
 * QUÉ DATOS, y CUÁNDO.
 *
 * INMUTABLE por diseño: una vez creada, una fila de esta tabla nunca se
 * actualiza salvo por el flag `isCurrent` (que otra predicción más
 * nueva del mismo lote pone en false al generarse — ver
 * MaturationPredictionService.generatePrediction()). Cambiar el modelo
 * activo, la receta, o agregar mediciones nuevas NUNCA modifica una
 * predicción ya creada — se genera una nueva fila (sección 4/5 de la
 * especificación).
 */
const MaturationPrediction = sequelize.define("MaturationPrediction", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    productionBatchId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    // Referencia fundamental: qué CONFIGURACIÓN de modelo produjo esta
    // predicción (no solo qué tipo). Puede existir más de una
    // configuración histórica del mismo modelType para la misma
    // recipeVersion (sección 2).
    modelConfigurationId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    predictedAt: {

        type: DataTypes.DATE,

        allowNull: false

    },

    predictedMaturationAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    predictedDurationHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    // Copia denormalizada de modelConfiguration.modelType al momento de
    // la predicción -- conveniencia de lectura (sección 6 la expone
    // directamente en el listado); la fuente de verdad para "qué
    // modelo/versión exacta" sigue siendo modelConfigurationId.
    modelType: {

        type: DataTypes.STRING(30),

        allowNull: false

    },

    // JSON (como texto) con el snapshot de los datos de entrada
    // usados -- ver MaturationPredictionService._buildInputSnapshot().
    inputData: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    notes: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    isCurrent: {

        type: DataTypes.BOOLEAN,

        allowNull: false,

        defaultValue: false

    },

    // --- Entrega 2.6.1.16: trazabilidad de calibración ---------------
    //
    // rawPredictedMaturationAt: la salida CRUDA del modelo, antes de
    // aplicar cualquier offset. predictedMaturationAt (arriba) sigue
    // siendo el valor FINAL -- lo que de verdad se usa/muestra como "la
    // predicción" -- para no romper ningún consumidor ya existente de
    // esa columna (2.6.1.12-2.6.1.15). Cuando no hay ninguna
    // calibración ACTIVE aplicable, rawPredictedMaturationAt es igual a
    // predictedMaturationAt (nunca queda null solo porque no hubo
    // calibración -- sección 9: la predicción original siempre debe
    // poder consultarse).
    rawPredictedMaturationAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    // Offset (en horas) efectivamente aplicado a esta predicción, o
    // null si no había ninguna calibración ACTIVE para su
    // (modelType, recipeVersionId) en el momento de generarla.
    calibrationOffsetHours: {

        type: DataTypes.DECIMAL(10, 2),

        allowNull: true

    },

    // Qué fila de MaturationModelCalibration produjo el offset. Una
    // vez creada, esta predicción NUNCA se recalcula si la calibración
    // referenciada se desactiva o si se activa una nueva más adelante
    // (sección 11: "no recalibrar retroactivamente") -- calibrationId
    // es solo para trazabilidad ("¿por qué esta predicción decía esto
    // seis meses después?"), no una referencia viva.
    calibrationId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    createdAt: {

        type: DataTypes.DATE,

        allowNull: false

    },

    updatedAt: {

        type: DataTypes.DATE,

        allowNull: false

    }

}, {

    tableName: "maturation_predictions",

    timestamps: true

});

module.exports = MaturationPrediction;
