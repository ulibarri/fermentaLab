class BatchNumberGenerator {

    static async next(recipeVersion, repository) {

        const recipe =
            recipeVersion.recipe;

        const prefix =
            recipe.product.category.batchPrefix;

        const today =
            new Date();

        const yyyy =
            today.getFullYear();

        const mm =
            String(
                today.getMonth() + 1
            ).padStart(2, "0");

        const dd =
            String(
                today.getDate()
            ).padStart(2, "0");

        const date =
            `${yyyy}${mm}${dd}`;

        const sequence =
            await repository.nextSequence(

                prefix,

                date

            );

        return `${prefix}-${date}-${String(sequence).padStart(3, "0")}`;

    }

}

module.exports =
    BatchNumberGenerator;