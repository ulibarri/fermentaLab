/*
 * Entrega 2.8.0.2 -- lógica de la página administrativa. Mismo patrón
 * vanilla JS + delegación de eventos que `MaturationCalibrationsPage`
 * (2.6.1.16 en adelante): sin CrudForm/CrudPage/CrudTable, sin
 * framework -- solo DOM directo, `bootstrap.Modal.getOrCreateInstance`
 * y `UI.loading/success/error/confirm`.
 */

const HYDROMETER_TABLE_STATUS_BADGES = {

    DRAFT: "secondary",

    VALIDATED: "info",

    ACTIVE: "success",

    INACTIVE: "dark"

};

class HydrometerConversionTablesPage {

    constructor() {

        this.api =
            new HydrometerConversionTablesApi();

        this.tableBody =
            document.getElementById("hydrometerTablesBody");

        this.newTableForm =
            document.getElementById("newTableForm");

        this.modalNewTable =
            bootstrap.Modal.getOrCreateInstance(document.getElementById("modalNewTable"));

        this.modalTableDetail =
            bootstrap.Modal.getOrCreateInstance(document.getElementById("modalTableDetail"));

        this.currentDetailId =
            null;

        this.tableBody.addEventListener("click", e => this.handleTableClick(e));

        document.getElementById("btnNewTable").addEventListener("click", () => this.openNewTable(null));

        this.newTableForm.addEventListener("submit", e => this.handleCreateSubmit(e));

        document.getElementById("tableDetailActions").addEventListener("click", e => this.handleDetailActionClick(e));

        document.getElementById("btnSimulate").addEventListener("click", () => this.handleSimulate());

        this.load();

    }

    async load() {

        try {

            UI.loading(true);

            const tables =
                await this.api.list();

            this.renderRows(tables);

        } catch (err) {

            UI.error(err.message);

        } finally {

            UI.loading(false);

        }

    }

    renderRows(tables) {

        if (!tables || tables.length === 0) {

            this.tableBody.innerHTML =
                `<tr><td colspan="9" class="text-center text-muted">Todavía no hay ninguna tabla de conversión.</td></tr>`;

            return;

        }

        this.tableBody.innerHTML =
            tables.map(t => this.rowHtml(t)).join("");

    }

    badge(status) {

        const color =
            HYDROMETER_TABLE_STATUS_BADGES[status] || "secondary";

        return `<span class="badge bg-${color}">${status}</span>`;

    }

    rowHtml(t) {

        const range =
            t.minSg !== null && t.maxSg !== null
                ? `${t.minSg} -- ${t.maxSg}`
                : "--";

        const created =
            t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "--";

        return `

            <tr>

                <td>${t.name}</td>

                <td>${t.manufacturer || "--"}</td>

                <td><code>${t.instrument}</code></td>

                <td>v${t.version}</td>

                <td>${this.badge(t.status)}</td>

                <td>${range}</td>

                <td>${t.rowCount ?? "--"}</td>

                <td>${created}${t.createdBy ? " -- " + t.createdBy : ""}</td>

                <td>

                    <button class="btn btn-sm btn-outline-primary" data-action="view" data-id="${t.id}">Ver</button>

                    ${t.status === "DRAFT" ? `<button class="btn btn-sm btn-outline-info" data-action="validate" data-id="${t.id}">Validar</button>` : ""}

                    ${t.status === "VALIDATED" ? `<button class="btn btn-sm btn-outline-success" data-action="activate" data-id="${t.id}">Activar</button>` : ""}

                    ${t.status === "ACTIVE" || t.status === "INACTIVE" ? `<button class="btn btn-sm btn-outline-secondary" data-action="new-version" data-id="${t.id}">Nueva versión</button>` : ""}

                </td>

            </tr>

        `;

    }

    async handleTableClick(e) {

        const button =
            e.target.closest("button[data-action]");

        if (!button) {

            return;

        }

        const id =
            button.dataset.id;

        const action =
            button.dataset.action;

        try {

            if (action === "view") {

                await this.openDetail(id);

            } else if (action === "validate") {

                await this.doValidate(id);

            } else if (action === "activate") {

                await this.doActivate(id);

            } else if (action === "new-version") {

                const parent =
                    await this.api.getById(id);

                this.openNewTable(parent);

            }

        } catch (err) {

            UI.error(err.message);

        }

    }

    async doValidate(id) {

        const result =
            await this.api.validate(id, "admin");

        if (result.valid) {

            UI.success("La tabla es válida. Ya puede activarse.");

        } else {

            UI.error("No se puede activar la tabla.\nErrores encontrados:\n" + result.errors.map(e => "• " + e).join("\n"));

        }

        await this.load();

        if (this.currentDetailId === id) {

            await this.openDetail(id);

        }

    }

    async doActivate(id) {

        const confirmed =
            await UI.confirm("¿Activar esta versión? Se desactivará automáticamente cualquier otra tabla ACTIVE del mismo instrumento. Las mediciones históricas no se ven afectadas.");

        if (!confirmed) {

            return;

        }

        await this.api.activate(id, "admin");

        UI.success("Tabla activada.");

        await this.load();

        if (this.currentDetailId === id) {

            await this.openDetail(id);

        }

    }

    /*
     * Sección 11 -- "Crear nueva versión" nunca edita la tabla
     * `parent` directamente: siempre abre el modal de creación con
     * `parentTableId` fijo y el instrumento/fabricante heredados, para
     * que quede claro que es un REEMPLAZO, no una edición.
     */
    openNewTable(parent) {

        this.newTableForm.reset();

        const parentIdInput =
            document.getElementById("newTableParentTableId");

        const notice =
            document.getElementById("newTableParentNotice");

        const changeReasonGroup =
            document.getElementById("newTableChangeReasonGroup");

        if (parent) {

            parentIdInput.value = parent.id;

            document.getElementById("newTableManufacturer").value = parent.manufacturer || "";

            notice.style.display = "block";

            notice.textContent = `Esta será una nueva versión de "${parent.name}" (v${parent.version} → v${parent.version + 1}), instrumento "${parent.instrument}". La versión anterior no se modifica.`;

            changeReasonGroup.style.display = "block";

        } else {

            parentIdInput.value = "";

            notice.style.display = "none";

            changeReasonGroup.style.display = "none";

        }

        this.modalNewTable.show();

    }

    async handleCreateSubmit(e) {

        e.preventDefault();

        try {

            const name =
                document.getElementById("newTableName").value.trim();

            const manufacturer =
                document.getElementById("newTableManufacturer").value.trim();

            const source =
                document.getElementById("newTableSource").value.trim();

            const parentTableId =
                document.getElementById("newTableParentTableId").value || null;

            const changeReason =
                document.getElementById("newTableChangeReason").value.trim();

            const fileInput =
                document.getElementById("newTableFile");

            const csvText =
                document.getElementById("newTableCsvText").value.trim();

            let file = null;

            if (fileInput.files && fileInput.files.length > 0) {

                file = fileInput.files[0];

            } else if (csvText !== "") {

                // Sección 16 -- pegar el texto CSV directamente cuenta
                // como "archivo" para el mismo endpoint de import: se
                // envuelve en un Blob para reusar exactamente la misma
                // ruta de parseo/validación que un archivo subido,
                // nunca una segunda lógica de creación en el cliente.
                file = new Blob([csvText], { type: "text/csv" });

                file.name = "pegado.csv";

            } else {

                UI.error("Sube un archivo CSV o pega las filas en el cuadro de texto.");

                return;

            }

            await this.api.importCsv(file, {

                name,

                manufacturer,

                source,

                parentTableId,

                changeReason,

                createdBy: "admin"

            });

            this.modalNewTable.hide();

            UI.success("Tabla creada en DRAFT. Valídala y actívala desde el detalle cuando estés listo.");

            await this.load();

        } catch (err) {

            const extra =
                err.data && Array.isArray(err.data.errors)
                    ? "\n" + err.data.errors.join("\n")
                    : "";

            UI.error(err.message + extra);

        }

    }

    async openDetail(id) {

        this.currentDetailId =
            id;

        document.getElementById("tableDetailSummary").innerHTML =
            "<p class=\"text-muted mb-0\">Cargando...</p>";

        document.getElementById("tableDetailRowsBody").innerHTML = "";

        document.getElementById("simulateResult").innerHTML = "";

        this.modalTableDetail.show();

        const record =
            await this.api.getById(id);

        this.renderDetail(record);

    }

    renderDetail(record) {

        const range =
            record.minSg !== null && record.maxSg !== null
                ? `${record.minSg} -- ${record.maxSg}`
                : "--";

        document.getElementById("modalTableDetailTitle").textContent =
            `${record.name} (v${record.version})`;

        document.getElementById("tableDetailSummary").innerHTML = `

            <dl class="row small mb-3">

                <dt class="col-4">Instrumento</dt><dd class="col-8"><code>${record.instrument}</code></dd>

                <dt class="col-4">Fabricante</dt><dd class="col-8">${record.manufacturer || "--"}</dd>

                <dt class="col-4">Estado</dt><dd class="col-8">${this.badge(record.status)}</dd>

                <dt class="col-4">Rango SG</dt><dd class="col-8">${range}</dd>

                <dt class="col-4">Filas</dt><dd class="col-8">${record.rowCount ?? "--"}</dd>

                <dt class="col-4">Origen</dt><dd class="col-8">${record.source || "--"}</dd>

                <dt class="col-4">Creado</dt><dd class="col-8">${record.createdAt ? new Date(record.createdAt).toLocaleString() : "--"}${record.createdBy ? " -- " + record.createdBy : ""}</dd>

                <dt class="col-4">Validado</dt><dd class="col-8">${record.validatedAt ? new Date(record.validatedAt).toLocaleString() + (record.validatedBy ? " -- " + record.validatedBy : "") : "--"}</dd>

                <dt class="col-4">Activado</dt><dd class="col-8">${record.activatedAt ? new Date(record.activatedAt).toLocaleString() + (record.activatedBy ? " -- " + record.activatedBy : "") : "--"}</dd>

                <dt class="col-4">Desactivado</dt><dd class="col-8">${record.deactivatedAt ? new Date(record.deactivatedAt).toLocaleString() : "--"}</dd>

            </dl>

        `;

        const errorsBox =
            document.getElementById("tableDetailErrors");

        if (record.lastValidationErrors && record.lastValidationErrors.length > 0) {

            errorsBox.style.display = "block";

            errorsBox.innerHTML =
                "<strong>No se puede activar la tabla. Errores encontrados:</strong><ul class=\"mb-0\">" +
                record.lastValidationErrors.map(e => `<li>${e}</li>`).join("") +
                "</ul>";

        } else {

            errorsBox.style.display = "none";

        }

        const actions =
            document.getElementById("tableDetailActions");

        const buttons = [];

        if (record.status === "DRAFT" || record.status === "VALIDATED") {

            buttons.push(`<button class="btn btn-sm btn-outline-info" data-action="validate">Validar</button>`);

        }

        if (record.status === "VALIDATED") {

            buttons.push(`<button class="btn btn-sm btn-outline-success" data-action="activate">Activar</button>`);

        }

        buttons.push(`<button class="btn btn-sm btn-outline-secondary" data-action="new-version">Crear nueva versión</button>`);

        actions.innerHTML =
            buttons.join(" ");

        document.getElementById("tableDetailRowsBody").innerHTML =
            (record.rows || []).map(row => `

                <tr>
                    <td>${row.rowOrder}</td>
                    <td>${row.sg}</td>
                    <td>${row.brix}</td>
                    <td>${row.alcohol}</td>
                </tr>

            `).join("");

    }

    async handleDetailActionClick(e) {

        const button =
            e.target.closest("button[data-action]");

        if (!button || !this.currentDetailId) {

            return;

        }

        const action =
            button.dataset.action;

        try {

            if (action === "validate") {

                await this.doValidate(this.currentDetailId);

            } else if (action === "activate") {

                await this.doActivate(this.currentDetailId);

            } else if (action === "new-version") {

                const parent =
                    await this.api.getById(this.currentDetailId);

                this.modalTableDetail.hide();

                this.openNewTable(parent);

            }

        } catch (err) {

            UI.error(err.message);

        }

    }

    /*
     * Sección 13 -- probar una versión concreta (no necesariamente
     * ACTIVE) antes de activarla.
     */
    async handleSimulate() {

        if (!this.currentDetailId) {

            return;

        }

        const scale =
            document.getElementById("simulateScale").value;

        const value =
            document.getElementById("simulateValue").value;

        const resultBox =
            document.getElementById("simulateResult");

        try {

            const result =
                await this.api.simulate(this.currentDetailId, { scale, value });

            resultBox.innerHTML =
                `<span class="badge bg-light text-dark border">SG ${result.sg}</span> ` +
                `<span class="badge bg-light text-dark border">Brix ${result.brix}</span> ` +
                `<span class="badge bg-light text-dark border">% Alcohol ${result.alcohol}</span> ` +
                `<span class="text-muted">(${result.method})</span>`;

        } catch (err) {

            resultBox.innerHTML =
                `<span class="text-danger">${err.message}</span>`;

        }

    }

}

document.addEventListener("DOMContentLoaded", () => {

    new HydrometerConversionTablesPage();

});
