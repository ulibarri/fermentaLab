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

    }

    renderStatus(status) {

        const colors = {

            PLANNED: "secondary",

            IN_PROGRESS: "primary",

            COMPLETED: "success",

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

    createActions(td, batch) {

        const btnView =

            document.createElement("button");

        btnView.className =

            "btn btn-info btn-sm me-2";

        btnView.textContent =

            "Ver";

        btnView.onclick =

            () => this.edit(batch.id);

        td.appendChild(btnView);

        if (batch.status !== "CANCELLED") {

            const btnCancel =

                document.createElement("button");

            btnCancel.className =

                "btn btn-danger btn-sm";

            btnCancel.textContent =

                "Cancelar";

            btnCancel.onclick =

                () => this.remove(batch.id);

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