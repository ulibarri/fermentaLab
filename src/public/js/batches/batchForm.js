class BatchForm extends CrudForm {

    constructor(formId) {

        super(

            formId,

            "modalBatch"

        );

    }

    read() {

        return {

            recipeVersionId:
                Number(
                    this.form.recipeVersionId.value
                ),

            plannedVolume:
                Number(
                    this.form.plannedVolume.value
                ),

            targetVolume:
                Number(
                    this.form.targetVolume.value
                ),

            notes:
                this.form.notes.value

        };

    }

    load(batch) {

        this.editingId = batch.id;

        this.form.recipeVersionId.value =
            batch.recipeVersionId;

        this.form.plannedVolume.value =
            batch.plannedVolume;

        this.form.targetVolume.value =
            batch.targetVolume ?? "";

        this.form.notes.value =
            batch.notes || "";

        this.submitButton.textContent =
            "Actualizar";

    }

    clear() {

        this.editingId = null;

        this.form.reset();

        this.submitButton.textContent =
            "Guardar";

    }

    openNew() {

        this.clear();

        document
            .getElementById("modalTitle")
            .textContent =
            "Nuevo Lote";

        this.open();

    }

    openEdit(batch) {

        this.load(batch);

        document
            .getElementById("modalTitle")
            .textContent =
            "Editar Lote";

        this.open();

    }

}