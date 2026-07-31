class ProductForm extends CrudForm {


    constructor(formId) {

        super(

            formId,

            "modalProduct"

        );

    }
    read() {

        return {

            categoryId: this.form.categoryId.value,

            name: this.form.name.value,

            description: this.form.description.value

        };

    }

    load(product) {

        this.editingId = product.id;

        this.form.categoryId.value = product.categoryId;

        this.form.name.value = product.name;

        this.form.description.value =
            product.description || "";

        this.submitButton.textContent = "Actualizar";


    }

    clear() {

        this.editingId = null;

        this.form.reset();

        this.submitButton.textContent = "Guardar";


    }

    isEditing() {

        return this.editingId !== null;

    }

    openNew() {

        this.clear();

        document.getElementById("modalTitle")

            .textContent =

            "Nuevo Producto";

        this.open();

    }


    openEdit(product) {

        this.load(product);

        document.getElementById("modalTitle")

            .textContent =

            "Editar Producto";

        this.open();

    }

    close() {


        console.log("close() llamado");

    }


}