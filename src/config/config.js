module.exports = {

    development: {

        dialect: "sqlite",

        storage: "./src/database/fermentalab.db"

    },

    test: {

        dialect: "sqlite",

        storage: ":memory:"

    },

    production: {

        dialect: "sqlite",

        storage: "./src/database/fermentalab.db"

    }

};