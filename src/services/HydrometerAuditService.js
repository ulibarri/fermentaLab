const HydrometerAudit =
    require("../utils/HydrometerAudit");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const HydrometerConversionTableRepository =
    require("../repositories/HydrometerConversionTableRepository");

/*
 * Entrega 2.8.0.4 -- "Auditoría y comparación: mediciones
 * instrumentales vs. valores derivados".
 *
 * Sección 6: "Si un dato puede calcularse de manera determinística a
 * partir de información histórica inmutable, no es necesario
 * almacenarlo nuevamente." Este servicio NO introduce ninguna tabla
 * ni columna nueva -- lee `ProductionMeasurement` (ya inmutable salvo
 * edición explícita del operador, igual que siempre) y calcula la
 * comparación en vivo en cada consulta, vía el módulo puro
 * `HydrometerAudit`.
 *
 * Sección 14 (obligatoria): esta clase es de SOLO LECTURA -- nunca
 * escribe en `ProductionMeasurement`, nunca recalcula un Brix
 * derivado con la tabla activa actual, nunca toca
 * `HydrometerConversionTable`. Solo CONSULTA (`findById`) la tabla
 * histórica referenciada por `hydrometerConversionTableId` para
 * mostrar su nombre/versión -- esa consulta es puramente informativa
 * y nunca dispara una reconversión (ver comentario en
 * `buildComparisons()` más abajo).
 */
class HydrometerAuditService {

    constructor() {

        this.measurementRepository =
            new ProductionMeasurementRepository();

        this.batchRepository =
            new ProductionBatchRepository();

        this.tableRepository =
            new HydrometerConversionTableRepository();

    }

    /*
     * Sección 11 -- resuelve nombre/versión de cada tabla REFERENCIADA
     * por las mediciones del lote, una sola vez por id único (evita
     * N consultas repetidas cuando varias mediciones comparten la
     * misma tabla). Consultar por `tableId` (la fila inmutable de esa
     * versión específica, 2.8.0.2) siempre trae la metadata CON LA
     * QUE se calculó esa medición en su momento -- sin importar si esa
     * tabla sigue ACTIVE, quedó INACTIVE, o incluso si mientras tanto
     * se activó una versión más nueva (sección 11/14: "una medición
     * histórica podría haber sido calculada con una tabla que
     * posteriormente quede inactiva" -- la auditoría histórica nunca
     * debe recalcularse silenciosamente utilizando una tabla nueva).
     */
    async resolveTableLabels(measurements) {

        const tableIds =
            [...new Set(

                measurements

                    .map(measurement => measurement.hydrometerConversionTableId)

                    .filter(tableId => tableId !== null && tableId !== undefined)

            )];

        const labelsByTableId = {};

        for (const tableId of tableIds) {

            const table =
                await this.tableRepository.findById(tableId);

            labelsByTableId[tableId] = table
                ? {

                    name: table.name,

                    version: table.version,

                    manufacturer: table.manufacturer,

                    status: table.status

                }
                : null;

        }

        return labelsByTableId;

    }

    /*
     * Sección 7/10 -- arma la lista de comparaciones y la de mediciones
     * no comparables (sección 12: "simplemente se reporta: No
     * comparable"), a partir de las mediciones YA cargadas del lote.
     */
    buildComparisons(measurements, tableLabelsById, thresholds) {

        const comparisons = [];

        const notComparable = [];

        for (const measurement of measurements) {

            const { comparable, reason } =
                HydrometerAudit.evaluateComparability(measurement);

            if (!comparable) {

                notComparable.push({

                    measurementId: measurement.id,

                    date: measurement.measurementDate,

                    phase: measurement.phase,

                    reason

                });

                continue;

            }

            const comparison =
                HydrometerAudit.computeComparison(

                    measurement.brix,

                    measurement.brixLafmate

                );

            const status =
                HydrometerAudit.classifyStatus(comparison.absoluteError, thresholds);

            const tableInfo =
                tableLabelsById[measurement.hydrometerConversionTableId] || null;

            comparisons.push({

                measurementId: measurement.id,

                date: measurement.measurementDate,

                phase: measurement.phase,

                // Sección 11 -- trazabilidad completa: instrumento
                // (implícito, único hoy), tabla, versión, método.
                hydrometer: {

                    scale: measurement.hydrometerInputScale ?? null,

                    value: measurement.hydrometerInputValue !== null && measurement.hydrometerInputValue !== undefined
                        ? Number(measurement.hydrometerInputValue)
                        : null,

                    derivedBrix: Number(measurement.brix),

                    method: measurement.hydrometerConversionMethod,

                    tableId: measurement.hydrometerConversionTableId,

                    tableVersion: tableInfo ? tableInfo.version : null,

                    tableName: tableInfo ? tableInfo.name : null,

                    // Sección 11 -- el estado ACTUAL de la tabla
                    // (ACTIVE/INACTIVE/...) es solo informativo, para
                    // que la UI pueda explicar por qué una tabla
                    // histórica ya no aparece en el selector de
                    // conversión activo -- nunca se usa para decidir
                    // si esta comparación es válida (sí lo es, siempre).
                    tableStatus: tableInfo ? tableInfo.status : null

                },

                // Sección 9 -- el Brix del Brixómetro/BrixMate es la
                // medición REAL, independiente, nunca derivada.
                brixMate: {

                    value: Number(measurement.brixLafmate)

                },

                comparison: {

                    ...comparison,

                    status

                }

            });

        }

        return { comparisons, notComparable };

    }

    /*
     * Sección 7 -- `GET /api/batches/:id/hydrometer/audit`.
     * `thresholds` es opcional (sección 9: límites configurables,
     * todavía constantes de backend por defecto si no se especifican).
     */
    async getAuditForBatch(batchId, thresholds = {}) {

        const batch =
            await this.batchRepository.findById(batchId);

        if (!batch) {

            throw new Error("Batch not found");

        }

        const measurements =
            await this.measurementRepository.findByBatch(batchId);

        const tableLabelsById =
            await this.resolveTableLabels(measurements);

        const { comparisons, notComparable } =
            this.buildComparisons(measurements, tableLabelsById, thresholds);

        const summary =
            HydrometerAudit.buildSummary(comparisons);

        return {

            batchId: batch.id,

            batchNumber: batch.batchNumber ?? null,

            // Sección 9 -- se devuelven los límites REALMENTE usados
            // para clasificar cada comparación, para que el frontend
            // nunca tenga que conocer ni incrustar estos números por
            // su cuenta (ni siquiera como copia de los defaults).
            thresholds: {

                acceptableAbsoluteError:
                    thresholds.acceptableAbsoluteError ?? HydrometerAudit.DEFAULT_ACCEPTABLE_ABSOLUTE_ERROR,

                warningAbsoluteError:
                    thresholds.warningAbsoluteError ?? HydrometerAudit.DEFAULT_WARNING_ABSOLUTE_ERROR

            },

            summary,

            comparisons,

            // Adición sobre el ejemplo literal del spec (sección 7) --
            // sección 12 exige reportar explícitamente "No comparable"
            // para las mediciones excluidas, así que se listan aparte
            // en vez de simplemente omitirlas sin explicación.
            notComparable: {

                count: notComparable.length,

                items: notComparable

            }

        };

    }

}

module.exports =
    HydrometerAuditService;
