

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