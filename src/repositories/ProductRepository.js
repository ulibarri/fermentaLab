const SequelizeRepository = require("./SequelizeRepository");
const Product = require("../models/Product");

class ProductRepository extends SequelizeRepository {

    constructor() {

        super(Product);

    }

    async findAll() {

        return await super.findAll({

            include: {

                association: "category"

            },

            order: [["code", "ASC"]]

        });

    }

    async findById(id) {

        return await super.findById(id, {

            include: {

                association: "category"

            }

        });

    }

    async findByCode(code) {

        return await this.findOne({

            code

        });

    }

    async findByName(categoryId, name) {

        return await this.findOne({

            categoryId,

            name

        });

    }

    async findActive() {

        return await super.findAll({

            where: {

                active: true

            },

            include: {

                association: "category"

            },

            order: [["code", "ASC"]]

        });

    }

}

module.exports = ProductRepository;