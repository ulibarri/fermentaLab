const BaseService = require("./BaseService");
const RecipeRepository = require("../repositories/RecipeRepository");

class RecipeService extends BaseService {

    constructor() {

        super(

            new RecipeRepository()

        );

    }

}

module.exports = RecipeService;