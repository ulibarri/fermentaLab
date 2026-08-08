class F2FinishForm extends CrudForm {

    constructor(formId) {

        super(

            formId,

            "modalF2Finish"

        );

        this.batchId = null;

    }

    numberOrNull(value) {

        if (value === "" || value === null || value === undefined)

            return null;

        return Number(value);

    }

    read() {

        return {

            carbonationNotes:
                this.form.carbonationNotes.value || null

        };

    }

    clear() {

        this.batchId = null;

        this.form.reset();

        if (this.submitButton) {

            this.submitButton.textContent =
                "Finalizar F2";

        }

    }

    openFor(batchId) {

        this.batchId = batchId;

        this.form.reset();

        this.open();

    }

}
