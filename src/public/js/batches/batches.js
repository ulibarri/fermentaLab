class BatchesPage extends CrudPage {

    constructor() {

        super(

            new BatchApi(),

            new BatchForm("batchForm"),

            new CrudTable(

                "batchesTableBody",

                [

                    {

                        field: "batchNumber"

                    },

                    {

                        field: "recipeVersion",

                        formatter: (_, row) => {

                            if (!row.recipeVersion)
                                return "";

                            return row.recipeVersion.recipe?.name ??
                                `Versión ${row.recipeVersion.id}`;

                        }

                    },

                    {

                        field: "plannedVolume",

                        formatter: value =>
                            `${value} L`

                    },

                    {

                        field: "status",

                        formatter: value =>
                            this.renderStatus(value)

                    },

                    {

                        field: "startedAt",

                        formatter: value =>

                            value

                                ? new Date(value)
                                    .toLocaleString()

                                : "-"

                    },

                    {

                        field: "producedVolume",

                        formatter: value =>

                            value !== null && value !== undefined

                                ? `${value} L`

                                : "—"

                    },

                    {

                        field: "finishedAt",

                        formatter: value =>

                            value

                                ? new Date(value)
                                    .toLocaleString()

                                : "—"

                    },

                    {

                        field: "secondFermentStartedAt",

                        formatter: value =>

                            value

                                ? new Date(value)
                                    .toLocaleString()

                                : "—"

                    }

                ]

            ),

            {

                entityName:
                    "Lote",

                deleteMessage:
                    "¿Desea cancelar este lote?",

                createdMessage:
                    "Lote creado correctamente.",

                updatedMessage:
                    "Lote actualizado correctamente.",

                deletedMessage:
                    "Lote cancelado correctamente."

            }

        );

        this.form.form.addEventListener(

            "submit",

            e => this.save(e)

        );

        document

            .getElementById("btnNuevo")

            .addEventListener(

                "click",

                () => this.form.openNew()

            );

        this.f2FinishForm =
            new F2FinishForm("f2FinishForm");

        this.f2FinishForm.form.addEventListener(

            "submit",

            e => this.saveF2Finish(e)

        );

    }

    renderStatus(status) {

        const colors = {

            PLANNED: "secondary",

            IN_PROGRESS: "primary",

            COMPLETED: "success",

            F2_STARTED: "info",

            F2_DONE: "dark",

            CANCELLED: "danger"

        };

        const color =

            colors[status] ||

            "secondary";

        return `

            <span class="badge bg-${color}">

                ${status}

            </span>

        `;

    }

    async start(id) {

        const ok = await UI.confirm(

            "¿Desea iniciar este lote?"

        );

        if (!ok)

            return;

        try {

            await this.api.start(id);

            UI.success(

                "Producción iniciada."

            );

            await this.load();

        }

        catch (err) {

            UI.error(err.message);

        }

    }

    async cancelBatch(id) {

        const ok = await UI.confirm(

            "¿Desea cancelar este lote?"

        );

        if (!ok)

            return;

        const reason =
            prompt("Motivo de cancelación (opcional):") ||
            null;

        try {

            await this.api.cancel(id, { reason });

            UI.success(

                "Lote cancelado correctamente."

            );

            await this.load();

        }

        catch (err) {

            UI.error(err.message);

        }

    }

    async complete(id) {

        const ok = await UI.confirm(

            "¿Desea finalizar la producción de este lote?"

        );

        if (!ok)

            return;

        const producedVolumeInput =
            prompt("Volumen producido (L):");

        if (producedVolumeInput === null)

            return;

        const producedVolume =
            Number(producedVolumeInput);

        if (isNaN(producedVolume)) {

            UI.error(
                "El volumen producido debe ser un número."
            );

            return;

        }

        const notes =
            prompt("Observaciones:") ||
            null;

        try {

            await this.api.complete(id, {

                producedVolume,

                notes

            });

            UI.success(

                "Producción finalizada."

            );

            await this.load();

        }

        catch (err) {

            UI.error(err.message);

        }

    }

    async startSecondFermentation(id) {

        const ok = await UI.confirm(

            "¿Desea iniciar la segunda fermentación de este lote?"

        );

        if (!ok)

            return;

        try {

            await this.api.startSecondFermentation(id);

            UI.success(

                "Segunda fermentación iniciada."

            );

            await this.load();

        }

        catch (err) {

            UI.error(err.message);

        }

    }

    async saveF2Finish(event) {

        event.preventDefault();

        const id = this.f2FinishForm.batchId;

        const data = this.f2FinishForm.read();

        try {

            await this.api.finishSecondFermentation(id, data);

            this.f2FinishForm.close();

            UI.success(

                "Segunda fermentación finalizada."

            );

            await this.load();

        }

        catch (err) {

            UI.error(err.message);

        }

    }

    createActions(td, batch) {

        if (batch.status !== "PLANNED") {

            const btnMeasurements =

                document.createElement("button");

            btnMeasurements.className =

                "btn btn-secondary btn-sm me-2";

            btnMeasurements.textContent =

                "Mediciones";

            btnMeasurements.onclick =

                () => {

                    window.location.href =
                        `/batches/${batch.id}/measurements`;

                };

            td.appendChild(btnMeasurements);

        }

        if (batch.status === "PLANNED") {

            const btnStart =

                document.createElement("button");

            btnStart.className =

                "btn btn-success btn-sm me-2";

            btnStart.textContent =

                "▶ Iniciar";

            btnStart.onclick =

                () => this.start(batch.id);

            td.appendChild(btnStart);

        }

        if (batch.status === "IN_PROGRESS") {

            const btnComplete =

                document.createElement("button");

            btnComplete.className =

                "btn btn-primary btn-sm me-2";

            btnComplete.textContent =

                "Finalizar";

            btnComplete.onclick =

                () => this.complete(batch.id);

            td.appendChild(btnComplete);

        }

        if (batch.status === "COMPLETED") {

            const btnStartF2 =

                document.createElement("button");

            btnStartF2.className =

                "btn btn-info btn-sm me-2";

            btnStartF2.textContent =

                "Iniciar F2";

            btnStartF2.onclick =

                () => this.startSecondFermentation(batch.id);

            td.appendChild(btnStartF2);

        }

        if (batch.status === "F2_STARTED") {

            const btnFinishF2 =

                document.createElement("button");

            btnFinishF2.className =

                "btn btn-dark btn-sm me-2";

            btnFinishF2.textContent =

                "Finalizar F2";

            btnFinishF2.onclick =

                () => this.f2FinishForm.openFor(batch.id);

            td.appendChild(btnFinishF2);

        }

        if (batch.status === "PLANNED") {

            const btnEdit =

                document.createElement("button");

            btnEdit.className =

                "btn btn-info btn-sm me-2";

            btnEdit.textContent =

                "Editar";

            btnEdit.onclick =

                () => this.edit(batch.id);

            td.appendChild(btnEdit);

        }

        if (batch.status === "PLANNED" || batch.status === "IN_PROGRESS") {

            const btnCancel =

                document.createElement("button");

            btnCancel.className =

                "btn btn-danger btn-sm";

            btnCancel.textContent =

                "Cancelar";

            btnCancel.onclick =

                () => this.cancelBatch(batch.id);

            td.appendChild(btnCancel);

        }

    }

}
document.addEventListener(

    "DOMContentLoaded",

    async () => {

        window.batchesPage =

            new BatchesPage();

        await window.batchesPage.load();

    }

);