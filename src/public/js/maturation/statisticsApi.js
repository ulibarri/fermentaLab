class MaturationStatisticsApi {

    buildQuery(filters = {}) {

        const params =
            new URLSearchParams();

        if (filters.productId !== null && filters.productId !== undefined && filters.productId !== "") {

            params.set("productId", filters.productId);

        }

        const query =
            params.toString();

        return query ? `?${query}` : "";

    }

    async getStatistics(filters = {}) {

        const url =
            `/api/maturation/statistics${this.buildQuery(filters)}`;

        const response =
            await Api.get(url);

        return response.data;

    }

    async getTemperatureAnalysis(filters = {}) {

        const url =
            `/api/maturation/analysis/temperature${this.buildQuery(filters)}`;

        const response =
            await Api.get(url);

        return response.data;

    }

    async getVolumeAnalysis(filters = {}) {

        const url =
            `/api/maturation/analysis/volume${this.buildQuery(filters)}`;

        const response =
            await Api.get(url);

        return response.data;

    }

    async getMultivariableAnalysis(filters = {}) {

        const url =
            `/api/maturation/analysis/multivariable${this.buildQuery(filters)}`;

        const response =
            await Api.get(url);

        return response.data;

    }

    async getModelComparison(filters = {}) {

        const url =
            `/api/maturation/analysis/models${this.buildQuery(filters)}`;

        const response =
            await Api.get(url);

        return response.data;

    }

    async getTemporalValidation(filters = {}) {

        const url =
            `/api/maturation/analysis/temporal-validation${this.buildQuery(filters)}`;

        const response =
            await Api.get(url);

        return response.data;

    }

    async getModelRecommendation(filters = {}) {

        const url =
            `/api/maturation/analysis/model-recommendation${this.buildQuery(filters)}`;

        const response =
            await Api.get(url);

        return response.data;

    }

    async getModelAccuracyMetrics(filters = {}) {

        const url =
            `/api/maturation/models/metrics${this.buildQuery(filters)}`;

        const response =
            await Api.get(url);

        return response.data;

    }

    async getModelCalibrationAnalysis(filters = {}) {

        const url =
            `/api/maturation/models/calibration-analysis${this.buildQuery(filters)}`;

        const response =
            await Api.get(url);

        return response.data;

    }

    async getModelStatus({ recipeVersionId }) {

        const response =
            await Api.get(`/api/maturation/models/status?recipeVersionId=${recipeVersionId}`);

        return response.data;

    }

    async activateModel({ recipeVersionId, modelType, notes }) {

        const response =
            await Api.post("/api/maturation/models/activate", { recipeVersionId, modelType, notes });

        return response.data;

    }

    async activateRecommendedModel({ recipeVersionId, notes }) {

        const response =
            await Api.post("/api/maturation/models/activate-recommendation", { recipeVersionId, notes });

        return response.data;

    }

}
