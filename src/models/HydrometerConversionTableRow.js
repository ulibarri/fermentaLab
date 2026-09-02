const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/*
 * Entrega 2.8.0.2, sección 6 -- "separar tabla y algoritmo": esta fila
 * es puramente DATOS (un punto SG/Brix/Alcohol de la tabla del
 * fabricante), nunca contiene lógica de interpolación -- eso vive
 * exclusivamente en `HydrometerConversionService`/`HydrometerConverter`.
 *
 * `rowOrder` conserva el orden original de import/captura (1-based,
 * sección 16/17: los mensajes de validación citan "la fila N" sobre
 * este mismo orden) -- independiente de que las filas ya deban venir
 * ordenadas ascendentemente por `sg` (validado por
 * `HydrometerTableValidation.validateTable()` antes de poder marcar la
 * tabla VALIDATED).
 */
const HydrometerConversionTableRow = sequelize.define("HydrometerConversionTableRow", {

    id: {

        type: DataTypes.INTEGER,

        primaryKey: true,

        autoIncrement: true

    },

    hydrometerConversionTableId: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    rowOrder: {

        type: DataTypes.INTEGER,

        allowNull: false

    },

    sg: {

        type: DataTypes.DECIMAL(10, 4),

        allowNull: false

    },

    brix: {

        type: DataTypes.DECIMAL(10, 4),

        allowNull: false

    },

    alcohol: {

        type: DataTypes.DECIMAL(10, 4),

        allowNull: false

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

    tableName: "hydrometer_conversion_table_rows",

    timestamps: true

});

module.exports = HydrometerConversionTableRow;
