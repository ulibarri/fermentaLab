
class ProductsPage extends CrudPage {

    constructor() {


        super(

            new ProductApi(),

            new ProductForm("productForm"),

            new CrudTable(

                "productsTableBody",

                [

                    { field: "id" },

                    { field: "categoryId" },

                    { field: "name" },

                    {

                        field: "active",

                        formatter: value => value ? "Sí" : "No"

                    }

                ]

            ),

            {

                entityName: "Producto",

                deleteMessage: "¿Desea eliminar este producto?",

                createdMessage: "Producto creado correctamente.",

                updatedMessage: "Producto actualizado correctamente.",

                deletedMessage: "Producto eliminado correctamente."

            }

        );

        // Evento Guardar
        this.form.form.addEventListener(

            "submit",

            e => this.save(e)

        );

        // Evento Nuevo Producto
        document

            .getElementById("btnNuevo")

            .addEventListener(

                "click",

                () => this.form.openNew()

            );

    }


    createActions(td, product) {

        const btnEdit =
            document.createElement("button");

        btnEdit.className =
            "btn btn-warning btn-sm me-2";

        btnEdit.textContent =
            "Editar";

        btnEdit.onclick =
            () => this.edit(product.id);

        td.appendChild(btnEdit);

        const btnDelete =
            document.createElement("button");

        btnDelete.className =
            "btn btn-danger btn-sm";

        btnDelete.textContent =
            "Eliminar";

        btnDelete.onclick =
            () => this.remove(product.id);

        td.appendChild(btnDelete);

    }

}

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        window.productsPage =

            new ProductsPage();

        await window.productsPage.load();

    }

);