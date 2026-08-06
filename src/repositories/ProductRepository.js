const SequelizeRepository = require("./SequelizeRepository");
const Product = require("../models/Product");
const sequelize = require("../config/database");

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

            name: sequelize.where(
                sequelize.fn("LOWER", sequelize.col("name")),
                name.toLowerCase()
            )

        });

    }
    async findActive() {

        return await this.model.findAll({

            where: {

                active: true

            },

            include: {

                association: "category"

            },

            order: [

                ["code", "ASC"]

            ]

        });

    }

}

module.exports = ProductRepository;