const BaseService = require("./BaseService");
const UnitRepository = require("../repositories/UnitRepository");

class UnitService extends BaseService {

    constructor() {

        super(

            new UnitRepository()

        );

    }

}

module.exports = UnitService;