const BaseRepository = require("./BaseRepository");
const db = require("../config/DataContext");

class CategoryRepository extends BaseRepository {

    constructor() {

        super(db.categories);

    }

}

module.exports = CategoryRepository;