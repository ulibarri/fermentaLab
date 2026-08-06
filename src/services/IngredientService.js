const BaseService = require("./BaseService");
const IngredientRepository = require("../repositories/IngredientRepository");

class IngredientService extends BaseService {

    constructor() {

        super(

            new IngredientRepository()

        );

    }

}

module.exports = IngredientService;