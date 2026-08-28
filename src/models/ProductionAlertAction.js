const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.7.0.5 — registro de acciones operativas ante una alerta.
 *
 * Documenta "qué hizo el operador" alrededor de una desviación
 * (ProductionPredictionAlert, 2.7.0.3), sin automatizar ni modificar
 * nada del lote (secciones 10/11, explícito: no modifica mediciones ni
 * predicciones). Una alerta puede tener cero, una o varias acciones
 * (sección 7/8) -- esta tabla nunca se usa para decidir si una alerta
 * se resuelve, eso sigue dependiendo exclusivamente del mecanismo ya
 * existente en ProductionPredictionAlertService (sección 9).
 *
 * INMUTABLE por diseño en esta entrega (sección 17: "una acción nunca
 * debe eliminarse... para esta entrega, crear y consultar es
 * suficiente") -- no existe todavía ningún método de borrado, ni en el
 * repositorio ni en el servicio. Sí gana un único `update()` en
 * 2.7.0.6 (heredado de SequelizeRepository), usado EXCLUSIVAMENTE para
 * persistir el resultado de la evaluación de efectividad -- nunca para
 * editar type/description/notes/etc.
 *
 * Entrega 2.7.0.6 -- "análisis de efectividad de las acciones
 * operativas": cada acción ahora conserva, además de sus datos
 * originales, una fotografía del estado del lote al momento de
 * registrarse (columnas "AtAction", sección 3) y, cuando corresponde,
 * el resultado de la evaluación posterior (columnas "effectiveness..."
 * y "...After", sección 11). Ver ActionEffectiveness.js para la lógica de
 * clasificación (módulo puro, nunca vive aquí).
 */
const ProductionAlertAction = sequelize.define("ProductionAlertAction", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    alertId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    // Entrega 2.7.0.6 -- denormalizado desde `alert.productionBatchId`
    // al crear la acción (nunca cambia después). Permite consultar
    // "todas las acciones PENDING de un lote" (disparador de la
    // evaluación automática, sección 4) sin JOIN contra
    // production_prediction_alerts en cada medición nueva.
    productionBatchId: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    // --- Entrega 2.7.0.6, sección 3 -- fotografía capturada al crear
    // la acción. Inmutable: nunca se recalcula aunque después cambie la
    // predicción o se resuelva la alerta (sección 11).
    alertSeverityAtAction: {

        type: DataTypes.STRING(20),

        allowNull: true

    },

    deviationMinutesAtAction: {

        type: DataTypes.FLOAT,

        allowNull: true

    },

    predictionIdAtAction: {

        type: DataTypes.INTEGER,

        allowNull: true

    },

    // Nullable a propósito ("si existe información disponible",
    // sección 3) -- a diferencia de los tres campos de arriba.
    predictedFinishAtAction: {

        type: DataTypes.DATE,

        allowNull: true

    },

    // Código del catálogo -- ver src/utils/ProductionAlertActionCatalog.js.
    type: {

        type: DataTypes.STRING(40),

        allowNull: false

    },

    // Obligatoria solo cuando type = "OTHER" (sección 4), validado en
    // el servicio.
    description: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    // "Resultado esperado" (mockup de la sección 2) -- ver judgment
    // call en ProductionAlertActionService.
    expectedResult: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    // "Observaciones" del operador (sección 5) -- información
    // histórica, nunca una instrucción para el sistema.
    notes: {

        type: DataTypes.TEXT,

        allowNull: true

    },

    // Sección 6 -- texto libre opcional, mismo mecanismo ya usado en
    // RecalibrationProposalService/MaturationModelCalibrationService.
    createdBy: {

        type: DataTypes.STRING(120),

        allowNull: true

    },

    // --- Entrega 2.7.0.6, sección 11 -- resultado de la evaluación
    // posterior. Un único resultado persistido (el más reciente,
    // sección 12) -- `effectivenessHistory` queda explícitamente fuera
    // de alcance de esta entrega.
    effectivenessStatus: {

        type: DataTypes.STRING(20),

        allowNull: false,

        defaultValue: "PENDING"

    },

    effectivenessEvaluatedAt: {

        type: DataTypes.DATE,

        allowNull: true

    },

    deviationMinutesAfter: {

        type: DataTypes.FLOAT,

        allowNull: true

    },

    severityAfter: {

        type: DataTypes.STRING(20),

        allowNull: true

    },

    predictionIdAfter: {

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

    tableName: "production_alert_actions",

    timestamps: true

});

module.exports = ProductionAlertAction;
