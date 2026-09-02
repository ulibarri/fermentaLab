"use strict";

/*
 * Entrega 2.8.0.2, sección 14 -- trazabilidad mínima de versiones de
 * tabla (ver src/models/HydrometerTableAuditLog.js). Calcada de
 * maturation_alert_audit_logs (2.6.1.23).
 */
module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(

      "hydrometer_table_audit_logs",

      {

        id: {

          type: Sequelize.INTEGER,

          primaryKey: true,

          autoIncrement: true,

          allowNull: false

        },

        userId: {

          type: Sequelize.STRING(100),

          allowNull: true

        },

        action: {

          type: Sequelize.STRING(40),

          allowNull: false

        },

        tableId: {

          type: Sequelize.INTEGER,

          allowNull: true,

          references: {

            model: "hydrometer_conversion_tables",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "SET NULL"

        },

        previousTableId: {

          type: Sequelize.INTEGER,

          allowNull: true,

          references: {

            model: "hydrometer_conversion_tables",

            key: "id"

          },

          onUpdate: "CASCADE",

          onDelete: "SET NULL"

        },

        reason: {

          type: Sequelize.TEXT,

          allowNull: true

        },

        createdAt: {

          type: Sequelize.DATE,

          allowNull: false

        },

        updatedAt: {

          type: Sequelize.DATE,

          allowNull: false

        }

      }

    );

    await queryInterface.addIndex(

      "hydrometer_table_audit_logs",

      ["tableId", "createdAt"]

    );

  },

  async down(queryInterface) {

    await queryInterface.dropTable(

      "hydrometer_table_audit_logs"

    );

  }

};
