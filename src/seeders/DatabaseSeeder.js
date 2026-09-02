const sequelize = require("../config/database");
const SeedContext = require("./SeedContext");
const CategorySeeder = require("./CategorySeeder");
const ProductSeeder = require("./ProductSeeder");
const UnitSeeder = require("./UnitSeeder");
const IngredientSeeder = require("./IngredientSeeder");
const RecipeSeeder = require("./RecipeSeeder");
const RecipeVersionSeeder = require("./RecipeVersionSeeder");
const RecipeIngredientSeeder = require("./RecipeIngredientSeeder");
const HydrometerConversionTableSeeder = require("./HydrometerConversionTableSeeder");

async function run() {

    const transaction =
        await sequelize.transaction();

    const context =
        new SeedContext();

    try {

        await new CategorySeeder(

            context,

            transaction

        ).run();

        await new ProductSeeder(

            context,

            transaction

        ).run();

        await new UnitSeeder(

            context,

            transaction

        ).run();

        await new IngredientSeeder(

            context,

            transaction

        ).run();

        await new RecipeSeeder(

            context,

            transaction

        ).run();

        await new RecipeVersionSeeder(

            context,

            transaction

        ).run();

        await new RecipeIngredientSeeder(

            context,

            transaction

        ).run();

        // Entrega 2.8.0.2 -- no depende de `context` (no referencia
        // categorías/productos/recetas), pero se corre en el mismo
        // batch/transacción que el resto del seed inicial para que una
        // base de datos recién migrada quede lista para operar en un
        // solo paso.
        await new HydrometerConversionTableSeeder(

            context,

            transaction

        ).run();

        await transaction.commit();
        console.log(context);
        console.log(
            "Seed completado."
        );


    }

    catch (err) {

        await transaction.rollback();

        console.error(err);

    }

}

run();