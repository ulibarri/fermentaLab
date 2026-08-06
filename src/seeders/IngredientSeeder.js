const BaseSeeder = require("./BaseSeeder");
const Ingredient = require("../models/Ingredient");

class IngredientSeeder extends BaseSeeder {

    async run() {

        const ingredients = [

            {
                code: "ING-001",
                name: "Agua",
                description: "Agua purificada",
                unit: "ML"
            },

            {
                code: "ING-002",
                name: "Azúcar",
                description: "Azúcar refinada",
                unit: "G"
            },

            {
                code: "ING-003",
                name: "Té verde Gunpowder",
                description: "",
                unit: "G"
            },

            {
                code: "ING-004",
                name: "Flor de Jamaica",
                description: "",
                unit: "G"
            },

            {
                code: "ING-005",
                name: "Pulpa de Tamarindo",
                description: "",
                unit: "G"
            },

            {
                code: "ING-006",
                name: "Piña",
                description: "",
                unit: "G"
            },

            {
                code: "ING-007",
                name: "Canela",
                description: "",
                unit: "G"
            },

            {
                code: "ING-008",
                name: "Clavo",
                description: "",
                unit: "G"
            },
            {
                code: "ING-009",
                name: "Anís estrella",
                description: "",
                unit: "G"
            },
            {
                code: "ING-010",
                name: "Cascara de naranja",
                description: "",
                unit: "G"
            },
            {
                code: "ING-011",
                name: "Piloncillo",
                description: "",
                unit: "G"
            },
            {
                code: "ING-012",
                name: "Naranja",
                description: "",
                unit: "G"
            },
            {
                code: "ING-013",
                name: "Starter de tepache",
                description: "",
                unit: "ML"
            },
            {
                code: "ING-014",
                name: "Starter de Kombucha",
                description: "",
                unit: "ML"
            }

        ];

        for (const item of ingredients) {

            const ingredient =
                await Ingredient.findOrCreate({

                    where: {

                        code: item.code

                    },

                    defaults: {

                        code: item.code,

                        name: item.name,

                        description: item.description,

                        unitId: this.context.units[item.unit],

                        active: true

                    },

                    transaction: this.transaction

                });

            this.context.ingredients[item.code] =
                ingredient[0].id;

        }

        console.log("✔ Ingredients seeded.");

    }

}

module.exports = IngredientSeeder;