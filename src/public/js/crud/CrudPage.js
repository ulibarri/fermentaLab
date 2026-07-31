class CrudPage {


    constructor(api, form, table, options = {}) {

        this.api = api;
        this.form = form;
        this.table = table;

        this.options = {

            entityName: "Registro",

            deleteMessage: "¿Desea eliminar este registro?",

            createdMessage: "Registro creado.",

            updatedMessage: "Registro actualizado.",

            deletedMessage: "Registro eliminado.",

            ...options

        };

    }

    async load() {

        UI.loading(true);

        try {

            const items =
                await this.api.getAll();


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

    async save(event) {

        event.preventDefault();

        try {

            // const entity =
            //     this.form.read();
            let entity = this.form.read();

            entity = this.beforeSave(entity);

            if (this.form.isEditing()) {

                await this.api.update(
                    this.form.editingId,
                    entity
                );
                this.afterSave(entity);
                // UI.success("Registro actualizado.");
                UI.success(this.options.updatedMessage);

            }
            else {

                await this.api.create(entity);
                this.afterSave(entity);
                // UI.success("Registro creado.");
                UI.success(this.options.createdMessage);

            }

            this.form.close();

            await this.load();

        }

        catch (err) {

            UI.error(err.message);

        }

    }

    async edit(id) {

        try {

            const entity =
                await this.api.get(id);

            this.form.openEdit(entity);

        }

        catch (err) {

            UI.error(err.message);

        }

    }

    async remove(id) {

        // const ok =
        //     await UI.confirm(
        //         "¿Eliminar registro?"
        //     );
        const ok = await UI.confirm(
            this.options.deleteMessage
        );

        if (!ok)
            return;

        try {

            await this.api.delete(id);
            this.afterDelete(id);
            // UI.success(
            //     "Registro eliminado."
            // );
            UI.success(this.options.deletedMessage);

            await this.load();

        }

        catch (err) {

            UI.error(err.message);

        }

    }
    beforeSave(entity) {

        return entity;

    }

    afterSave(entity) {

    }

    beforeDelete(id) {

        return id;

    }

    afterDelete(id) {

    }

}