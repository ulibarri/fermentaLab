const path = require("path");

const ROOT =
    path.resolve(__dirname, "..", "..");

module.exports = {

    root(...segments) {

        return path.join(ROOT, ...segments);

    }

};