const BaseSeeder = require("./BaseSeeder");
const Recipe = require("../models/Recipe");

class RecipeSeeder extends BaseSeeder {

    async run() {

        const recipes = [

            {
                code: "REC-001",
                product: "PROD-001",
                name: "Tepache Original",
                description: "Receta base del Tepache Original"
            },

            {
                code: "REC-002",
                product: "PROD-002",
                name: "Tepache Citrus",
                description: "Receta base del Tepache Citrus & Spices"
            },

            {
                code: "REC-003",
                product: "PROD-003",
                name: "Kombucha Original",
                description: "Receta base de Kombucha sin sabor"
            },

            {
                code: "REC-004",
                product: "PROD-004",
                name: "Kombucha Jamaica",
                description: "Receta base de Kombucha Jamaica"
            },

            {
                code: "REC-005",
                product: "PROD-005",
                name: "Kombucha Frutos Rojos",
                description: "Receta base de Kombucha Frutos Rojos"
            }

        ];

        for (const item of recipes) {

            const [recipe] = await Recipe.findOrCreate({

                where: {

                    code: item.code

                },

                defaults: {

                    code: item.code,

                    productId:
                        this.context.products[item.product],

                    name: item.name,

                    description: item.description,

                    active: true

                },

                transaction: this.transaction

            });

            this.context.recipes[item.code] =
                recipe.id;

        }

        console.log("✔ Recipes seeded.");

    }

}

module.exports = RecipeSeeder;