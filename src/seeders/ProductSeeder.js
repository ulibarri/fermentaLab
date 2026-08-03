const fs = require("fs").promises;
const BaseSeeder = require("./BaseSeeder");
const paths = require("../utils/paths");

const {
    Product,
    Category
} = require("../models");

class ProductSeeder extends BaseSeeder {

    async run() {

        const file = paths.root(
            "data",
            "products.json"
        );

        const products = JSON.parse(

            await fs.readFile(
                file,
                "utf8"
            )

        );

        for (const item of products) {

            //--------------------------------------------------
            // Obtener el ID entero de la categoría
            //--------------------------------------------------

            const categoryId =
                this.context.categories[
                item.categoryId
                ];

            if (!categoryId) {

                throw new Error(

                    `Categoría ${item.categoryId} no encontrada.`

                );

            }

            //--------------------------------------------------
            // Crear producto
            //--------------------------------------------------

            const [product] =
                await Product.findOrCreate({

                    where: {

                        code: item.id

                    },

                    defaults: {

                        code: item.id,

                        categoryId,

                        name: item.name,

                        description:

                            item.description || "",

                        active:

                            item.active

                    },

                    transaction:
                        this.transaction

                });

            //--------------------------------------------------
            // Registrar en SeedContext
            //--------------------------------------------------

            this.context.products[
                item.id
            ] = product.id;

        }

        console.log(
            "✔ Products seeded."
        );

    }

}

module.exports = ProductSeeder;