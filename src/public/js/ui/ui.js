class UI {

    static success(message) {

        alert(message);

    }

    static error(message) {

        alert(message);

    }

    static async confirm(message) {

        return confirm(message);

    }

    static loading(show = true) {

        const loader =
            document.getElementById("loader");

        if (!loader)
            return;

        loader.style.display =
            show ? "block" : "none";

    }

}