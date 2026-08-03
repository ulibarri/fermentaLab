const fs = require("fs").promises;
const path = require("path");
const paths = require("../utils/paths");

const BaseSeeder = require("./BaseSeeder");

const { Category } = require("../models");

class CategorySeeder extends BaseSeeder {

    async run() {

        const file = paths.root(
            "data",
            "categories.json"
        );
        const categories = JSON.parse(

            await fs.readFile(file)

        );

        for (const item of categories) {

            const [category] = await Category.findOrCreate({

                where: {

                    code: item.id

                },

                defaults: {

                    code: item.id,

                    name: item.name,

                    description:
                        item.description || "",

                    active: item.active

                },

                transaction: this.transaction

            });
            this.context.categories[item.id] =
                category.id;

        }

        console.log(

            "✔ Categories seeded."

        );

    }

}

module.exports = CategorySeeder;