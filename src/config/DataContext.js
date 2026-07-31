const JsonRepository = require("../repositories/JsonRepository");
const Files = require("./DataFiles");

module.exports = {

    categories: new JsonRepository(Files.categories),

    products: new JsonRepository(Files.products),

    recipes: new JsonRepository(Files.recipes),

    lots: new JsonRepository(Files.lots),

    inventory: new JsonRepository(Files.inventory),

    settings: new JsonRepository(Files.settings)

};