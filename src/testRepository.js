const ProductService =
    // require("./src/services/ProductService");
    require("./services/ProductService");


(async () => {

    const service = new ProductService();

    console.log(

        "Total:",

        await service.countActive()

    );

    console.log(

        "Eliminados:",

        await service.countDeleted()

    );

    console.log(

        "Existe PROD-001:",

        await service.exists("PROD-001")

    );

})();