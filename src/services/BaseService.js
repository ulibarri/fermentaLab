class BaseService {

    constructor(repository) {

        this.repository = repository;

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