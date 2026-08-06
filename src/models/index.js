const sequelize = require("../config/database");

const Category = require("./Category");
const Product = require("./Product");
const Unit = require("./Unit");
const Ingredient = require("./Ingredient");
const Recipe = require("./Recipe");
const RecipeVersion = require("./RecipeVersion");
const RecipeIngredient = require("./RecipeIngredient");
const ProductionBatch = require("./ProductionBatch");

Category.hasMany(Product, {

    foreignKey: "categoryId",

    as: "products"

});

Product.belongsTo(Category, {

    foreignKey: "categoryId",

    as: "category"

});
Unit.hasMany(Ingredient, {

    foreignKey: "unitId",

    as: "ingredients"

});

Ingredient.belongsTo(Unit, {

    foreignKey: "unitId",

    as: "unit"

});
Product.hasMany(Recipe, {

    foreignKey: "productId",

    as: "recipes"

});

Recipe.belongsTo(Product, {

    foreignKey: "productId",

    as: "product"

});
Recipe.hasMany(RecipeVersion, {

    foreignKey: "recipeId",

    as: "versions"

});

RecipeVersion.belongsTo(Recipe, {

    foreignKey: "recipeId",

    as: "recipe"

});

Unit.hasMany(RecipeVersion, {

    foreignKey: "batchUnitId",

    as: "recipeVersions"

});

RecipeVersion.belongsTo(Unit, {

    foreignKey: "batchUnitId",

    as: "batchUnit"

});

RecipeVersion.hasMany(RecipeIngredient, {

    foreignKey: "recipeVersionId",

    as: "ingredients"

});

RecipeIngredient.belongsTo(RecipeVersion, {

    foreignKey: "recipeVersionId",

    as: "recipeVersion"

});
Ingredient.hasMany(RecipeIngredient, {

    foreignKey: "ingredientId",

    as: "recipeIngredients"

});

RecipeIngredient.belongsTo(Ingredient, {

    foreignKey: "ingredientId",

    as: "ingredient"

});
Unit.hasMany(RecipeIngredient, {

    foreignKey: "unitId",

    as: "recipeIngredients"

});

RecipeIngredient.belongsTo(Unit, {

    foreignKey: "unitId",

    as: "unit"

});
RecipeVersion.hasMany(

    ProductionBatch,

    {

        foreignKey: "recipeVersionId",

        as: "productionBatches"

    }

);

ProductionBatch.belongsTo(

    RecipeVersion,

    {

        foreignKey: "recipeVersionId",

        as: "recipeVersion"

    }

);

module.exports = {

    sequelize,

    Category,

    Product,

    Unit,

    Ingredient,

    Recipe,

    RecipeVersion,

    RecipeIngredient,

    ProductionBatch
};