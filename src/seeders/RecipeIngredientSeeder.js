const BaseSeeder = require("./BaseSeeder");
const RecipeIngredient = require("../models/RecipeIngredient");

class RecipeIngredientSeeder extends BaseSeeder {

    async run() {

        const items = [

            // Tepache Original V1

            {
                recipeVersion: "REC-001-V1",
                ingredient: "ING-001",   // Agua
                quantity: 6200,
                unit: "ML",
                sortOrder: 1
            },

            {
                recipeVersion: "REC-001-V1",
                ingredient: "ING-002",   // Piloncillo
                quantity: 650,
                unit: "G",
                sortOrder: 2
            },

            {
                recipeVersion: "REC-001-V1",
                ingredient: "ING-003",   // Piña
                quantity: 1800,
                unit: "G",
                sortOrder: 3
            },

            {
                recipeVersion: "REC-001-V1",
                ingredient: "ING-004",   // Canela
                quantity: 12,
                unit: "G",
                sortOrder: 4
            },

            {
                recipeVersion: "REC-001-V1",
                ingredient: "ING-005",   // Clavo
                quantity: 2,
                unit: "G",
                sortOrder: 5
            }

        ];

        for (const item of items) {

            await RecipeIngredient.findOrCreate({

                where: {

                    recipeVersionId:
                        this.context.recipeVersions[item.recipeVersion],

                    ingredientId:
                        this.context.ingredients[item.ingredient]

                },

                defaults: {

                    recipeVersionId:
                        this.context.recipeVersions[item.recipeVersion],

                    ingredientId:
                        this.context.ingredients[item.ingredient],

                    quantity:
                        item.quantity,

                    unitId:
                        this.context.units[item.unit],

                    sortOrder:
                        item.sortOrder

                },

                transaction:
                    this.transaction

            });

        }

        console.log("✔ RecipeIngredients seeded.");

    }

}

module.exports = RecipeIngredientSeeder;