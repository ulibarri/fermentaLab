const sequelize = require("../config/database");

class BaseService {

    constructor(repository) {

        this.repository = repository;

    }

    async transactional(fn, existingTransaction = null) {

        if (existingTransaction) {

            return await fn(existingTransaction);

        }

        const transaction = await sequelize.transaction();

        try {

            const result = await fn(transaction);

            await transaction.commit();

            return result;

        } catch (err) {

            await transaction.rollback();

            throw err;

        }

    }

    async getAll() {

        return await this.repository.findAll();

    }

    async get(id) {

        return await this.repository.findById(id);

    }

    async create(entity) {

        return await this.repository.create(entity);

    }

    async update(id, entity) {

        return await this.repository.update(id, entity);

    }

    async delete(id) {

        return await this.repository.delete(id);

    }

}

module.exports = BaseService;