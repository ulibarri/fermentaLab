const BaseSeeder = require("./BaseSeeder");
const Unit = require("../models/Unit");

class UnitSeeder extends BaseSeeder {

    async run() {

        const units = [

            {
                code: "G",
                name: "Gramo",
                symbol: "g"
            },

            {
                code: "KG",
                name: "Kilogramo",
                symbol: "kg"
            },

            {
                code: "ML",
                name: "Mililitro",
                symbol: "ml"
            },

            {
                code: "L",
                name: "Litro",
                symbol: "L"
            },

            {
                code: "PZA",
                name: "Pieza",
                symbol: "pz"
            },

            {
                code: "CDTA",
                name: "Cucharadita",
                symbol: "cdta"
            },

            {
                code: "CDA",
                name: "Cucharada",
                symbol: "cda"
            }

        ];

        for (const item of units) {

            const unit = await Unit.findOrCreate({

                where: {

                    code: item.code

                },

                defaults: item,

                transaction: this.transaction

            });

            this.context.units[item.code] = unit[0].id;

        }

        console.log("✔ Units seeded.");

    }

}

module.exports = UnitSeeder;