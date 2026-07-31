const BaseModel = require("../models/BaseModel");

class ProductModel extends BaseModel {

    constructor(data = {}) {

        super(data);

        this.code = data.code || "";

        this.name = data.name || "";

        this.categoryId = data.categoryId || "";

        this.description = data.description || "";

        this.active = data.active ?? true;

    }

}

module.exports = ProductModel;