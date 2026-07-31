// const BaseService = require("./BaseService");

// const ProductRepository =
//     require("../repositories/ProductRepository");

// const ProductModel =
//     require("../models/ProductModel");

// class ProductService extends BaseService {

//     constructor() {

//         super(
//             new ProductRepository()
//         );

//     }

//     async create(data) {

//         if (!data.name?.trim())
//             throw new Error("El nombre es obligatorio.");

//         const product =
//             new ProductModel(data);

//         return await super.create(product);

//     }

// }

// module.exports = ProductService;

const BaseService = require("./BaseService");
const ProductRepository = require("../repositories/ProductRepository");
const ProductModel = require("../models/ProductModel");
const CodeGenerator = require("../utils/CodeGenerator");

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

        // const products = await this.getAll();

        // const duplicated = products.find(p =>
        //     p.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
        //     p.categoryId === data.categoryId
        // );
        const duplicated =
            await this.repository.findOne(
                p =>
                    p.categoryId === data.categoryId &&
                    p.name.trim().toLowerCase() ===
                    data.name.trim().toLowerCase()
            );

        const products = await this.getAll();

        if (duplicated) {

            throw new Error("Ya existe un producto con ese nombre en la categoría.");

        }

        // Generar siguiente código
        // const nextNumber = products.length + 1;

        // const code = "PROD-" + String(nextNumber).padStart(3, "0");
        const code =
            CodeGenerator.next(
                products,
                "PROD"
            );

        const product = new ProductModel({

            id: code,

            categoryId: data.categoryId,

            name: data.name.trim(),

            description: data.description || "",

            active: true

        });

        return await super.create(product);

    }
    async update(id, data) {

        if (!data)
            throw new Error("No se recibieron datos.");

        if (!data.name || data.name.trim() === "")
            throw new Error("El nombre es obligatorio.");

        const product = await this.get(id);

        if (!product)
            throw new Error("Producto no encontrado.");

        const products = await this.getAll();

        // const duplicated = products.find(p =>

        //     p.id !== id &&

        //     p.categoryId === data.categoryId &&

        //     p.name.trim().toLowerCase() ===
        //     data.name.trim().toLowerCase()

        // );
        const duplicated =
            await this.repository.findOne(
                p =>
                    p.id !== id &&
                    p.categoryId === data.categoryId &&
                    p.name.trim().toLowerCase() ===
                    data.name.trim().toLowerCase()
            );

        if (duplicated)
            throw new Error(
                "Ya existe otro producto con ese nombre."
            );

        product.categoryId = data.categoryId;

        product.name = data.name.trim();

        product.description =
            data.description || "";

        product.active =
            data.active ?? true;

        if (typeof product.touch === "function")
            product.touch();
        else
            product.updatedAt =
                new Date().toISOString();

        return await super.update(

            id,

            product

        );

    }
    async getActive() {

        const products = await this.getAll();

        return products.filter(p => !p.deleted);

    }
    async delete(id) {

        const product = await this.get(id);

        if (!product)
            throw new Error("Producto no encontrado.");

        product.active = false;

        product.deleted = true;

        if (typeof product.touch === "function")
            product.touch();
        else
            product.updatedAt = new Date().toISOString();

        await this.repository.update(id, product);

        return product;

    }
    async countActive() {

        return await this.repository.count(
            p => !p.deleted
        );

    }

    async countDeleted() {

        return await this.repository.count(
            p => p.deleted
        );

    }

    async exists(id) {

        return await this.repository.exists(
            p => p.id === id
        );

    }

}


module.exports = ProductService;