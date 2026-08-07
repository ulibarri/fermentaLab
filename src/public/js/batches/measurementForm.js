class MeasurementForm extends CrudForm {

    constructor(formId) {

        super(

            formId,

            "modalMeasurement"

        );

    }

    numberOrNull(value) {

        if (value === "" || value === null || value === undefined)

            return null;

        return Number(value);

    }

    toDatetimeLocalValue(isoString) {

        const date =
            new Date(isoString);

        const pad =
            n => String(n).padStart(2, "0");

        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

    }

    read() {

        const rawDate =
            this.form.measurementDate.value;

        return {

            measurementDate:
                rawDate
                    ? new Date(rawDate).toISOString()
                    : null,

            phase:
                this.form.phase.value,

            ph:
                this.numberOrNull(this.form.ph.value),

            brix:
                this.numberOrNull(this.form.brix.value),

            specificGravity:
                this.numberOrNull(this.form.specificGravity.value),

            estimatedAlcohol:
                this.numberOrNull(this.form.estimatedAlcohol.value),

            liquidTemperature:
                this.numberOrNull(this.form.liquidTemperature.value),

            ambientTemperature:
                this.numberOrNull(this.form.ambientTemperature.value),

            psi:
                this.numberOrNull(this.form.psi.value),

            notes:
                this.form.notes.value || null

        };

    }

    load(measurement) {

        this.editingId = measurement.id;

        this.form.measurementDate.value =
            measurement.measurementDate
                ? this.toDatetimeLocalValue(measurement.measurementDate)
                : "";

        this.form.phase.value =
            measurement.phase;

        this.form.ph.value =
            measurement.ph ?? "";

        this.form.brix.value =
            measurement.brix ?? "";

        this.form.specificGravity.value =
            measurement.specificGravity ?? "";

        this.form.estimatedAlcohol.value =
            measurement.estimatedAlcohol ?? "";

        this.form.liquidTemperature.value =
            measurement.liquidTemperature ?? "";

        this.form.ambientTemperature.value =
            measurement.ambientTemperature ?? "";

        this.form.psi.value =
            measurement.psi ?? "";

        this.form.notes.value =
            measurement.notes || "";

        this.submitButton.textContent =
            "Actualizar";

    }

    openNew() {

        this.clear();

        this.form.measurementDate.value =
            this.toDatetimeLocalValue(new Date().toISOString());

        document
            .getElementById("modalMeasurementTitle")
            .textContent =
            "Nueva Medición";

        this.open();

    }

    openEdit(measurement) {

        this.load(measurement);

        document
            .getElementById("modalMeasurementTitle")
            .textContent =
            "Editar Medición";

        this.open();

    }

}
