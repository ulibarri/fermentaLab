const sequelize = require("../config/database");
const SeedContext = require("./SeedContext");
const CategorySeeder = require("./CategorySeeder");
const ProductSeeder = require("./ProductSeeder");

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