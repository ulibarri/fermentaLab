const HydrometerAudit =
    require("../utils/HydrometerAudit");

const HydrometerBiasAnalysis =
    require("../utils/HydrometerBiasAnalysis");

const ProductionMeasurementRepository =
    require("../repositories/ProductionMeasurementRepository");

const ProductionBatchRepository =
    require("../repositories/ProductionBatchRepository");

const HydrometerConversionTableRepository =
    require("../repositories/HydrometerConversionTableRepository");

// Entrega 2.8.0.5, sección 12 -- mismo patrón EXACTO que
// `ModelAccuracyMetricsService._parseDate()` (2.6.1.14): una fecha
// "solo fecha" (sin hora) en `to` se trata inclusive hasta el final de
// ESE día, para que un filtro "hasta el 31/07" no pierda mediciones
// registradas esa misma tarde.
const DATE_ONLY_PATTERN =
    /^\d{4}-\d{2}-\d{2}$/;

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

    _parseDate(value, { endOfDay = false } = {}) {

        if (!value) {

            return null;

        }

        const isDateOnly =
            DATE_ONLY_PATTERN.test(value);

        const date =
            new Date(isDateOnly && endOfDay ? `${value}T23:59:59.999Z` : value);

        return Number.isNaN(date.getTime()) ? null : date;

    }

    /*
     * Entrega 2.8.0.5, sección 4/6/7/8/9 -- adapta la forma de
     * `comparisons` (2.8.0.4, un objeto de trazabilidad completa por
     * medición) a la forma más plana que espera
     * `HydrometerBiasAnalysis.buildSummary()` (`error`/`brixReal`
     * directos). Nunca recalcula nada -- `error` es exactamente
     * `comparison.comparison.deltaBrix` ya calculado en 2.8.0.4.
     */
    _toAnalysisEntries(comparisons) {

        return comparisons.map(c => ({

            measurementId: c.measurementId,

            date: c.date,

            phase: c.phase,

            error: c.comparison.deltaBrix,

            brixReal: c.brixMate.value,

            tableId: c.hydrometer.tableId,

            tableVersion: c.hydrometer.tableVersion,

            tableName: c.hydrometer.tableName

        }));

    }

    /*
     * Entrega 2.8.0.5, sección 10 -- `GET /api/hydrometer/audit`.
     * Análisis histórico CROSS-BATCH: bias/mediana/MAE/desviación
     * estándar, distribución de signos, agrupación por rango de Brix/
     * fase/tabla-versión, evolución temporal, y clasificación del
     * sesgo. Reutiliza EXACTAMENTE la misma lógica de comparación de
     * 2.8.0.4 (`HydrometerAudit.evaluateComparability()`/
     * `computeComparison()` vía `buildComparisons()` de arriba) --
     * esta entrega nunca reimplementa ni reinterpreta qué es
     * "comparable", solo agrega estadísticamente lo que 2.8.0.4 ya
     * comparó individualmente. Sección 14 (obligatoria, igual que
     * 2.8.0.4): SOLO LECTURA, nunca escribe ni recalcula un valor
     * original.
     */
    async getHistoricalAnalysis(filters = {}) {

        const { phase, batchId, tableId, tableVersion, from, to } =
            filters;

        const parsedFrom =
            this._parseDate(from);

        const parsedTo =
            this._parseDate(to, { endOfDay: true });

        const measurements =
            await this.measurementRepository.findForAudit({

                phase,

                batchId,

                tableId,

                from: parsedFrom,

                to: parsedTo

            });

        const tableLabelsById =
            await this.resolveTableLabels(measurements);

        const { comparisons, notComparable } =
            this.buildComparisons(measurements, tableLabelsById, {});

        // Sección 9 -- `tableVersion` no es una columna de
        // `ProductionMeasurement` (solo `hydrometerConversionTableId`
        // lo es), así que este filtro se aplica DESPUÉS de resolver la
        // metadata de la tabla (mismo dato que ya se necesitaba para la
        // trazabilidad de cada comparación) -- nunca requiere una
        // segunda consulta.
        const filteredComparisons =
            tableVersion !== undefined && tableVersion !== null && tableVersion !== ""
                ? comparisons.filter(c => c.hydrometer.tableVersion === Number(tableVersion))
                : comparisons;

        const analysis =
            HydrometerBiasAnalysis.buildSummary(

                this._toAnalysisEntries(filteredComparisons),

                {

                    minimumSampleSize: filters.minimumSampleSize,

                    ranges: filters.ranges

                }

            );

        return {

            ...analysis,

            notComparable: {

                count: notComparable.length,

                items: notComparable

            },

            // Sección 10 -- se ecoan los filtros REALMENTE aplicados,
            // mismo criterio de transparencia que `thresholds` en
            // `getAuditForBatch()` (2.8.0.4): el frontend nunca tiene
            // que adivinar qué se filtró.
            filters: {

                phase: phase ?? null,

                batchId: batchId ? Number(batchId) : null,

                tableId: tableId ? Number(tableId) : null,

                tableVersion: tableVersion ? Number(tableVersion) : null,

                from: from ?? null,

                to: to ?? null

            }

        };

    }

}

module.exports =
    HydrometerAuditService;
