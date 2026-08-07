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

        if (!data || !data.recipeVersionId) {

            throw new Error("recipeVersionId es obligatorio.");

        }

        return this.transactional(

            async transaction => {

                const recipeVersion =
                    await RecipeVersion.findByPk(

                        data.recipeVersionId,

                        {

                            include: [

                                {

                                    model: Recipe,

                                    as: "recipe",

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

                const created = await this.repository.create({

                    batchNumber,

                    recipeVersionId: data.recipeVersionId,

                    plannedVolume: data.plannedVolume,

                    targetVolume: data.targetVolume,

                    producedVolume: null,

                    status: "PLANNED",

                    startedAt: null,

                    finishedAt: null,

                    secondFermentStartedAt: null,

                    secondFermentFinishedAt: null,

                    finalPsiReading: null,

                    notes: data.notes

                }, {

                    transaction

                });

                return await this.repository.findById(created.id);

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
    async complete(batchId, data, transaction = null) {

        if (!data) {

            throw new Error(
                "No se recibieron datos. Verifica el body y el header Content-Type: application/json."
            );

        }

        return this.transactional(

            async transaction => {

                const batch =
                    await this.repository.findById(

                        batchId,

                        transaction

                    );

                if (!batch) {

                    throw new Error("Batch not found");

                }

                if (batch.status !== "IN_PROGRESS") {

                    throw new Error(
                        "El lote debe estar en progreso (IN_PROGRESS) para poder completarse."
                    );

                }

                batch.status = "COMPLETED";

                batch.producedVolume =
                    data.producedVolume;

                batch.finishedAt =
                    new Date();

                batch.notes =
                    data.notes ?? batch.notes;

                return await this.repository.update(

                    batchId,

                    batch,

                    transaction

                );

            },

            transaction

        );

    }
    async cancel(batchId, reason = null, transaction = null) {

        return this.transactional(

            async transaction => {

                const batch =
                    await this.repository.findById(

                        batchId,

                        transaction

                    );

                if (!batch) {

                    throw new Error("Batch not found");

                }

                if (batch.status !== "PLANNED" && batch.status !== "IN_PROGRESS") {

                    throw new Error(
                        "Solo se pueden cancelar lotes en estado PLANNED o IN_PROGRESS."
                    );

                }

                batch.status = "CANCELLED";

                if (reason) {

                    batch.notes =
                        reason;

                }

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