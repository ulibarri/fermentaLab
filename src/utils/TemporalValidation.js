/*
 * Validación cruzada temporal de los modelos de maduración (Entrega
 * 2.6.1.8).
 *
 * Módulo puro (sin Sequelize/Express) que responde una pregunta distinta
 * a la de 2.6.1.7: no "¿qué modelo explica mejor todo el histórico?",
 * sino "¿qué modelo habría funcionado mejor si FermentaLab hubiera
 * tenido que predecir lotes que todavía no existían?".
 *
 * Para eso, dado un conjunto de lotes YA evaluados (mismo criterio de
 * intersección que ModelComparison.js: un lote solo participa si AMBOS
 * modelos —lineal y exponencial— pudieron evaluarse en él, vía
 * MaturationCalculator.evaluateHistorical()) y YA ordenados
 * cronológicamente, este módulo:
 *
 *   1. Divide la secuencia en entrenamiento (primeros lotes) y
 *      validación (últimos lotes), 80/20 por defecto.
 *   2. Calcula MAE/RMSE de cada modelo sobre entrenamiento y MAE/RMSE/
 *      error máximo sobre validación — reutilizando aggregateErrors()
 *      de MaturationStatistics.js (2.6.1.3), no se reimplementa ese
 *      cálculo aquí.
 *   3. Calcula generalizationGapHours = MAE validación - MAE
 *      entrenamiento por modelo, para poder detectar sobreajuste
 *      (sección 5/6 de la especificación).
 *   4. Identifica bestValidationModel: el modelo con menor MAE de
 *      VALIDACIÓN (no de entrenamiento) — es, a propósito, una
 *      comparación simple (el ejemplo de la sección 7 regresa un string
 *      plano, no un veredicto con niveles de confianza como en 2.6.1.7)
 *      con un único resguardo: en empate exacto no se declara ganador.
 *
 * Quién arma el conjunto de lotes evaluables e intersectados (filtrado,
 * agrupación por recipeVersionId, orden cronológico real usando
 * startedAt/createdAt de cada lote) es responsabilidad del servicio que
 * orquesta esto (TemporalValidationService), no de este módulo — aquí
 * solo se ordena por una clave numérica ya provista y se agregan números
 * ya filtrados, siguiendo la misma división de responsabilidades que el
 * resto de los módulos de utils/ en este proyecto.
 */

const {
    aggregateErrors,
    MIN_EVALUATED_BATCHES_FOR_COMPARISON
} = require("./MaturationStatistics");

const DEFAULT_TRAINING_RATIO = 0.8;

// Mínimo de lotes de ENTRENAMIENTO para que valga la pena construir un
// resumen de error sobre ellos — reutiliza el mismo mínimo que ya usa el
// proyecto para "no declarar nada con pocos lotes" (2.6.1.3/2.6.1.7),
// por consistencia de criterio.
const MIN_TRAINING_BATCHES = MIN_EVALUATED_BATCHES_FOR_COMPARISON;

// Mínimo de lotes de VALIDACIÓN. Con menos de 3 lotes, un MAE/RMSE/error
// máximo de "validación" es prácticamente el error de 1-2 lotes
// individuales, no una muestra — reportarlo sería precisamente la
// "falsa sensación de precisión" que la sección 9 de la especificación
// pide evitar explícitamente. Es un umbral provisional (no está
// numerado en la especificación), elegido para que el ejemplo de la
// sección 9 (7 lotes → insuficiente) se cumpla: con 7 lotes y 80/20,
// entrenamiento=5, validación=2 (2 < 3 → insuficiente).
const MIN_VALIDATION_BATCHES = 3;

function round(value, decimals = 2) {

    if (value === null || value === undefined || Number.isNaN(value)) {

        return null;

    }

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

/*
 * Ordena `items` ascendentemente por la clave numérica que regrese
 * `keyFn` para cada uno (ej. epoch millis de una fecha). Los elementos
 * sin clave válida (null/undefined/NaN) se colocan al final, en su
 * orden relativo original, en vez de tratarlos como "más antiguos" o
 * descartarlos — nunca se inventa una fecha. El ordenamiento entre
 * elementos con la misma clave (o ambos sin clave) es estable, por
 * índice original.
 */
function sortByChronologicalKey(items, keyFn) {

    const withKey =
        (items || []).map((item, index) => ({

            item,

            index,

            key: keyFn(item)

        }));

    const hasValidKey = entry =>
        entry.key !== null && entry.key !== undefined && !Number.isNaN(entry.key);

    withKey.sort((a, b) => {

        const aValid = hasValidKey(a);

        const bValid = hasValidKey(b);

        if (aValid && bValid) {

            if (a.key !== b.key) {

                return a.key - b.key;

            }

            return a.index - b.index;

        }

        if (aValid) {

            return -1;

        }

        if (bValid) {

            return 1;

        }

        return a.index - b.index;

    });

    return withKey.map(entry => entry.item);

}

/*
 * Divide una secuencia YA ordenada cronológicamente en entrenamiento
 * (primeros elementos) y validación (últimos), según `trainingRatio`
 * (80% por defecto). El tamaño de entrenamiento se redondea hacia abajo
 * (Math.floor), consistente con el ejemplo de la sección 2 (30 lotes →
 * 24 entrenamiento / 6 validación).
 */
function splitTemporal(sortedItems, trainingRatio = DEFAULT_TRAINING_RATIO) {

    const items =
        sortedItems || [];

    const trainingSize =
        Math.floor(items.length * trainingRatio);

    return {

        training: items.slice(0, trainingSize),

        validation: items.slice(trainingSize),

        trainingSize,

        validationSize: items.length - trainingSize

    };

}

/*
 * MAE validación - MAE entrenamiento, para UN modelo. null si falta
 * cualquiera de los dos (nunca se inventa un gap de datos incompletos).
 */
function computeGeneralizationGap(validationMaeHours, trainingMaeHours) {

    if (

        validationMaeHours === null || validationMaeHours === undefined ||
        trainingMaeHours === null || trainingMaeHours === undefined

    ) {

        return null;

    }

    return round(validationMaeHours - trainingMaeHours);

}

/*
 * Resumen de UN modelo para la validación temporal: MAE/RMSE de
 * entrenamiento, MAE/RMSE/error máximo de validación, y el
 * generalizationGap resultante. Los campos siguen literalmente la forma
 * del ejemplo JSON de la sección 7 (entrenamiento sin error máximo,
 * validación con los tres).
 */
function summarizeModelTemporalValidation(trainingErrors, validationErrors) {

    const trainingAgg =
        aggregateErrors(trainingErrors);

    const validationAgg =
        aggregateErrors(validationErrors);

    return {

        training: {

            maeHours: trainingAgg.maeHours,

            rmseHours: trainingAgg.rmseHours

        },

        validation: {

            maeHours: validationAgg.maeHours,

            rmseHours: validationAgg.rmseHours,

            maxAbsoluteErrorHours: validationAgg.maxErrorHours

        },

        generalizationGapHours: computeGeneralizationGap(validationAgg.maeHours, trainingAgg.maeHours)

    };

}

/*
 * Modelo con menor MAE de VALIDACIÓN (no de entrenamiento — es
 * precisamente el punto de esta entrega: un modelo puede ganar en
 * entrenamiento y perder en validación por sobreajuste). A propósito no
 * se gradúa con niveles de confianza como determineBestModel() de
 * 2.6.1.7: el ejemplo de la sección 7 regresa un string plano, y la
 * protección contra "falsa precisión" aquí ya la da el mínimo de lotes
 * de validación (MIN_VALIDATION_BATCHES) antes de siquiera llegar a
 * este punto. En empate exacto (o si falta algún MAE) no se declara
 * ganador.
 */
function determineBestValidationModel(linearValidationMaeHours, exponentialValidationMaeHours) {

    if (

        linearValidationMaeHours === null || linearValidationMaeHours === undefined ||
        exponentialValidationMaeHours === null || exponentialValidationMaeHours === undefined

    ) {

        return null;

    }

    if (linearValidationMaeHours === exponentialValidationMaeHours) {

        return null;

    }

    return linearValidationMaeHours < exponentialValidationMaeHours ? "LINEAR" : "EXPONENTIAL";

}

/*
 * Punto de entrada principal: dado un conjunto de lotes YA evaluados e
 * intersectados (mismo criterio que ModelComparison.js) y YA ordenados
 * cronológicamente, cada uno con { linearErrorHours, exponentialErrorHours }
 * (los absoluteErrorHours de evaluateHistorical() para ese lote), arma
 * el resultado completo de la Entrega 2.6.1.8.
 *
 * Regresa { sampleSize, trainingSize, validationSize, insufficientData,
 * message, linear, exponential, bestValidationModel }. Cuando
 * insufficientData es true, linear/exponential/bestValidationModel son
 * null — los cálculos descriptivos de entregas anteriores (2.6.1.3-
 * 2.6.1.7) no se ven afectados por esto, siguen funcionando de forma
 * independiente (sección 9 de la especificación).
 */
function buildTemporalValidation(sortedEvaluableBatches, options = {}) {

    const trainingRatio =
        options.trainingRatio ?? DEFAULT_TRAINING_RATIO;

    const minTrainingBatches =
        options.minTrainingBatches ?? MIN_TRAINING_BATCHES;

    const minValidationBatches =
        options.minValidationBatches ?? MIN_VALIDATION_BATCHES;

    const items =
        sortedEvaluableBatches || [];

    const {
        training,
        validation,
        trainingSize,
        validationSize
    } = splitTemporal(items, trainingRatio);

    const base = {

        sampleSize: items.length,

        trainingSize,

        validationSize

    };

    if (trainingSize < minTrainingBatches || validationSize < minValidationBatches) {

        return {

            ...base,

            insufficientData: true,

            message: "Datos insuficientes para validación temporal. Se requieren más lotes históricos.",

            linear: null,

            exponential: null,

            bestValidationModel: null

        };

    }

    const linear =
        summarizeModelTemporalValidation(

            training.map(b => b.linearErrorHours),

            validation.map(b => b.linearErrorHours)

        );

    const exponential =
        summarizeModelTemporalValidation(

            training.map(b => b.exponentialErrorHours),

            validation.map(b => b.exponentialErrorHours)

        );

    const bestValidationModel =
        determineBestValidationModel(linear.validation.maeHours, exponential.validation.maeHours);

    return {

        ...base,

        insufficientData: false,

        message: null,

        linear,

        exponential,

        bestValidationModel

    };

}

module.exports = {

    DEFAULT_TRAINING_RATIO,

    MIN_TRAINING_BATCHES,

    MIN_VALIDATION_BATCHES,

    round,

    sortByChronologicalKey,

    splitTemporal,

    computeGeneralizationGap,

    summarizeModelTemporalValidation,

    determineBestValidationModel,

    buildTemporalValidation

};
