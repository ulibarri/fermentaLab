class MeasurementForm extends CrudForm {

    constructor(formId) {

        super(

            formId,

            "modalMeasurement"

        );

        this._co2DebounceTimer = null;

        this.form.phase.addEventListener(

            "change",

            () => this.updateFieldsForPhase()

        );

        this.form.psi.addEventListener(

            "input",

            () => this.scheduleCo2Estimate()

        );

        this.form.ambientTemperature.addEventListener(

            "input",

            () => this.scheduleCo2Estimate()

        );

    }

    updateFieldsForPhase() {

        const isF2 =
            this.form.phase.value === "F2";

        const psiGroup =
            document.getElementById("psiGroup");

        if (psiGroup) {

            psiGroup.style.display =
                isF2 ? "block" : "none";

        }

        this.form.psi.disabled = !isF2;

        if (!isF2) {

            this.form.psi.value = 0;

        }

        const co2Group =
            document.getElementById("co2Group");

        if (co2Group) {

            co2Group.style.display =
                isF2 ? "block" : "none";

        }

        if (!isF2) {

            this.setCo2Preview(null);

        }

        const f1FinalFieldsGroup =
            document.getElementById("f1FinalFieldsGroup");

        if (f1FinalFieldsGroup) {

            f1FinalFieldsGroup.style.display =
                isF2 ? "none" : "block";

        }

        if (isF2) {

            this.scheduleCo2Estimate();

        }

    }

    setCo2Preview(co2Volumes) {

        const el =
            document.getElementById("co2PreviewValue");

        if (!el) {

            return;

        }

        el.textContent =
            co2Volumes !== null && co2Volumes !== undefined
                ? `≈ ${co2Volumes} volumes`
                : "—";

    }

    scheduleCo2Estimate() {

        clearTimeout(this._co2DebounceTimer);

        this._co2DebounceTimer =
            setTimeout(

                () => this.estimateCo2(),

                400

            );

    }

    async estimateCo2() {

        if (this.form.phase.value !== "F2") {

            return;

        }

        const psi =
            this.numberOrNull(this.form.psi.value);

        const temperature =
            this.numberOrNull(this.form.ambientTemperature.value);

        if (psi === null || temperature === null) {

            this.setCo2Preview(null);

            return;

        }

        try {

            const response =
                await Api.post(

                    "/api/carbonation/estimate",

                    { psi, temperature }

                );

            this.setCo2Preview(response.data.co2Volumes);

        } catch (err) {

            this.setCo2Preview(null);

        }

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

            brixLafmate:
                this.numberOrNull(this.form.brixLafmate.value),

            specificGravity:
                this.numberOrNull(this.form.specificGravity.value),

            estimatedAlcohol:
                this.numberOrNull(this.form.estimatedAlcohol.value),

            liquidTemperature:
                this.numberOrNull(this.form.liquidTemperature.value),

            ambientTemperature:
                this.numberOrNull(this.form.ambientTemperature.value),

            psi:
                this.form.phase.value === "F2"
                    ? this.numberOrNull(this.form.psi.value)
                    : 0,

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

        this.form.brixLafmate.value =
            measurement.brixLafmate ?? "";

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

        this.updateFieldsForPhase();

        this.setCo2Preview(measurement.co2Volumes ?? null);

    }

    openNew() {

        this.clear();

        this.form.measurementDate.value =
            this.toDatetimeLocalValue(new Date().toISOString());

        this.updateFieldsForPhase();

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
