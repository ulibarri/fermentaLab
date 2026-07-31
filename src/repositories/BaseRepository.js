class BaseRepository {

    constructor(storage) {

        this.storage = storage;

    }

    async findAll() {

        return await this.storage.findAll();

    }

    async findById(id) {

        return await this.storage.findById(id);

    }

    async create(entity) {

        return await this.storage.create(entity);

    }

    async update(id, entity) {

        return await this.storage.update(id, entity);

    }

    async delete(id) {

        return await this.storage.delete(id);

    }

    //----------------------------------------
    // Métodos genéricos de consulta
    //----------------------------------------

    async find(predicate) {

        const items = await this.findAll();

        return items.filter(predicate);

    }

    async findOne(predicate) {

        const items = await this.findAll();

        return items.find(predicate) || null;

    }

    async exists(predicate) {

        const items = await this.findAll();

        return items.some(predicate);

    }

    async count(predicate = null) {

        const items = await this.findAll();

        if (!predicate)
            return items.length;

        return items.filter(predicate).length;

    }

    async orderBy(selector, direction = "asc") {

        const items = await this.findAll();

        const sorted = [...items];

        sorted.sort((a, b) => {

            const av = selector(a);
            const bv = selector(b);

            if (av < bv)
                return direction === "asc" ? -1 : 1;

            if (av > bv)
                return direction === "asc" ? 1 : -1;

            return 0;

        });

        return sorted;

    }

    async paginate(page = 1, pageSize = 10) {

        const items = await this.findAll();

        const total = items.length;

        const pages = Math.ceil(total / pageSize);

        const start = (page - 1) * pageSize;

        return {

            page,

            pageSize,

            total,

            pages,

            items: items.slice(start, start + pageSize)

        };

    }

}

module.exports = BaseRepository;