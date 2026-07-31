const BaseRepository = require("./BaseRepository");

const db = require("../config/DataContext");

const ProductModel = require("../models/ProductModel");

class ProductRepository extends BaseRepository {

    constructor() {

        super(db.products);

    }

    async findAll() {

        const data = await super.findAll();

        return data.map(x => new ProductModel(x));

    }

    async findById(id) {

        const data = await super.findById(id);

        if (!data)
            return null;

        return new ProductModel(data);

    }

}

module.exports = ProductRepository;