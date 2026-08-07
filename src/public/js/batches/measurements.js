class MeasurementsPage extends CrudPage {

    constructor(batchId) {

        super(

            new MeasurementApi(batchId),

            new MeasurementForm("measurementForm"),

            new CrudTable(

                "measurementsTableBody",

                [

                    {

                        field: "measurementDate",

                        formatter: value =>

                            value

                                ? new Date(value)
                                    .toLocaleString()

                                : "-"

                    },

                    {

                        field: "phase"

                    },

                    {

                        field: "ph",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "brix",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "specificGravity",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "liquidTemperature",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "ambientTemperature",

                        formatter: value =>

                            value ?? "—"

                    },

                    {

                        field: "psi",

                        formatter: value =>

                            value ?? "—"

                    }

                ]

            ),

            {

                entityName:
                    "Medición",

                deleteMessage:
                    "¿Desea eliminar esta medición?",

                createdMessage:
                    "Medición registrada correctamente.",

                updatedMessage:
                    "Medición actualizada correctamente.",

                deletedMessage:
                    "Medición eliminada correctamente."

            }

        );

        this.items = [];

        this.form.form.addEventListener(

            "submit",

            e => this.save(e)

        );

        document

            .getElementById("btnNuevaMedicion")

            .addEventListener(

                "click",

                () => this.form.openNew()

            );

    }

    async load() {

        UI.loading(true);

        try {

            const items =
                await this.api.getAll();

            this.items = items;

            this.table.render(

                items,

                (td, item) =>

                    this.createActions(

                        td,

                        item

                    )

            );

        }

        catch (err) {

            UI.error(err.message);

        }

        finally {

            UI.loading(false);

        }

    }

    async edit(id) {

        const measurement =
            this.items.find(

                m => m.id === id

            );

        if (!measurement) {

            UI.error("No se encontró la medición.");

            return;

        }

        this.form.openEdit(measurement);

    }

    createActions(td, measurement) {

        const btnEdit =

            document.createElement("button");

        btnEdit.className =

            "btn btn-info btn-sm me-2";

        btnEdit.textContent =

            "Editar";

        btnEdit.onclick =

            () => this.edit(measurement.id);

        td.appendChild(btnEdit);

        const btnDelete =

            document.createElement("button");

        btnDelete.className =

            "btn btn-danger btn-sm";

        btnDelete.textContent =

            "Eliminar";

        btnDelete.onclick =

            () => this.remove(measurement.id);

        td.appendChild(btnDelete);

    }

}
document.addEventListener(

    "DOMContentLoaded",

    async () => {

        window.measurementsPage =

            new MeasurementsPage(window.BATCH_ID);

        await window.measurementsPage.load();

    }

);
