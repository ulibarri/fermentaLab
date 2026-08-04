const SequelizeRepository =
    require("./SequelizeRepository");

const Category =
    require("../models/Category");

class CategoryRepository
    extends SequelizeRepository {

    constructor() {

        super(Category);

    }

}

module.exports = CategoryRepository;