class CrudForm {

    constructor(formId, modalId) {

        this.form = document.getElementById(formId);

        this.modalElement =
            document.getElementById(modalId);

        this.modal =
            bootstrap.Modal.getOrCreateInstance(
                this.modalElement
            );

        this.editingId = null;

        this.submitButton =
            this.form.querySelector(
                "button[type='submit']"
            );

        this.modalElement.addEventListener(

            "hidden.bs.modal",

            () => this.clear()

        );

    }

    clear() {

        this.editingId = null;

        this.form.reset();

        if (this.submitButton) {

            this.submitButton.textContent =
                "Guardar";

        }

    }

    open() {

        this.modal.show();

    }

    close() {

        this.modal.hide();

    }

    isEditing() {

        return this.editingId !== null;

    }

}