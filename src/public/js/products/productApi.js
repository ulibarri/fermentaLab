// class ProductApi {

//     async getAll() {

//         const response =
//             await Api.get("/api/products");

//         return response.data;

//     }

//     async get(id) {

//         const response =
//             await Api.get(`/api/products/${id}`);

//         return response.data;

//     }

//     async create(product) {

//         return await Api.post(
//             "/api/products",
//             product
//         );

//     }

//     async update(id, product) {

//         return await Api.put(
//             `/api/products/${id}`,
//             product
//         );

//     }

//     async delete(id) {

//         return await Api.delete(
//             `/api/products/${id}`
//         );

//     }

// }
class ProductApi extends CrudApi {

    constructor() {

        super("/api/products");

    }

}