const { convertUsingPoints } =
    require("../utils/HydrometerConverter");

const HydrometerConversionTableRepository =
    require("../repositories/HydrometerConversionTableRepository");

// Mismo alcance único de instrumento que
// `HydrometerConversionTableService` (2.8.0.2, secciones 2/3) -- este
// proyecto no soporta todavía múltiples modelos de instrumento.
const DEFAULT_INSTRUMENT = "HYDROMETER_SG_BRIX_ALCOHOL";

/*
 * Entrega 2.8.0.1, sección 13 -- "la tabla del fabricante no debería
 * quedar enterrada en el código del formulario... propongo
 * encapsularla en un servicio: HydrometerConversionService." Envoltorio
 * DELGADO sobre `HydrometerConverter.convertUsingPoints()` (módulo
 * puro): este servicio nunca reimplementa la interpolación, solo
 * resuelve QUÉ tabla usar.
 *
 * Entrega 2.8.0.2, sección 18 -- cambio puramente interno respecto a
 * 2.8.0.1: antes, "qué tabla usar" era siempre la tabla embebida en
 * código (`HydrometerConverter.LEGACY_POINTS`); ahora es la fila ACTIVE
 * de `HydrometerConversionTable` en base de datos (secciones 1, 15) --
 * "el sistema debe usar automáticamente la tabla activa correspondiente
 * al instrumento". El comportamiento visible para el operador (POST
 * /api/hydrometer/convert, el formulario de mediciones) no cambia en
 * absoluto (sección 18: "debe seguir funcionando exactamente igual").
 */
class HydrometerConversionService {

    constructor() {

        this.tableRepository =
            new HydrometerConversionTableRepository();

    }

    /*
     * Sección 15 -- si no existe ninguna tabla ACTIVE todavía para el
     * instrumento (ej. antes de correr el seeder de esta entrega, o si
     * alguna vez se desactivara la única tabla sin activar un
     * reemplazo), la conversión automática no tiene fuente de verdad
     * disponible -- error controlado y explícito, nunca un fallback
     * silencioso a la tabla embebida en código (eso reintroduciría dos
     * fuentes de verdad, justo lo que esta entrega elimina).
     */
    async _requireActiveTable(instrument = DEFAULT_INSTRUMENT) {

        const table =
            await this.tableRepository.findActiveByInstrument(instrument);

        if (!table) {

            throw new Error(

                `No hay ninguna tabla de conversión ACTIVE para el instrumento "${instrument}". Configure y active una tabla en Configuración → Hidrómetros → Tabla de conversión antes de convertir.`

            );

        }

        return table;

    }

    /*
     * Sección 14 -- forma exacta de la respuesta: `{input, result,
     * method}`, más `tableId`/`tableVersion` (nuevos en esta entrega,
     * sección 5: la medición debe poder identificar con qué tabla se
     * calculó -- `ProductionMeasurementService` los usa para poblar
     * `hydrometerConversionTableId`).
     */
    async convert({ scale, value, instrument = DEFAULT_INSTRUMENT } = {}) {

        const table =
            await this._requireActiveTable(instrument);

        const points =
            (table.rows || []).map(row => ({

                sg: Number(row.sg),

                brix: Number(row.brix),

                alcohol: Number(row.alcohol)

            }));

        const converted =
            convertUsingPoints({ points, scale, value });

        return {

            input: {

                scale: typeof scale === "string" ? scale.trim().toUpperCase() : scale,

                value: typeof value === "string" ? Number(value) : value

            },

            result: {

                sg: converted.sg,

                brix: converted.brix,

                alcohol: converted.alcohol

            },

            method: converted.method,

            tableId: table.id,

            tableVersion: table.version

        };

    }

}

module.exports =
    HydrometerConversionService;
