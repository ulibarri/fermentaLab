class BaseSeeder {

    constructor(context, transaction) {

        this.context = context;

        this.transaction = transaction;

    }

    async run() {

        throw new Error(
            "run() no implementado."
        );

    }

}

module.exports = BaseSeeder;