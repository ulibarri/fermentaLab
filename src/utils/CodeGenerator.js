class CodeGenerator {

    /**
     * Genera el siguiente identificador disponible.
     *
     * Ejemplo:
     *  PROD-001
     *  PROD-002
     *  PROD-003
     */
    static next(items, prefix, digits = 3) {

        if (!Array.isArray(items) || items.length === 0) {
            return `${prefix}-001`;
        }

        const numbers = items
            .map(item => {

                if (!item.id)
                    return 0;

                const match = item.id.match(
                    new RegExp(`^${prefix}-(\\d+)$`)
                );

                if (!match)
                    return 0;

                return parseInt(match[1], 10);

            });

        const next = Math.max(...numbers) + 1;

        return `${prefix}-${String(next).padStart(digits, "0")}`;

    }

}

module.exports = CodeGenerator;