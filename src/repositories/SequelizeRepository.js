class SequelizeRepository {

    constructor(model) {

        this.model = model;

    }

    async findAll(options = {}) {

        return await this.model.findAll(options);

    }

    async findById(id, options = {}) {

        return await this.model.findByPk(id, options);

    }

    async findOne(where, options = {}) {

        return await this.model.findOne({

            where,

            ...options

        });

    }

    async count(where = {}) {

        return await this.model.count({

            where

        });

    }

    async exists(where = {}) {

        return (await this.count(where)) > 0;

    }

    async create(entity) {

        return await this.model.create(entity);

    }

    async update(id, entity) {

        const record = await this.findById(id);

        if (!record)
            return null;

        const values =
            entity && typeof entity.get === "function"
                ? entity.get({ plain: true })
                : entity;

        await record.update(values);

        return record;

    }

    async delete(id) {

        const record = await this.findById(id);

        if (!record)
            return false;

        await record.destroy();

        return true;

    }

}

module.exports = SequelizeRepository;