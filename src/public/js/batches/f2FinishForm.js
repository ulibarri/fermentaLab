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

            finalPsiReading:
                this.numberOrNull(this.form.finalPsiReading.value),

            finalPh:
                this.numberOrNull(this.form.finalPh.value),

            finalBrix:
                this.numberOrNull(this.form.finalBrix.value),

            finalSpecificGravity:
                this.numberOrNull(this.form.finalSpecificGravity.value),

            estimatedAlcohol:
                this.numberOrNull(this.form.estimatedAlcohol.value),

            finalTemperature:
                this.numberOrNull(this.form.finalTemperature.value),

            ambientTemperature:
                this.numberOrNull(this.form.ambientTemperature.value),

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
