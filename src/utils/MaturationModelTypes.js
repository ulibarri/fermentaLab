/*
 * Catálogo de modelos de maduración disponibles (Entrega 2.6.1.11).
 *
 * Módulo puro (sin Sequelize/Express) con una única responsabilidad:
 * ser la fuente única de verdad de qué `modelType` son válidos para
 * `MaturationModelConfiguration`. La especificación pide explícitamente
 * que "la implementación debe quedar preparada para incorporar otros
 * modelos posteriormente" (sección 1) — agregar un modelo nuevo en el
 * futuro (ej. un ajuste logístico) debe requerir solo agregarlo a este
 * arreglo, no tocar la lógica de activación/validación en ningún otro
 * archivo.
 */

const AVAILABLE_MODEL_TYPES = ["LINEAR", "EXPONENTIAL"];

function isValidModelType(modelType) {

    return AVAILABLE_MODEL_TYPES.includes(modelType);

}

module.exports = {

    AVAILABLE_MODEL_TYPES,

    isValidModelType

};
