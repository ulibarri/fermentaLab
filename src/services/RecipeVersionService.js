const BaseService =
    require("./BaseService");

const RecipeVersionRepository =
    require("../repositories/RecipeVersionRepository");

class RecipeVersionService
    extends BaseService {

    constructor() {

        super(
            new RecipeVersionRepository()
        );

    }

}

module.exports =
    RecipeVersionService;