const BaseSeeder = require("./BaseSeeder");
const RecipeVersion = require("../models/RecipeVersion");

class RecipeVersionSeeder extends BaseSeeder {

    async run() {

        const versions = [

            {

                code: "REC-001",

                version: 1,

                batchSize: 6.200,

                batchUnit: "L",

                notes: "Primera formulación oficial del Tepache Original."

            },

            {

                code: "REC-002",

                version: 1,

                batchSize: 6.000,

                batchUnit: "L",

                notes: "Primera formulación oficial de Kombucha Jamaica."

            }

        ];

        for (const item of versions) {

            const [record] =

                await RecipeVersion.findOrCreate({

                    where: {

                        recipeId:

                            this.context.recipes[item.code],

                        version:

                            item.version

                    },

                    defaults: {

                        recipeId:

                            this.context.recipes[item.code],

                        version:

                            item.version,

                        batchSize:

                            item.batchSize,

                        batchUnitId:

                            this.context.units[item.batchUnit],

                        notes:

                            item.notes,

                        isCurrent: true,

                        active: true

                    },

                    transaction:

                        this.transaction

                });

            this.context.recipeVersions[

                `${item.code}-V${item.version}`

            ] = record.id;

        }

        console.log(

            "✔ RecipeVersions seeded."

        );

    }

}

module.exports =
    RecipeVersionSeeder;