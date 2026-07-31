const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

module.exports = {

    root: ROOT,

    data: path.join(ROOT, "data"),

    public: path.join(ROOT, "public"),

    views: path.join(ROOT, "views"),

    src: path.join(ROOT, "src")

};