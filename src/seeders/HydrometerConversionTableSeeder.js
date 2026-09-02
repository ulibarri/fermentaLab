const BaseSeeder =
    require("./BaseSeeder");

const HydrometerConverter =
    require("../utils/HydrometerConverter");

const HydrometerConversionTableService =
    require("../services/HydrometerConversionTableService");

const DEFAULT_INSTRUMENT = "HYDROMETER_SG_BRIX_ALCOHOL";

/*
 * Entrega 2.8.0.2, sección 18 -- desde esta entrega la conversión de
 * producción depende de que exista una tabla ACTIVE en base de datos
 * (`HydrometerConversionService._requireActiveTable()` ya no cae de
 * vuelta a la tabla embebida en código si no hay ninguna). Este seeder
 * crea esa primera versión a partir del MISMO catálogo que hasta
 * 2.8.0.1 estaba embebido en código (`HydrometerConverter.LEGACY_POINTS`,
 * a su vez leído de `src/data/hydrometerConversion.json`) -- así una
 * base de datos recién migrada queda con el comportamiento de
 * conversión IDÉNTICO al de antes de esta entrega (sección 18: "debe
 * seguir funcionando exactamente igual"), sin depender de que un
 * operador use la pantalla administrativa nueva antes de poder
 * registrar la primera medición automática.
 *
 * Pasa DELIBERADAMENTE por `HydrometerConversionTableService` (crear ->
 * validar -> activar), nunca inserta filas a mano -- así la tabla
 * semilla queda sujeta a las mismas reglas de validación (sección 7-9)
 * que cualquier tabla creada por un operador, y con el mismo rastro de
 * auditoría (sección 14).
 *
 * Idempotente: si ya existe una tabla ACTIVE para el instrumento (ej.
 * el seeder ya corrió antes, o un operador ya activó una tabla propia
 * desde la pantalla administrativa), no hace nada.
 */
class HydrometerConversionTableSeeder extends BaseSeeder {

    async run() {

        const service =
            new HydrometerConversionTableService();

        const existingActive =
            await service.getActiveByInstrument(DEFAULT_INSTRUMENT);

        if (existingActive) {

            console.log(

                "✔ Hydrometer conversion table already ACTIVE, skipped."

            );

            return;

        }

        const rows =
            HydrometerConverter.LEGACY_POINTS.map(point => ({

                sg: point.sg,

                brix: point.brix,

                alcohol: point.alcohol

            }));

        const created =
            await service.create({

                name: "Brewer's Elite -- Tabla de fábrica",

                manufacturer: "Brewer's Elite",

                instrument: DEFAULT_INSTRUMENT,

                source: "Ficha técnica del fabricante (Sp.Gr @60°F / Approx %ABV / Brix @60°F), migrada desde src/data/hydrometerConversion.json (2.6.1.x/2.8.0.1).",

                rows,

                createdBy: "seed",

                changeReason: "Semilla inicial de la entrega 2.8.0.2 -- primera versión formal de la tabla que hasta 2.8.0.1 vivía embebida en código."

            }, this.transaction);

        const validated =
            await service.validate(created.id, { validatedBy: "seed" }, this.transaction);

        if (!validated.valid) {

            throw new Error(

                `La tabla semilla del hidrómetro no pasó su propia validación (esto no debería ocurrir, el catálogo legado ya se usaba en producción desde 2.6.1.x): ${validated.errors.join(" ")}`

            );

        }

        await service.activate(created.id, { activatedBy: "seed" }, this.transaction);

        console.log(

            `✔ Hydrometer conversion table seeded and activated (table #${created.id}, v${created.version}, ${rows.length} rows).`

        );

    }

}

module.exports =
    HydrometerConversionTableSeeder;
