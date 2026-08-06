const BaseService =
    require("./BaseService");

const RecipeIngredientRepository =
    require("../repositories/RecipeIngredientRepository");

class RecipeIngredientService
    extends BaseService {

    constructor() {

        super(

            new RecipeIngredientRepository()

        );

    }

}

module.exports =
    RecipeIngredientService;