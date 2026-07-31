const sequelize = require("../config/database");

const Category = require("./Category");
const Product = require("./Product");

Category.hasMany(Product, {

    foreignKey: "categoryId",

    as: "products"

});

Product.belongsTo(Category, {

    foreignKey: "categoryId",

    as: "category"

});


module.exports = {

    sequelize,

    Category,

    Product

};