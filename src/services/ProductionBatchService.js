const BaseService =
    require("./BaseService");

const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");
const RecipeVersion =
    require("../models/RecipeVersion");

const Recipe =
    require("../models/Recipe");

const Product =
    require("../models/Product");

const Category =
    require("../models/Category");

const BatchNumberGenerator =
    require("../utils/BatchNumberGenerator");


class ProductionBatchService
    extends BaseService {

    constructor() {

        super(

            new ProductionBatchRepository()

        );

    }
    async create(data, transaction = null) {

        return this.transactional(

            async transaction => {

                const recipeVersion =
                    await RecipeVersion.findByPk(

                        data.recipeVersionId,

                        {

                            include: [

                                {

                                    model: Product,

                                    as: "product",

                                    include: [

                                        {

                                            model: Category,

                                            as: "category"

                                        }

                                    ]

                                }

                            ]

                        }

                    );

                if (!recipeVersion) {

                    throw new Error("Recipe version not found");

                }

                const batchNumber =
                    await BatchNumberGenerator.next(

                        recipeVersion,

                        this.repository

                    );

                const batch = await this.repository.create({

                    batchNumber,

                    recipeVersionId: data.recipeVersionId,

                    plannedVolume: data.plannedVolume,

                    targetVolume: data.targetVolume,

                    status: ProductionBatchStatus.PLANNED,

                    notes: data.notes

                }, {

                    transaction

                });

                return batch;

            },

            transaction

        );

    }
    async start(batchId, transaction = null) {

        return this.transactional(

            async transaction => {

                const batch = await this.repository.findById(

                    batchId,

                    transaction

                );

                if (!batch) {

                    throw new Error("Batch not found");

                }

                if (batch.status !== "PLANNED") {

                    throw new Error("Batch must be planned to start");

                }

                batch.status =
                    "IN_PROGRESS";

                batch.startedAt =
                    new Date();

                return await this.repository.update(

                    batchId,

                    batch,

                    transaction

                );

            },

            transaction

        );

    }
    async finish(batchId, producedVolume, notes = null, transaction = null) {

        return this.transactional(

            async transaction => {

                const batch = await this.repository.findById(

                    batchId,

                    transaction

                );

                if (!batch) {

                    throw new Error("Batch not found");

                }

                if (batch.status !== "IN_PROGRESS") {

                    throw new Error("Batch must be in progress to finish");

                }

                batch.status =
                    "COMPLETED";

                batch.producedVolume =
                    producedVolume;

                batch.notes =
                    notes || batch.notes;

                batch.finishedAt =
                    new Date();

                return await this.repository.update(

                    batchId,

                    batch,

                    transaction

                );

            },

            transaction

        );

    }

}

module.exports =
    ProductionBatchService;