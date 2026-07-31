// const { randomUUID } = require("crypto");

// class BaseModel {

//     constructor(data = {}) {

//         this.id = data.id || randomUUID();

//         this.createdAt = data.createdAt || new Date().toISOString();

//         this.updatedAt = data.updatedAt || new Date().toISOString();

//         this.deleted = data.deleted || false;

//     }

//     touch() {

//         this.updatedAt = new Date().toISOString();

//     }

// }
// const { randomUUID } = require("crypto");

// class BaseModel {

//     constructor(data = {}) {

//         this.id = data.id || randomUUID();

//         this.createdAt = data.createdAt || new Date().toISOString();

//         this.updatedAt = data.updatedAt || this.createdAt;

//         this.deleted = data.deleted ?? false;

//     }

//     touch() {

//         this.updatedAt = new Date().toISOString();

//     }

// }
// module.exports = BaseModel;const { randomUUID } = require("crypto");

class BaseModel {

    constructor(data = {}) {

        this.id = data.id || randomUUID();

        this.createdAt = data.createdAt || new Date().toISOString();

        this.updatedAt = data.updatedAt || this.createdAt;

        this.active = data.active ?? true;

        this.deleted = data.deleted ?? false;

    }

    touch() {

        this.updatedAt = new Date().toISOString();

    }

}

module.exports = BaseModel;