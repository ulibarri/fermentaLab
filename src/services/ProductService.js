const BaseService = require("./BaseService");
const ProductRepository = require("../repositories/ProductRepository");

class ProductService extends BaseService {

    constructor() {

        super(
            new ProductRepository()
        );

    }

    async create(data) {

        if (!data.name || data.name.trim() === "") {

            throw new Error("El nombre es obligatorio.");

        }

        const duplicated =
            await this.repository.findByName(

                data.categoryId,

                data.name.trim()

            );

        if (duplicated) {

            throw new Error(
                "Ya existe un producto con ese nombre en la categoría."
            );

        }

        return await this.repository.create({

            code: data.code,

            categoryId: data.categoryId,

            name: data.name.trim(),

            description: data.description || "",

            active: true

        });

    }

    async update(id, data) {

        if (!data) {

            throw new Error("No se recibieron datos.");

        }

        if (!data.name || data.name.trim() === "") {

            throw new Error("El nombre es obligatorio.");

        }

        const product =
            await this.repository.findById(id);

        if (!product) {

            throw new Error("Producto no encontrado.");

        }

        const duplicated =
            await this.repository.findByName(

                data.categoryId,

                data.name.trim()

            );

        if (

            duplicated &&

            duplicated.id !== Number(id)

        ) {

            throw new Error(

                "Ya existe otro producto con ese nombre."

            );

        }

        return await this.repository.update(

            id,

            {

                categoryId: data.categoryId,

                code: data.code,

                name: data.name.trim(),

                description: data.description || "",

                active: data.active ?? true

            }

        );

    }

    async getActive() {

        return await this.repository.findActive();

    }

    async delete(id) {

        const product =
            await this.repository.findById(id);

        if (!product) {

            throw new Error("Producto no encontrado.");

        }

        return await this.repository.update(

            id,

            {

                active: false

            }

        );

    }

}

module.exports = ProductService;