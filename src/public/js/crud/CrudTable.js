class CrudTable {

    constructor(containerId, columns) {

        this.tbody =
            document.getElementById(containerId);

        this.columns = columns;

    }

    render(data, actions = null) {

        this.tbody.innerHTML = "";

        data.forEach(item => {

            const tr =
                document.createElement("tr");

            this.columns.forEach(column => {

                const td =
                    document.createElement("td");

                let value =
                    item[column.field];

                if (column.formatter) {

                    value =
                        column.formatter(value, item);

                }

                td.innerHTML = value ?? "";

                tr.appendChild(td);

            });

            if (actions) {

                const td =
                    document.createElement("td");

                actions(td, item);

                tr.appendChild(td);

            }

            this.tbody.appendChild(tr);

        });

    }

}