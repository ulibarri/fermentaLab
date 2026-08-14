/*
 * Página "Calibraciones de modelos" (Entrega 2.6.1.16, sección 14):
 * gestión completa del ciclo de vida PROPOSED -> APPROVED -> ACTIVE ->
 * INACTIVE (o -> REJECTED desde PROPOSED) de MaturationModelCalibration.
 *
 * Esta pantalla nunca decide reglas de negocio -- solo llama al
 * endpoint correspondiente y recarga la tabla. Toda validación de
 * "¿se puede aprobar/activar/editar esto ahora?" vive en
 * MaturationModelCalibrationService (backend) -- si el backend rechaza
 * una acción, este archivo solo muestra el mensaje de error que ya
 * viene redactado desde ahí (nunca inventa uno nuevo).
 *
 * Puede abrirse con querystring de prefiltro (modelType, offsetHours,
 * sampleSize, biasHours) -- es el enlace "Crear propuesta de
 * calibración" desde el bloque "Calibración y sesgo" de
 * /maturation/statistics (2.6.1.15). Esa página analiza el sesgo a
 * nivel de PRODUCTO (no de una única versión de receta), así que el
 * prefiltro nunca completa recipeVersionId automáticamente -- el
 * usuario siempre debe confirmar a qué versión de receta específica
 * aplica la propuesta (sección 2: nunca mezclar recetas/versiones).
 */

const CALIBRATION_STATUS_BADGES = {

    PROPOSED: "secondary",

    APPROVED: "info",

    ACTIVE: "success",

    INACTIVE: "dark",

    REJECTED: "danger"

};

// Entrega 2.6.1.17 -- badges/íconos para el resultado de una evaluación
// de efectividad (sección 8/13).
const EVALUATION_RESULT_BADGES = {

    IMPROVED: "success",

    DEGRADED: "danger",

    NO_SIGNIFICANT_CHANGE: "secondary",

    INSUFFICIENT_DATA: "secondary"

};

const EVALUATION_RESULT_ICONS = {

    IMPROVED: "✓",

    DEGRADED: "⚠",

    NO_SIGNIFICANT_CHANGE: "–",

    INSUFFICIENT_DATA: "ℹ"

};

// Entrega 2.6.1.18 -- badges/íconos para los cuatro estados de salud
// (sección 5). Mismo mapeo de colores que EVALUATION_RESULT_BADGES
// donde el significado coincide (DEGRADED/INSUFFICIENT_DATA), más
// WARNING (amarillo, intermedio entre HEALTHY y DEGRADED).
const HEALTH_STATUS_BADGES = {

    HEALTHY: "success",

    WARNING: "warning",

    DEGRADED: "danger",

    INSUFFICIENT_DATA: "secondary"

};

const HEALTH_STATUS_ICONS = {

    HEALTHY: "✓",

    WARNING: "⚠",

    DEGRADED: "⚠",

    INSUFFICIENT_DATA: "ℹ"

};

const HEALTH_STATUS_LABELS = {

    HEALTHY: "HEALTHY",

    WARNING: "WARNING",

    DEGRADED: "DEGRADED",

    INSUFFICIENT_DATA: "INSUFFICIENT_DATA"

};

// Entrega 2.6.1.19, sección 10 -- nivel de EVIDENCIA (nunca "confianza
// estadística", el spec es explícito: "Debe mostrarse como: Nivel de
// evidencia: MEDIUM y no como: Confianza estadística: 75%"). Los
// colores son puramente indicativos de volumen de muestra, no de
// certeza.
const EVALUATION_CONFIDENCE_BADGES = {

    LOW: "secondary",

    MEDIUM: "info",

    HIGH: "success"

};

/*
 * Entrega 2.6.1.27, sección 7 -- estado de EVALUACIÓN (independiente
 * del estado de la calibración -- ACTIVE/INACTIVE/... siguen usando
 * CALIBRATION_STATUS_BADGES de arriba, nunca este mapa).
 */
const POST_ACTIVATION_STATUS_BADGES = {

    NOT_ENOUGH_DATA: "secondary",

    EVALUATING: "info",

    EVALUATED: "success"

};

// Sección 5 -- etiqueta descriptiva que acompaña (nunca reemplaza) al
// enum crudo, que es lo que el mockup de la sección 8 muestra
// literalmente ("Estado: EVALUATING").
const POST_ACTIVATION_STATUS_LABELS = {

    NOT_ENOUGH_DATA: "Muestra insuficiente",

    EVALUATING: "Evaluación inicial",

    EVALUATED: "Evaluación significativa"

};

// Sección 9 -- mismos tres resultados del mockup ("✓ MEJORA" / "SIN
// MEJORA" / "RESULTADO INCONCLUSO").
const POST_ACTIVATION_RESULT_BADGES = {

    IMPROVEMENT: "success",

    NO_IMPROVEMENT: "danger",

    INCONCLUSIVE: "secondary"

};

const POST_ACTIVATION_RESULT_LABELS = {

    IMPROVEMENT: "✓ MEJORA",

    NO_IMPROVEMENT: "✗ SIN MEJORA",

    INCONCLUSIVE: "RESULTADO INCONCLUSO"

};

// Entrega 2.6.1.32, sección 3 -- semáforo de efectividad de la
// recalibración. Bootstrap no trae un "bg-orange" de fábrica -- 🟠
// (BAJA EFECTIVIDAD) reutiliza el mismo badge "secondary" que
// "muestra insuficiente", el emoji dentro del texto es lo que sigue
// distinguiendo visualmente los cuatro niveles.
const EFFECTIVENESS_TIER_BADGES = {

    HIGH: "success",

    MODERATE: "warning",

    LOW: "secondary",

    INEFFECTIVE: "danger"

};

class MaturationCalibrationsPage {

    constructor() {

        this.api =
            new MaturationCalibrationsApi();

        this.tableBody =
            document.getElementById("calibrationsTableBody");

        this.form =
            document.getElementById("calibrationForm");

        this.modalElement =
            document.getElementById("modalCalibration");

        this.modal =
            bootstrap.Modal.getOrCreateInstance(this.modalElement);

        const btnNew =
            document.getElementById("btnNuevaCalibracion");

        if (btnNew) {

            btnNew.addEventListener("click", () => this.openNew());

        }

        if (this.form) {

            this.form.addEventListener("submit", e => this.handleSubmit(e));

        }

        if (this.tableBody) {

            this.tableBody.addEventListener("click", e => this.handleTableClick(e));

        }

        // Entrega 2.6.1.17 -- modal de evaluación de efectividad.
        this.evaluationModalElement =
            document.getElementById("modalCalibrationEvaluation");

        this.evaluationModal =
            this.evaluationModalElement
                ? bootstrap.Modal.getOrCreateInstance(this.evaluationModalElement)
                : null;

        this.evaluationCurrentContainer =
            document.getElementById("calibrationEvaluationCurrent");

        this.evaluationHistoryBody =
            document.getElementById("calibrationEvaluationHistoryBody");

        this.currentEvaluationCalibrationId = null;

        this.calibrationsById = new Map();

        const btnSaveEvaluation =
            document.getElementById("btnSaveCalibrationEvaluation");

        if (btnSaveEvaluation) {

            btnSaveEvaluation.addEventListener("click", () => this.handleSaveEvaluation());

        }

        // Entrega 2.6.1.18 -- monitoreo continuo (sección 5/14/16).
        this.healthByCalibrationId = new Map();

        this.healthAlertsContainer =
            document.getElementById("calibrationHealthAlerts");

        this.healthSectionContainer =
            document.getElementById("calibrationHealthSection");

        // Entrega 2.6.1.27 -- evaluación post-activación (secciones 1-9).
        this.postActivationSectionContainer =
            document.getElementById("calibrationPostActivationSection");

        // Entrega 2.6.1.28 -- estado del modelo / degradación (sección
        // 10). Contenido dinámico con botones ("Reconocer"/"Ver
        // análisis") -- se usa delegación de eventos sobre el
        // contenedor, mismo patrón que healthAlertsContainer arriba.
        this.degradationSectionContainer =
            document.getElementById("calibrationDegradationSection");

        if (this.degradationSectionContainer) {

            this.degradationSectionContainer.addEventListener("click", e => this.handleDegradationSectionClick(e));

        }

        // Entrega 2.6.1.32 -- efectividad real de las recalibraciones
        // (sección 10). Quinto bloque independiente del modal de
        // evaluación, mismo criterio de siempre: contenido dinámico con
        // botón "Evaluar"/"Reevaluar" -> delegación de eventos sobre el
        // contenedor.
        this.effectivenessSectionContainer =
            document.getElementById("calibrationEffectivenessSection");

        if (this.effectivenessSectionContainer) {

            this.effectivenessSectionContainer.addEventListener("click", e => this.handleEffectivenessSectionClick(e));

        }

        if (this.healthAlertsContainer) {

            this.healthAlertsContainer.addEventListener("click", e => this.handleHealthAlertClick(e));

        }

        // Entrega 2.6.1.19 -- versionado (sección 11/16) y comparación
        // (sección 8-10).
        this.versionsModalElement =
            document.getElementById("modalCalibrationVersions");

        this.versionsModal =
            this.versionsModalElement
                ? bootstrap.Modal.getOrCreateInstance(this.versionsModalElement)
                : null;

        this.versionsBody =
            document.getElementById("calibrationVersionsBody");

        this.comparisonModalElement =
            document.getElementById("modalCalibrationComparison");

        this.comparisonModal =
            this.comparisonModalElement
                ? bootstrap.Modal.getOrCreateInstance(this.comparisonModalElement)
                : null;

        this.comparisonOtherSelect =
            document.getElementById("calComparisonOtherSelect");

        this.comparisonBody =
            document.getElementById("calibrationComparisonBody");

        this.comparisonAnchorId = null;

        if (this.comparisonOtherSelect) {

            this.comparisonOtherSelect.addEventListener("change", () => this.handleComparisonOtherChange());

        }

    }

    async load() {

        UI.loading(true);

        try {

            // Entrega 2.6.1.18 -- GET /calibrations/health (sección 16)
            // solo cubre las calibraciones ACTIVE ahora mismo, así que
            // se pide en paralelo con la lista completa -- nunca
            // bloquea la tabla si este segundo endpoint fallara por
            // alguna razón (se degrada a "sin datos de salud", nunca
            // rompe la pantalla completa).
            const [calibrations, healthData] = await Promise.all([

                this.api.list(),

                this.api.getAllActiveHealth().catch(() => ({ calibrations: [] }))

            ]);

            this.healthByCalibrationId =
                new Map((healthData.calibrations || []).map(h => [String(h.calibrationId), h]));

            this.render(calibrations);

            this.renderHealthAlerts(healthData.calibrations || []);

        } catch (err) {

            UI.error(err.message);

        } finally {

            UI.loading(false);

        }

    }

    recipeVersionLabel(recipeVersion) {

        if (!recipeVersion) {

            return "—";

        }

        const productPrefix =
            recipeVersion.productName ? `${recipeVersion.productName} / ` : "";

        return `${productPrefix}${recipeVersion.recipeName || "Receta"} (v${recipeVersion.version})`;

    }

    formatOffset(offsetHours) {

        if (offsetHours === null || offsetHours === undefined) {

            return "—";

        }

        const sign =
            offsetHours > 0 ? "+" : "";

        return `${sign}${offsetHours} h`;

    }

    formatBias(biasHours) {

        if (biasHours === null || biasHours === undefined) {

            return "—";

        }

        const sign =
            biasHours > 0 ? "+" : "";

        return `${sign}${biasHours} h`;

    }

    actionsHtml(calibration) {

        const buttons = [];

        if (calibration.status === "PROPOSED") {

            buttons.push(`<button class="btn btn-sm btn-success" data-action="approve" data-id="${calibration.id}">Aprobar</button>`);

            buttons.push(`<button class="btn btn-sm btn-outline-danger" data-action="reject" data-id="${calibration.id}">Rechazar</button>`);

        } else if (calibration.status === "APPROVED") {

            buttons.push(`<button class="btn btn-sm btn-primary" data-action="activate" data-id="${calibration.id}">Activar</button>`);

        } else if (calibration.status === "ACTIVE") {

            buttons.push(`<button class="btn btn-sm btn-outline-secondary" data-action="deactivate" data-id="${calibration.id}">Desactivar</button>`);

        }

        // Entrega 2.6.1.17 -- "Evaluar" solo tiene sentido para
        // calibraciones que en algún momento pudieron haber sido
        // usadas por predicciones reales (ACTIVE ahora, o INACTIVE
        // porque lo fueron antes). PROPOSED/APPROVED/REJECTED nunca
        // aplicaron a ninguna predicción -- evaluar ahí siempre daría
        // INSUFFICIENT_DATA, así que el botón se oculta para no
        // confundir al usuario con una acción vacía.
        if (calibration.status === "ACTIVE" || calibration.status === "INACTIVE") {

            buttons.push(`<button class="btn btn-sm btn-outline-info" data-action="evaluate-open" data-id="${calibration.id}">Evaluar</button>`);

        }

        // Entrega 2.6.1.19, sección 16 -- disponibles para cualquier
        // calibración (toda calibración pertenece a una cadena de
        // versiones, aunque hoy sea la única -- section 5, "una
        // calibración histórica no se elimina", así que la cadena
        // siempre puede consultarse; "Comparar" simplemente no
        // encontrará otra versión que ofrecer si la cadena tiene
        // largo 1).
        buttons.push(`<button class="btn btn-sm btn-outline-dark" data-action="versions-open" data-id="${calibration.id}">Versiones</button>`);

        buttons.push(`<button class="btn btn-sm btn-outline-dark" data-action="compare-open" data-id="${calibration.id}">Comparar</button>`);

        if (buttons.length === 0) {

            return `<span class="text-muted small">Sin acciones</span>`;

        }

        return buttons.join(" ");

    }

    render(calibrations) {

        if (!this.tableBody) {

            return;

        }

        this.calibrationsById =
            new Map((calibrations || []).map(c => [String(c.id), c]));

        if (!calibrations || calibrations.length === 0) {

            this.tableBody.innerHTML = `
                <tr><td colspan="10" class="text-muted">Todavía no hay ninguna calibración registrada.</td></tr>
            `;

            return;

        }

        // Entrega 2.6.1.19, criterio de aceptación explícito -- "la
        // interfaz muestre claramente cuál es la calibración activa":
        // además del badge de estado (ya en verde para ACTIVE desde
        // 2.6.1.16), la fila completa se resalta con `table-success`.
        this.tableBody.innerHTML =
            calibrations.map(c => `
                <tr class="${c.status === "ACTIVE" ? "table-success" : ""}">
                    <td>${c.modelType}</td>
                    <td>${this.recipeVersionLabel(c.recipeVersion)}</td>
                    <td>v${c.version ?? "?"}${c.parentCalibrationId ? ` <span class="text-muted small" title="Reemplaza a la calibración #${c.parentCalibrationId}">(← #${c.parentCalibrationId})</span>` : ""}</td>
                    <td>${this.formatOffset(c.offsetHours)}</td>
                    <td>${c.sampleSize ?? "—"}</td>
                    <td>${this.formatBias(c.biasHours)}</td>
                    <td><span class="badge bg-${CALIBRATION_STATUS_BADGES[c.status] || "secondary"}">${c.status}</span></td>
                    <td>${this.healthBadgeHtml(c)}</td>
                    <td class="small text-muted">${c.reason || "—"}</td>
                    <td>${this.actionsHtml(c)}</td>
                </tr>
            `).join("");

    }

    /*
     * Entrega 2.6.1.18 -- indicador de salud por fila (sección 5/16).
     * Solo las calibraciones ACTIVE aparecen en GET /calibrations/health
     * (son las únicas que de verdad afectan predicciones nuevas ahora
     * mismo) -- cualquier otro estado muestra "—" en vez de fabricar un
     * dato que el backend nunca calculó para ese caso.
     */
    healthBadgeHtml(calibration) {

        if (calibration.status !== "ACTIVE") {

            return `<span class="text-muted small">—</span>`;

        }

        const health =
            this.healthByCalibrationId.get(String(calibration.id));

        if (!health) {

            return `<span class="text-muted small">Sin datos</span>`;

        }

        const badgeClass =
            HEALTH_STATUS_BADGES[health.health] || "secondary";

        const icon =
            HEALTH_STATUS_ICONS[health.health] || "";

        return `<span class="badge bg-${badgeClass}" title="Ventana reciente: N=${health.recentSampleSize ?? "—"}">${icon} ${HEALTH_STATUS_LABELS[health.health] || health.health}</span>`;

    }

    /*
     * Entrega 2.6.1.18, sección 14 -- tarjetas de alerta para
     * calibraciones ACTIVE cuya salud es DEGRADED. Nunca desactiva la
     * calibración ni crea una propuesta nueva por sí sola (sección 15:
     * "el sistema NUNCA debe crear automáticamente una nueva
     * calibración") -- solo ofrece los dos atajos del mockup:
     * [Analizar] (abre el modal de evaluación/salud existente) y
     * [Crear nueva propuesta] (abre el formulario de siempre,
     * prellenado).
     */
    renderHealthAlerts(healthList) {

        if (!this.healthAlertsContainer) {

            return;

        }

        const degraded =
            (healthList || []).filter(h => h.health === "DEGRADED");

        if (degraded.length === 0) {

            this.healthAlertsContainer.innerHTML = "";

            return;

        }

        this.healthAlertsContainer.innerHTML =
            degraded.map(h => {

                const row =
                    this.calibrationsById.get(String(h.calibrationId));

                const label =
                    row ? this.recipeVersionLabel(row.recipeVersion) : `Receta v. #${h.recipeVersionId}`;

                return `
                    <div class="alert alert-danger d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <strong>⚠ Calibration #${h.calibrationId} (${h.modelType} / ${label})</strong>
                            <div class="small">Desempeño degradado en la ventana reciente (N=${h.recentSampleSize ?? "—"}, MAE ${h.recentMaeHours ?? "—"} h).${h.recommendRecalibration ? " Se recomienda revisar y, si corresponde, proponer una recalibración." : ""}</div>
                        </div>
                        <div class="text-nowrap ms-3">
                            <button class="btn btn-sm btn-outline-dark" data-action="health-analyze" data-id="${h.calibrationId}">Analizar</button>
                            <button class="btn btn-sm btn-dark" data-action="health-new-proposal" data-id="${h.calibrationId}" data-model-type="${h.modelType}" data-recipe-version-id="${h.recipeVersionId}">Crear nueva propuesta</button>
                        </div>
                    </div>
                `;

            }).join("");

    }

    async handleHealthAlertClick(e) {

        const button =
            e.target.closest("button[data-action]");

        if (!button) {

            return;

        }

        const action =
            button.dataset.action;

        const id =
            button.dataset.id;

        if (action === "health-analyze") {

            this.openEvaluation(id);

            return;

        }

        if (action === "health-new-proposal") {

            // Entrega 2.6.1.19, sección 6 -- "Crear nueva calibración"
            // desde una alerta DEGRADED ahora es un REEMPLAZO real
            // (create-replacement), no un formulario en blanco: hereda
            // modelType/recipeVersionId/parentCalibrationId del padre
            // (sección 2/14), y modelType/recipeVersionId quedan
            // bloqueados en el formulario -- a diferencia del enlace
            // desde /maturation/statistics (2.6.1.15, sesgo a nivel de
            // PRODUCTO, siempre ambiguo), aquí la alerta ya está
            // acotada a una calibración específica sin ambigüedad. El
            // offset actual del padre se usa como punto de partida --
            // el usuario SIEMPRE puede y debe ajustarlo (criterio de
            // aceptación explícito: "el usuario pueda modificar el
            // nuevo offsetHours").
            const parentRow =
                this.calibrationsById.get(String(id));

            this.openNew({

                parentCalibrationId: id,

                modelType: button.dataset.modelType,

                recipeVersionId: button.dataset.recipeVersionId,

                offsetHours: parentRow ? parentRow.offsetHours : undefined,

                reason: `Propuesta de recalibración: la calibración #${id} fue marcada DEGRADED por el monitoreo continuo (ventana reciente con desempeño peor al esperado). Punto de partida: el offset anterior (${parentRow ? this.formatOffset(parentRow.offsetHours) : "—"}) -- ajústalo con datos recientes antes de guardar.`

            });

        }

    }

    openNew(prefill = {}) {

        this.form.reset();

        // Entrega 2.6.1.19, sección 6/14 -- modo "reemplazo": el
        // modelType/recipeVersionId quedan bloqueados (se heredan del
        // padre, sección 2) y `parentCalibrationId` viaja oculto en el
        // form hasta el submit.
        const isReplacement =
            prefill.parentCalibrationId !== undefined && prefill.parentCalibrationId !== null;

        if (this.form.parentCalibrationId) {

            this.form.parentCalibrationId.value = isReplacement ? prefill.parentCalibrationId : "";

        }

        if (this.form.modelType) {

            this.form.modelType.disabled = isReplacement;

        }

        if (this.form.recipeVersionId) {

            this.form.recipeVersionId.disabled = isReplacement;

        }

        const notice =
            document.getElementById("calReplacementNotice");

        if (notice) {

            if (isReplacement) {

                notice.style.display = "";

                notice.textContent =
                    `Esta propuesta es un reemplazo de la calibración #${prefill.parentCalibrationId} -- hereda el mismo modelo y versión de receta (sección 2: nunca se sobrescribe una calibración existente, se crea una versión nueva).`;

            } else {

                notice.style.display = "none";

            }

        }

        if (prefill.modelType) {

            this.form.modelType.value = prefill.modelType;

        }

        // Entrega 2.6.1.18 -- a diferencia del prellenado histórico
        // (2.6.1.15, desde un análisis a nivel de producto donde
        // recipeVersionId siempre queda ambiguo), la alerta de salud
        // DEGRADED (sección 14) ya conoce la versión de receta exacta
        // -- si la opción existe en el <select>, se prellena.
        if (prefill.recipeVersionId !== undefined && prefill.recipeVersionId !== null && this.form.recipeVersionId) {

            const optionExists =
                Array.from(this.form.recipeVersionId.options).some(o => String(o.value) === String(prefill.recipeVersionId));

            if (optionExists) {

                this.form.recipeVersionId.value = prefill.recipeVersionId;

            }

        }

        if (prefill.offsetHours !== undefined && prefill.offsetHours !== null) {

            this.form.offsetHours.value = prefill.offsetHours;

        }

        if (prefill.sampleSize !== undefined && prefill.sampleSize !== null) {

            this.form.sampleSize.value = prefill.sampleSize;

        }

        if (prefill.biasHours !== undefined && prefill.biasHours !== null) {

            this.form.biasHours.value = prefill.biasHours;

        }

        if (prefill.reason) {

            this.form.reason.value = prefill.reason;

        } else if (prefill.offsetHours !== undefined && prefill.offsetHours !== null) {

            this.form.reason.value =
                `Basado en el análisis de sesgo (Bias observado: ${this.formatBias(prefill.biasHours ?? prefill.offsetHours)}, N=${prefill.sampleSize ?? "?"}). Selecciona la versión de receta exacta a la que aplica esta calibración.`;

        }

        this.modal.show();

    }

    async handleSubmit(e) {

        e.preventDefault();

        const parentCalibrationId =
            this.form.parentCalibrationId && this.form.parentCalibrationId.value
                ? this.form.parentCalibrationId.value
                : null;

        const sharedFields = {

            offsetHours: Number(this.form.offsetHours.value),

            sampleSize: this.form.sampleSize.value !== "" ? Number(this.form.sampleSize.value) : null,

            biasHours: this.form.biasHours.value !== "" ? Number(this.form.biasHours.value) : null,

            reason: this.form.reason.value || null

        };

        try {

            if (parentCalibrationId) {

                // Entrega 2.6.1.19 -- modo reemplazo: el backend deriva
                // modelType/recipeVersionId/parentCalibrationId de la
                // calibración padre (sección 2/14), nunca se envían
                // aquí -- solo los valores propios de la versión nueva.
                await this.api.createReplacement(parentCalibrationId, sharedFields);

            } else {

                await this.api.create({

                    modelType: this.form.modelType.value,

                    recipeVersionId: Number(this.form.recipeVersionId.value),

                    ...sharedFields

                });

            }

            this.modal.hide();

            await this.load();

            UI.success(parentCalibrationId ? "Nueva versión de calibración creada." : "Propuesta de calibración creada.");

        } catch (err) {

            UI.error(err.message);

        }

    }

    async handleTableClick(e) {

        const button =
            e.target.closest("button[data-action]");

        if (!button) {

            return;

        }

        const action =
            button.dataset.action;

        const id =
            button.dataset.id;

        // Entrega 2.6.1.17 -- "Evaluar" abre un modal de solo lectura,
        // no llama directamente a un método de MaturationCalibrationsApi
        // como las demás acciones (que sí son transiciones de estado).
        if (action === "evaluate-open") {

            this.openEvaluation(id);

            return;

        }

        // Entrega 2.6.1.19 -- "Versiones"/"Comparar" también son
        // solo-lectura, nunca transiciones de estado.
        if (action === "versions-open") {

            this.openVersions(id);

            return;

        }

        if (action === "compare-open") {

            this.openComparison(id);

            return;

        }

        const confirmations = {

            approve: "¿Aprobar esta calibración?",

            reject: "¿Rechazar esta calibración?",

            activate: "¿Activar esta calibración? Las predicciones NUEVAS de este modelo/receta empezarán a usar este offset. Las predicciones ya generadas no cambiarán.",

            deactivate: "¿Desactivar esta calibración? Las predicciones nuevas dejarán de aplicar este offset."

        };

        if (confirmations[action] && !(await UI.confirm(confirmations[action]))) {

            return;

        }

        try {

            await this.api[action](id);

            await this.load();

        } catch (err) {

            UI.error(err.message);

        }

    }

    formatDate(value) {

        if (!value) {

            return "—";

        }

        return new Date(value).toLocaleString();

    }

    // Entrega 2.6.1.27 -- mismo helper ya establecido en measurements.js.
    formatValue(value) {

        return (value === null || value === undefined || value === "")
            ? "—"
            : value;

    }

    resultLabel(result) {

        const labels = {

            IMPROVED: "IMPROVED",

            DEGRADED: "DEGRADED",

            NO_SIGNIFICANT_CHANGE: "NO_SIGNIFICANT_CHANGE",

            INSUFFICIENT_DATA: "INSUFFICIENT_DATA"

        };

        return labels[result] || result || "—";

    }

    /*
     * Entrega 2.6.1.17 -- tarjeta "Original vs. Calibrado" (mockup de
     * la sección 13). `evaluation` es la respuesta EN VIVO de
     * GET .../evaluation (nunca se recalcula nada aquí, solo se
     * presenta). `calibrationRow` es la fila ya cargada en la tabla
     * principal (para mostrar el offset y decidir si corresponde la
     * advertencia de la sección 12).
     */
    buildEvaluationCardHtml(evaluation, calibrationRow) {

        const badgeClass =
            EVALUATION_RESULT_BADGES[evaluation.result] || "secondary";

        const icon =
            EVALUATION_RESULT_ICONS[evaluation.result] || "";

        const header = `
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <p class="fw-bold mb-0">Calibration #${evaluation.calibrationId}</p>
                    <p class="text-muted small mb-0">${evaluation.modelType} / ${calibrationRow ? this.recipeVersionLabel(calibrationRow.recipeVersion) : `Receta v. #${evaluation.recipeVersionId}`}</p>
                </div>
                <span class="badge bg-${badgeClass}">${icon} ${this.resultLabel(evaluation.result)}</span>
            </div>
        `;

        const meta = `
            <p class="small mb-3">
                <strong>Offset:</strong> ${calibrationRow ? this.formatOffset(calibrationRow.offsetHours) : "—"}
                &nbsp;|&nbsp;
                <strong>Evaluaciones:</strong> ${evaluation.evaluationSampleSize}
            </p>
        `;

        if (evaluation.result === "INSUFFICIENT_DATA" || !evaluation.raw || !evaluation.calibrated) {

            return `
                <div class="border rounded p-3">
                    ${header}
                    ${meta}
                    <p class="text-muted small mb-0">Todavía no hay predicciones post-activación con maduración real registrada para evaluar esta calibración. Nunca se reutilizan los lotes usados para construir la propuesta original.</p>
                </div>
            `;

        }

        const degradedWarning =
            evaluation.result === "DEGRADED" && calibrationRow && calibrationRow.status === "ACTIVE"
                ? `<div class="alert alert-danger small py-2 px-3 mt-2 mb-0">⚠ La calibración actualmente activa está produciendo un desempeño inferior al modelo sin calibración.</div>`
                : "";

        return `
            <div class="border rounded p-3">
                ${header}
                ${meta}
                <table class="table table-sm mb-2">
                    <thead>
                        <tr><th></th><th class="text-end">Original</th><th class="text-end">Calibrado</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>MAE</td><td class="text-end">${evaluation.raw.maeHours} h</td><td class="text-end">${evaluation.calibrated.maeHours} h</td></tr>
                        <tr><td>RMSE</td><td class="text-end">${evaluation.raw.rmseHours} h</td><td class="text-end">${evaluation.calibrated.rmseHours} h</td></tr>
                        <tr><td>Bias</td><td class="text-end">${this.formatBias(evaluation.raw.biasHours)}</td><td class="text-end">${this.formatBias(evaluation.calibrated.biasHours)}</td></tr>
                        <tr><td>EARLY / LATE / EXACT</td><td class="text-end small">${evaluation.raw.earlyPercentage}% / ${evaluation.raw.latePercentage}% / ${evaluation.raw.exactPercentage}%</td><td class="text-end small">${evaluation.calibrated.earlyPercentage}% / ${evaluation.calibrated.latePercentage}% / ${evaluation.calibrated.exactPercentage}%</td></tr>
                    </tbody>
                </table>
                <p class="mb-0"><strong>Mejora MAE:</strong> ${evaluation.maeImprovementPercentage}% (${evaluation.maeImprovementHours} h)</p>
                ${degradedWarning}
            </div>
        `;

    }

    renderEvaluationHistory(history) {

        if (!this.evaluationHistoryBody) {

            return;

        }

        if (!history || history.length === 0) {

            this.evaluationHistoryBody.innerHTML =
                `<tr><td colspan="6" class="text-muted">Todavía no se ha guardado ninguna evaluación para esta calibración.</td></tr>`;

            return;

        }

        this.evaluationHistoryBody.innerHTML =
            history.map(h => `
                <tr>
                    <td>${this.formatDate(h.createdAt)}</td>
                    <td>${h.sampleSize}</td>
                    <td>${h.raw.maeHours !== null ? h.raw.maeHours + " h" : "—"}</td>
                    <td>${h.calibrated.maeHours !== null ? h.calibrated.maeHours + " h" : "—"}</td>
                    <td>${h.maeImprovementPercentage !== null ? h.maeImprovementPercentage + "%" : "—"}</td>
                    <td><span class="badge bg-${EVALUATION_RESULT_BADGES[h.result] || "secondary"}">${this.resultLabel(h.result)}</span></td>
                </tr>
            `).join("");

    }

    async openEvaluation(id) {

        if (!this.evaluationModal) {

            return;

        }

        this.currentEvaluationCalibrationId = id;

        if (this.evaluationCurrentContainer) {

            this.evaluationCurrentContainer.innerHTML = `<p class="text-muted mb-0">Cargando...</p>`;

        }

        if (this.evaluationHistoryBody) {

            this.evaluationHistoryBody.innerHTML = "";

        }

        if (this.healthSectionContainer) {

            this.healthSectionContainer.innerHTML = `<p class="text-muted mb-0">Cargando...</p>`;

        }

        if (this.postActivationSectionContainer) {

            this.postActivationSectionContainer.innerHTML = `<p class="text-muted mb-0">Cargando...</p>`;

        }

        if (this.degradationSectionContainer) {

            this.degradationSectionContainer.innerHTML = `<p class="text-muted mb-0">Cargando...</p>`;

        }

        if (this.effectivenessSectionContainer) {

            this.effectivenessSectionContainer.innerHTML = `<p class="text-muted mb-0">Cargando...</p>`;

        }

        this.evaluationModal.show();

        try {

            const [evaluation, history] = await Promise.all([

                this.api.getEvaluation(id),

                this.api.getEvaluationHistory(id)

            ]);

            const calibrationRow =
                this.calibrationsById.get(String(id));

            if (this.evaluationCurrentContainer) {

                this.evaluationCurrentContainer.innerHTML =
                    this.buildEvaluationCardHtml(evaluation, calibrationRow);

            }

            this.renderEvaluationHistory(history);

        } catch (err) {

            if (this.evaluationCurrentContainer) {

                this.evaluationCurrentContainer.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener la evaluación: ${err.message}</p>`;

            }

        }

        // Entrega 2.6.1.18 -- carga la salud EN VIVO por separado: es un
        // segundo endpoint independiente (sección 16) y su falla nunca
        // debe impedir ver la evaluación de 2.6.1.17 de arriba (ni
        // viceversa).
        try {

            const health =
                await this.api.getHealth(id);

            if (this.healthSectionContainer) {

                this.healthSectionContainer.innerHTML =
                    this.buildHealthCardHtml(health);

            }

        } catch (err) {

            if (this.healthSectionContainer) {

                this.healthSectionContainer.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener el estado de salud: ${err.message}</p>`;

            }

        }

        // Entrega 2.6.1.27 -- carga la evaluación post-activación en
        // paralelo, como un tercer bloque totalmente independiente
        // (mismo criterio que la salud de arriba, 2.6.1.18): su falla
        // nunca debe impedir ver la evaluación de 2.6.1.17 ni la salud
        // de 2.6.1.18, ni viceversa.
        try {

            const postActivation =
                await this.api.getPostActivationEvaluation(id);

            if (this.postActivationSectionContainer) {

                this.postActivationSectionContainer.innerHTML =
                    this.buildPostActivationEvaluationHtml(postActivation);

            }

        } catch (err) {

            if (this.postActivationSectionContainer) {

                this.postActivationSectionContainer.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener la evaluación post-activación: ${err.message}</p>`;

            }

        }

        // Entrega 2.6.1.28 -- estado del modelo / degradación, cuarto
        // bloque independiente (mismo criterio que los tres de arriba):
        // su falla nunca debe impedir ver ninguno de los otros tres, ni
        // viceversa.
        try {

            const degradation =
                await this.api.getDegradationStatus(id);

            if (this.degradationSectionContainer) {

                this.degradationSectionContainer.innerHTML =
                    this.buildDegradationSectionHtml(degradation);

            }

        } catch (err) {

            if (this.degradationSectionContainer) {

                this.degradationSectionContainer.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener el estado de degradación: ${err.message}</p>`;

            }

        }

        // Entrega 2.6.1.32 -- efectividad real de la recalibración,
        // quinto bloque independiente (mismo criterio que los cuatro de
        // arriba): su falla nunca debe impedir ver ninguno de los
        // otros, ni viceversa. EN VIVO -- siempre refleja la evidencia
        // post-activación más fresca (ver el comentario de
        // RecalibrationEffectivenessService).
        try {

            const effectiveness =
                await this.api.getEffectiveness(id);

            if (this.effectivenessSectionContainer) {

                this.effectivenessSectionContainer.innerHTML =
                    this.buildEffectivenessSectionHtml(effectiveness);

            }

        } catch (err) {

            if (this.effectivenessSectionContainer) {

                this.effectivenessSectionContainer.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener la efectividad de recalibración: ${err.message}</p>`;

            }

        }

    }

    /*
     * Entrega 2.6.1.18 -- tarjeta de análisis de salud (sección 12):
     * histórico (desde activación) vs. ventana reciente vs. ventana
     * inmediatamente anterior, tendencia y recomendación de
     * recalibración. `health` es la respuesta EN VIVO de
     * GET .../health -- nunca se recalcula nada aquí.
     */
    buildHealthCardHtml(health) {

        const badgeClass =
            HEALTH_STATUS_BADGES[health.health] || "secondary";

        const icon =
            HEALTH_STATUS_ICONS[health.health] || "";

        const header = `
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <p class="text-muted small mb-0">Ventana reciente: N=${health.recent.sampleSize ?? "—"} · Tendencia vs. ventana anterior:
                        ${health.trend ? `<strong>${health.trend}</strong>` : `<span class="text-muted">sin datos suficientes</span>`}
                    </p>
                </div>
                <span class="badge bg-${badgeClass}">${icon} ${HEALTH_STATUS_LABELS[health.health] || health.health}</span>
            </div>
        `;

        if (health.health === "INSUFFICIENT_DATA") {

            return `
                <div class="border rounded p-3">
                    ${header}
                    <p class="text-muted small mb-0">Todavía no hay al menos 5 predicciones recientes evaluables (con maduración real registrada) para esta calibración -- no se declara salud a partir de una muestra tan pequeña.</p>
                </div>
            `;

        }

        const recommendationHtml =
            health.recommendRecalibration
                ? `<div class="alert alert-warning small py-2 px-3 mt-2 mb-0">⚠ Se recomienda revisar esta calibración y, si corresponde, proponer una nueva -- el sistema nunca la desactiva ni crea una propuesta automáticamente.</div>`
                : "";

        return `
            <div class="border rounded p-3">
                ${header}
                <table class="table table-sm mb-2">
                    <thead>
                        <tr><th></th><th class="text-end">Histórico</th><th class="text-end">Ventana anterior</th><th class="text-end">Ventana reciente</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>N</td><td class="text-end">${health.historical.sampleSize ?? "—"}</td><td class="text-end">${health.previousWindow.sampleSize ?? "—"}</td><td class="text-end">${health.recent.sampleSize ?? "—"}</td></tr>
                        <tr><td>MAE</td><td class="text-end">${health.historical.maeHours ?? "—"} h</td><td class="text-end">${health.previousWindow.maeHours !== null ? health.previousWindow.maeHours + " h" : "—"}</td><td class="text-end">${health.recent.maeHours ?? "—"} h</td></tr>
                        <tr><td>Bias</td><td class="text-end">${this.formatBias(health.historical.biasHours)}</td><td class="text-end">${health.previousWindow.biasHours !== null ? this.formatBias(health.previousWindow.biasHours) : "—"}</td><td class="text-end">${this.formatBias(health.recent.biasHours)}</td></tr>
                    </tbody>
                </table>
                <p class="mb-0"><strong>Cambio del MAE (histórico → reciente):</strong> ${health.maeChangePercentage !== null ? (health.maeChangePercentage > 0 ? "+" : "") + health.maeChangePercentage + "%" : "sin datos suficientes"}</p>
                ${recommendationHtml}
            </div>
        `;

    }

    /*
     * Entrega 2.6.1.27 -- tarjeta de evaluación post-activación
     * (secciones 1-9). `evaluation` es la respuesta EN VIVO de
     * GET .../post-activation-evaluation -- nunca se recalcula nada
     * aquí, solo se presenta. Tres bloques, en el mismo orden que la
     * especificación los introduce:
     *   1. Estado + muestra + periodo (secciones 4/5/7).
     *   2. Métricas ACTUAL (post-activación real) + comparación contra
     *      la SIMULACIÓN preactivación, si existe (sección 1/2).
     *   3. Comparación contra la calibración ANTERIOR (real vs. real,
     *      sección 6/8) + resultado MEJORA/SIN MEJORA/INCONCLUSO
     *      (sección 9), más un enlace de trazabilidad hasta la
     *      propuesta/alerta origen (sección 11) -- reutiliza la página
     *      de propuestas ya existente (2.6.1.24/25), no se construye
     *      una vista nueva.
     */
    buildPostActivationEvaluationHtml(evaluation) {

        const statusBadge =
            `<span class="badge bg-${POST_ACTIVATION_STATUS_BADGES[evaluation.evaluationStatus] || "secondary"}">${evaluation.evaluationStatus}</span>`;

        const statusLine = `
            <ul class="list-unstyled small mb-3">
                <li><strong>Estado de evaluación:</strong> ${statusBadge} <span class="text-muted">(${POST_ACTIVATION_STATUS_LABELS[evaluation.evaluationStatus] || evaluation.evaluationStatus})</span></li>
                <li><strong>Estado de la calibración:</strong> <span class="badge bg-${CALIBRATION_STATUS_BADGES[evaluation.status] || "secondary"}">${evaluation.status}</span> <span class="text-muted small">(distinto del estado de evaluación -- sección 7)</span></li>
                <li><strong>Predicciones evaluables:</strong> ${evaluation.actual.sampleSize}</li>
                <li><strong>Periodo:</strong> ${evaluation.period.from ? this.formatDate(evaluation.period.from) : "—"} → ${evaluation.period.to ? this.formatDate(evaluation.period.to) : "—"}</li>
            </ul>
        `;

        if (evaluation.evaluationStatus === "NOT_ENOUGH_DATA") {

            return `
                <div class="border rounded p-3">
                    ${statusLine}
                    <p class="text-muted small mb-0">Todavía no hay al menos ${5} predicciones evaluables (con maduración real registrada) generadas usando esta calibración -- no se declara ninguna evaluación post-activación a partir de una muestra tan pequeña (sección 5).</p>
                </div>
            `;

        }

        const metricsTable = `
            <table class="table table-sm mb-2">
                <thead>
                    <tr><th></th><th class="text-end">MAE</th><th class="text-end">RMSE</th><th class="text-end">Bias</th><th class="text-end">Error mín.</th><th class="text-end">Error máx.</th><th class="text-end">Desv. error</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Real (post-activación)</td>
                        <td class="text-end">${this.formatValue(evaluation.actual.maeHours)} h</td>
                        <td class="text-end">${this.formatValue(evaluation.actual.rmseHours)} h</td>
                        <td class="text-end">${this.formatBias(evaluation.actual.biasHours)}</td>
                        <td class="text-end">${this.formatValue(evaluation.actual.minAbsoluteErrorHours)} h</td>
                        <td class="text-end">${this.formatValue(evaluation.actual.maxAbsoluteErrorHours)} h</td>
                        <td class="text-end">${this.formatValue(evaluation.actual.errorStdDevHours)} h</td>
                    </tr>
                </tbody>
            </table>
        `;

        // Sección 1 -- SIMULATED (preactivación) vs. ACTUAL (real,
        // post-activación). Solo existe cuando esta calibración
        // reemplazó a otra (tiene padre) -- una primera versión nunca
        // fue simulada.
        const simulationCard =
            evaluation.simulatedPreActivation
                ? `
                    <p class="fw-bold mb-1 mt-3">Simulación (preactivación) vs. real (post-activación)</p>
                    <table class="table table-sm mb-2">
                        <thead>
                            <tr><th></th><th class="text-end">Simulación</th><th class="text-end">Real</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>MAE</td><td class="text-end">${this.formatValue(evaluation.simulatedPreActivation.maeHours)} h</td><td class="text-end">${this.formatValue(evaluation.actual.maeHours)} h</td></tr>
                            <tr><td>RMSE</td><td class="text-end">${this.formatValue(evaluation.simulatedPreActivation.rmseHours)} h</td><td class="text-end">${this.formatValue(evaluation.actual.rmseHours)} h</td></tr>
                            <tr><td>Bias</td><td class="text-end">${this.formatBias(evaluation.simulatedPreActivation.biasHours)}</td><td class="text-end">${this.formatBias(evaluation.actual.biasHours)}</td></tr>
                            <tr><td>Muestras</td><td class="text-end">${evaluation.simulatedPreActivation.sampleSize}</td><td class="text-end">${evaluation.actual.sampleSize}</td></tr>
                        </tbody>
                    </table>
                    <p class="text-muted small mb-0">La simulación se calculó ANTES de activar esta calibración, sobre las predicciones crudas de la calibración anterior (#${evaluation.parentCalibrationId}). Si los números difieren bastante, la simulación no predijo bien el desempeño real en producción.</p>
                `
                : `<p class="text-muted small mt-3 mb-0">Esta calibración es la primera versión de su cadena -- no existe una simulación preactivación con la que comparar (sección 1).</p>`;

        // Secciones 6/8/9/11 -- comparación real vs. real contra la
        // calibración ANTERIOR, más el resultado y el enlace de
        // trazabilidad hasta la propuesta/alerta origen.
        const previousCard =
            evaluation.previousCalibration
                ? `
                    <p class="fw-bold mb-1 mt-3">Comparación contra la calibración anterior (real vs. real)</p>
                    <table class="table table-sm mb-2">
                        <thead>
                            <tr><th></th><th class="text-end">Anterior (v${evaluation.previousCalibration.version})</th><th class="text-end">Actual (v${evaluation.version})</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>MAE</td><td class="text-end">${this.formatValue(evaluation.previousCalibration.actual.maeHours)} h</td><td class="text-end">${this.formatValue(evaluation.actual.maeHours)} h</td></tr>
                            <tr><td>RMSE</td><td class="text-end">${this.formatValue(evaluation.previousCalibration.actual.rmseHours)} h</td><td class="text-end">${this.formatValue(evaluation.actual.rmseHours)} h</td></tr>
                            <tr><td>Bias</td><td class="text-end">${this.formatBias(evaluation.previousCalibration.actual.biasHours)}</td><td class="text-end">${this.formatBias(evaluation.actual.biasHours)}</td></tr>
                            <tr><td>Muestras</td><td class="text-end">${evaluation.previousCalibration.actual.sampleSize}</td><td class="text-end">${evaluation.actual.sampleSize}</td></tr>
                        </tbody>
                    </table>
                    ${this.postActivationResultHtml(evaluation.comparisonVsPrevious)}
                    <p class="mt-2 mb-0"><a href="/maturation/recalibration-proposals?openId=${evaluation.calibrationId}" target="_blank" rel="noopener">Ver propuesta y alerta origen de esta calibración →</a></p>
                `
                : `<p class="text-muted small mt-3 mb-0">Esta calibración no tiene una calibración anterior con la que compararse (es la primera versión de su cadena).</p>`;

        return `
            <div class="border rounded p-3">
                ${statusLine}
                ${metricsTable}
                ${simulationCard}
                ${previousCard}
            </div>
        `;

    }

    /*
     * Sección 9 -- tarjeta de resultado. `comparison` es
     * `{result, reason, metrics}` de
     * PostActivationEvaluation.classifyPostActivationResult() (backend).
     * `result === null` significa "todavía no se puede declarar nada"
     * (razón en `reason`) -- nunca se fabrica un MEJORA/SIN MEJORA sin
     * evidencia (sección 9/12, criterio explícito).
     */
    postActivationResultHtml(comparison) {

        if (!comparison || !comparison.result) {

            const reasonText =
                comparison && comparison.reason === "NOT_ENOUGH_CURRENT_DATA"
                    ? "Todavía no hay suficiente evidencia de esta calibración para compararla contra la anterior."
                    : "La calibración anterior no tiene predicciones reales evaluables con las que comparar.";

            return `<p class="text-muted small mb-0">${reasonText}</p>`;

        }

        const badgeClass =
            POST_ACTIVATION_RESULT_BADGES[comparison.result] || "secondary";

        const label =
            POST_ACTIVATION_RESULT_LABELS[comparison.result] || comparison.result;

        const metricLines =
            comparison.metrics
                ? Object.keys(comparison.metrics)
                    .filter(key => comparison.metrics[key] !== null)
                    .map(key => {

                        const change =
                            comparison.metrics[key];

                        const verb =
                            change > 0 ? "mejoró" : "empeoró";

                        const label2 =
                            key === "mae" ? "MAE" : (key === "rmse" ? "RMSE" : "Bias");

                        return `<li>${label2} ${verb} ${Math.abs(change)}%</li>`;

                    }).join("")
                : "";

        return `
            <div class="alert alert-${badgeClass === "success" ? "success" : (badgeClass === "danger" ? "danger" : "secondary")} py-2 px-3 mb-0">
                <p class="fw-bold mb-1">${label}</p>
                ${metricLines ? `<ul class="list-unstyled small mb-0">${metricLines}</ul>` : ""}
            </div>
        `;

    }

    /*
     * Entrega 2.6.1.28, sección 10 -- tarjeta "Estado del modelo".
     * `status` es la respuesta EN VIVO de GET .../degradation -- ese
     * mismo GET ya corrió la detección/deduplicación/recuperación en
     * el backend (CalibrationDegradationService.getStatus()), este
     * método solo la presenta.
     */
    buildDegradationSectionHtml(status) {

        if (!status.applicable) {

            const reasonText =
                status.reason === "NOT_ACTIVE"
                    ? "Esta calibración ya no está ACTIVE -- la detección automática de degradación solo corre sobre la calibración activa de cada modelo/receta."
                    : "Esta calibración no tiene una calibración anterior con la que compararse (es la primera versión de su cadena) -- todavía no existe un baseline contra el cual detectar degradación.";

            return `
                <div class="border rounded p-3">
                    <p class="mb-1"><span class="text-success">●</span> Normal</p>
                    <p class="text-muted small mb-0">${reasonText}</p>
                </div>
            `;

        }

        if (status.degradationStatus !== "DEGRADED" || !status.current) {

            const sampleNote =
                status.classification && !status.classification.sufficientSample
                    ? `<p class="text-muted small mb-0">Todavía no hay ${10} predicciones evaluables recientes -- la detección automática no se ejecuta con una muestra tan pequeña (sección 5).</p>`
                    : "";

            return `
                <div class="border rounded p-3">
                    <p class="mb-1"><span class="text-success">●</span> Normal</p>
                    ${sampleNote}
                </div>
            `;

        }

        const event =
            status.current;

        const sign =
            event.degradationPercentage > 0 ? "+" : "";

        const acknowledgeButton =
            event.status === "DETECTED"
                ? `<button type="button" class="btn btn-sm btn-outline-warning" data-action="acknowledge-degradation" data-id="${event.id}">Reconocer</button>`
                : `<span class="badge bg-secondary">Reconocida</span>`;

        return `
            <div class="border border-danger rounded p-3">
                <p class="fw-bold text-danger mb-2">⚠ Degradación detectada</p>
                <ul class="list-unstyled small mb-2">
                    <li><strong>MAE baseline:</strong> ${this.formatValue(event.baselineMaeHours)} h</li>
                    <li><strong>MAE actual:</strong> ${this.formatValue(event.currentMaeHours)} h</li>
                    <li><strong>Incremento:</strong> ${sign}${this.formatValue(event.degradationPercentage)}%</li>
                    <li><strong>Umbral:</strong> ${event.thresholdPercentage}%</li>
                    <li><strong>Muestras evaluadas:</strong> ${event.sampleSize}</li>
                    <li><strong>Detectada:</strong> ${this.formatDate(event.detectedAt)}</li>
                </ul>
                <div class="mb-2">
                    <button type="button" class="btn btn-sm btn-outline-dark me-2" data-action="view-degradation-analysis">Ver análisis</button>
                    ${acknowledgeButton}
                </div>
                ${this.buildDegradationProposalActionsHtml(event)}
            </div>
        `;

    }

    /*
     * Entrega 2.6.1.29, secciones 9/10 -- botón "Generar propuesta"
     * (solo si el evento todavía no tiene ninguna propuesta ACTIVA
     * asociada) y/o "Ver propuesta" (si ya tiene una, apuntando siempre
     * a la MÁS RECIENTE -- `event.proposalId`, ver
     * CalibrationDegradationService._serializeEventWithProposal()).
     * Ambos pueden mostrarse a la vez únicamente cuando la propuesta
     * existente fue RECHAZADA (sección 9: "posteriormente podrá
     * generarse otra propuesta solamente mediante una nueva solicitud
     * explícita") -- en cualquier otro estado (PROPOSED/APPROVED/
     * ACTIVE/INACTIVE) solo se ofrece "Ver propuesta", nunca la opción
     * de generar una segunda mientras la primera sigue vigente (el
     * backend la rechazaría de todos modos, pero no tiene sentido
     * ofrecer un botón que se sabe de antemano que va a fallar).
     */
    buildDegradationProposalActionsHtml(event) {

        const viewButton =
            event.proposalId
                ? `<a href="/maturation/recalibration-proposals?openId=${event.proposalId}" class="btn btn-sm btn-outline-success me-2" data-action="view-degradation-proposal">Ver propuesta${event.proposalStatus === "REJECTED" ? " (rechazada)" : ""}</a>`
                : "";

        const generateButton =
            (!event.proposalId || event.proposalStatus === "REJECTED")
                ? `<button type="button" class="btn btn-sm btn-primary" data-action="generate-proposal" data-id="${event.id}">${event.proposalId ? "Generar nueva propuesta" : "Generar propuesta"}</button>`
                : "";

        if (!viewButton && !generateButton) {

            return "";

        }

        return `<div>${viewButton}${generateButton}</div>`;

    }

    /*
     * "Ver análisis" no abre una vista nueva -- el análisis detallado
     * (MAE/RMSE/Bias/periodo) ya está en la sección "Evaluación
     * post-activación" (2.6.1.27) del mismo modal, justo debajo; este
     * botón simplemente hace scroll hasta ahí en vez de duplicar esa
     * información en una segunda tarjeta.
     */
    async handleDegradationSectionClick(e) {

        const button =
            e.target.closest("button[data-action]");

        if (!button) {

            return;

        }

        const action =
            button.dataset.action;

        if (action === "view-degradation-analysis") {

            if (this.postActivationSectionContainer) {

                this.postActivationSectionContainer.scrollIntoView({ behavior: "smooth", block: "start" });

            }

            return;

        }

        if (action === "acknowledge-degradation") {

            const eventId =
                button.dataset.id;

            try {

                await this.api.acknowledgeDegradationEvent(eventId);

                UI.success("Degradación reconocida.");

                // Recarga solo esta sección con el estado ya
                // actualizado -- mismo criterio que handleSaveEvaluation()
                // más abajo (nunca cierra el modal, nunca recarga las
                // otras tres secciones innecesariamente).
                if (this.currentEvaluationCalibrationId) {

                    const refreshed =
                        await this.api.getDegradationStatus(this.currentEvaluationCalibrationId);

                    if (this.degradationSectionContainer) {

                        this.degradationSectionContainer.innerHTML =
                            this.buildDegradationSectionHtml(refreshed);

                    }

                }

            } catch (err) {

                UI.error(err.message);

            }

        }

        // Entrega 2.6.1.29, secciones 10/12 -- genera una propuesta de
        // recalibración a partir de este evento. Confirmación previa
        // (mismo criterio que activar/rechazar una propuesta en
        // recalibrationProposals.js -- una acción que crea un registro
        // nuevo y corre una simulación merece un paso explícito, no un
        // click accidental) y estado de carga simple mientras corre
        // (mockup de la sección 10: "Generando propuesta... Simulando
        // el offset candidato sobre las predicciones recientes").
        if (action === "generate-proposal") {

            const eventId =
                button.dataset.id;

            const confirmed =
                typeof UI.confirm === "function"
                    ? await UI.confirm("¿Generar una propuesta de recalibración a partir de esta alerta de degradación? Se simulará un offset candidato sobre las predicciones recientes -- la propuesta solo se guardará si la simulación muestra una mejora real.")
                    : true;

            if (!confirmed) {

                return;

            }

            const previousButtonHtml =
                button.outerHTML;

            button.disabled =
                true;

            button.textContent =
                "Generando propuesta...";

            try {

                await this.api.generateProposalFromDegradation(eventId);

                UI.success("Propuesta de recalibración generada. Todavía requiere aprobación explícita -- no se activó automáticamente.");

                if (this.currentEvaluationCalibrationId) {

                    const refreshed =
                        await this.api.getDegradationStatus(this.currentEvaluationCalibrationId);

                    if (this.degradationSectionContainer) {

                        this.degradationSectionContainer.innerHTML =
                            this.buildDegradationSectionHtml(refreshed);

                    }

                }

            } catch (err) {

                UI.error(err.message);

                // Restaura el botón tal cual estaba -- la sección no se
                // vuelve a pedir al servidor si la generación falló
                // (mismo criterio que el resto de acciones de este
                // modal: un error nunca deja la UI en un estado a medio
                // camino).
                button.outerHTML =
                    previousButtonHtml;

            }

        }

    }

    /*
     * Entrega 2.6.1.32, sección 10 -- "EFECTIVIDAD DE RECALIBRACIÓN",
     * reproduce el mockup de esa sección casi literal: mejora esperada/
     * real, efectividad, checks ✓/✗ por métrica, muestra, semáforo.
     * `effectiveness` es la respuesta EN VIVO de GET .../effectiveness
     * -- nunca se recalcula nada aquí, solo se formatea.
     */
    buildEffectivenessSectionHtml(effectiveness) {

        const evaluateButtonHtml =
            `<button type="button" class="btn btn-sm btn-outline-primary mt-2" data-action="save-effectiveness">Registrar evaluación</button>`;

        if (!effectiveness || effectiveness.status === "NOT_APPLICABLE") {

            return `<p class="text-muted mb-0">Esta calibración no reemplazó a ninguna otra -- no hay una mejora esperada contra la cual medir efectividad.</p>`;

        }

        if (effectiveness.status === "PENDING") {

            return `
                <p class="mb-2"><span class="badge bg-secondary">EVALUACIÓN INSUFICIENTE</span></p>
                <p class="text-muted small mb-0">Todavía no hay predicciones evaluadas desde que esta calibración se activó.</p>
            `;

        }

        const table = `
            <table class="table table-sm mb-2">
                <thead><tr><th></th><th class="text-end">ESPERADO</th><th class="text-end">REAL</th></tr></thead>
                <tbody>
                    <tr><td>MAE</td><td class="text-end">${this.formatValue(effectiveness.simulated.maeHours)} h</td><td class="text-end">${this.formatValue(effectiveness.real.maeHours)} h</td></tr>
                    <tr><td>Mejora</td><td class="text-end">${this.formatValue(effectiveness.expected.mae)}%</td><td class="text-end">${this.formatValue(effectiveness.actual.mae)}%</td></tr>
                    <tr><td>RMSE</td><td class="text-end">${this.formatValue(effectiveness.simulated.rmseHours)} h</td><td class="text-end">${this.formatValue(effectiveness.real.rmseHours)} h</td></tr>
                    <tr><td>Mejora</td><td class="text-end">${this.formatValue(effectiveness.expected.rmse)}%</td><td class="text-end">${this.formatValue(effectiveness.actual.rmse)}%</td></tr>
                    <tr><td>Bias</td><td class="text-end">${this.formatValue(effectiveness.simulated.biasHours)} h</td><td class="text-end">${this.formatValue(effectiveness.real.biasHours)} h</td></tr>
                </tbody>
            </table>
        `;

        if (effectiveness.status === "PRELIMINARY") {

            return `
                ${table}
                <p class="mb-2"><span class="badge bg-secondary">EVALUACIÓN PRELIMINAR</span></p>
                <p class="text-muted small mb-2">${effectiveness.sampleSize} / ${effectiveness.minimumSampleSize} observaciones mínimas -- todavía sin conclusión definitiva.</p>
                ${evaluateButtonHtml}
            `;

        }

        if (effectiveness.status === "REGRESSION") {

            return `
                ${table}
                <p class="mb-2"><span class="badge bg-danger">⚠ REGRESIÓN</span></p>
                <p class="mb-2">Esta calibración está mostrando una regresión.</p>
                <p class="text-muted small mb-2">La automatización de rollback no está disponible todavía -- esta calibración no se desactivará automáticamente.</p>
                ${evaluateButtonHtml}
            `;

        }

        const checks =
            effectiveness.checks || {};

        return `
            ${table}
            <p class="fs-4 fw-bold mb-2">Efectividad: ${effectiveness.effectivenessScore}%</p>
            <p class="mb-1">MAE ${checks.mae ? "✓" : "✗"}</p>
            <p class="mb-1">RMSE ${checks.rmse ? "✓" : "✗"}</p>
            <p class="mb-2">Bias ${checks.bias ? "✓" : "✗"}</p>
            <p class="mb-2">Muestra: ${effectiveness.sampleSize} / ${effectiveness.minimumSampleSize}</p>
            <p class="mb-2"><span class="badge bg-${EFFECTIVENESS_TIER_BADGES[effectiveness.tier.code] || "secondary"}">${effectiveness.tier.emoji} ${effectiveness.tier.label}</span></p>
            ${evaluateButtonHtml}
        `;

    }

    /*
     * Sección 14/17 -- "Registrar evaluación" persiste un snapshot
     * inmutable explícito (mismo criterio que "Evaluar" en la sección
     * de RAW-vs-CALIBRADO más abajo, 2.6.1.17) -- la tarjeta en sí ya
     * se refresca sola en cada apertura del modal (EN VIVO), este botón
     * solo congela un snapshot para el historial de auditoría.
     */
    async handleEffectivenessSectionClick(e) {

        const button =
            e.target.closest('button[data-action="save-effectiveness"]');

        if (!button || !this.currentEvaluationCalibrationId) {

            return;

        }

        try {

            await this.api.evaluateEffectiveness(this.currentEvaluationCalibrationId);

            UI.success("Evaluación de efectividad registrada.");

            const refreshed =
                await this.api.getEffectiveness(this.currentEvaluationCalibrationId);

            if (this.effectivenessSectionContainer) {

                this.effectivenessSectionContainer.innerHTML =
                    this.buildEffectivenessSectionHtml(refreshed);

            }

        } catch (err) {

            UI.error(err.message);

        }

    }

    /*
     * Sección 15: POST .../evaluate -- calcula Y guarda una fila nueva
     * en el historial. Nunca modifica la calibración ni ninguna
     * predicción (criterio de aceptación explícito).
     */
    async handleSaveEvaluation() {

        if (!this.currentEvaluationCalibrationId) {

            return;

        }

        try {

            await this.api.createEvaluation(this.currentEvaluationCalibrationId);

            const history =
                await this.api.getEvaluationHistory(this.currentEvaluationCalibrationId);

            this.renderEvaluationHistory(history);

            UI.success("Evaluación guardada en el historial.");

        } catch (err) {

            UI.error(err.message);

        }

    }

    /*
     * Entrega 2.6.1.19, sección 11/13/16 -- cadena de versiones. Un
     * timeline simple, derivado directamente de los campos que ya trae
     * cada fila de GET .../versions (createdAt/approvedAt/activatedAt/
     * deactivatedAt/rejectedAt) -- no existe un endpoint de timeline
     * aparte (sección 13 solo pide versions/comparison/create-replacement),
     * así que esta vista se construye enteramente en el cliente a
     * partir de datos ya presentes.
     */
    async openVersions(id) {

        if (!this.versionsModal) {

            return;

        }

        if (this.versionsBody) {

            this.versionsBody.innerHTML = `<p class="text-muted mb-0">Cargando...</p>`;

        }

        this.versionsModal.show();

        try {

            const chain =
                await this.api.getVersionChain(id);

            if (this.versionsBody) {

                this.versionsBody.innerHTML =
                    this.buildVersionsHtml(chain);

            }

        } catch (err) {

            if (this.versionsBody) {

                this.versionsBody.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener la cadena de versiones: ${err.message}</p>`;

            }

        }

    }

    buildVersionsHtml(chain) {

        if (!chain || chain.length === 0) {

            return `<p class="text-muted mb-0">No se encontró información de versiones.</p>`;

        }

        const cards =
            chain.map((c, index) => {

                const arrow =
                    index < chain.length - 1
                        ? `<div class="text-center text-muted my-1">↓</div>`
                        : "";

                // Timeline (sección 11) -- solo los eventos que
                // realmente ocurrieron para esta fila, en orden
                // cronológico; nunca se inventa un evento que no está
                // en los datos (p. ej. una PROPOSED nunca tuvo
                // activatedAt).
                const events = [

                    { at: c.createdAt, label: "Creada" },

                    { at: c.approvedAt, label: "Aprobada" },

                    { at: c.rejectedAt, label: "Rechazada" },

                    { at: c.activatedAt, label: "Activada" },

                    { at: c.deactivatedAt, label: "Desactivada" }

                ].filter(ev => ev.at);

                const eventsHtml =
                    events.map(ev => `<li>${this.formatDate(ev.at)} -- ${ev.label}</li>`).join("");

                return `
                    <div class="border rounded p-3 mb-1 ${c.status === "ACTIVE" ? "border-success" : ""}">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <p class="fw-bold mb-0">Calibration #${c.id} -- v${c.version}</p>
                                <p class="text-muted small mb-0">${this.formatOffset(c.offsetHours)}${c.parentCalibrationId ? ` -- reemplaza a #${c.parentCalibrationId}` : " -- primera versión"}</p>
                            </div>
                            <span class="badge bg-${CALIBRATION_STATUS_BADGES[c.status] || "secondary"}">${c.status}</span>
                        </div>
                        <ul class="list-unstyled small text-muted mb-0 mt-2">
                            ${eventsHtml || "<li>Sin eventos registrados todavía.</li>"}
                        </ul>
                    </div>
                    ${arrow}
                `;

            }).join("");

        return cards;

    }

    /*
     * Entrega 2.6.1.19, sección 8-10 -- comparación entre dos
     * versiones. `id` es la calibración ancla (desde donde se abrió el
     * modal); el selector se llena con el resto de la cadena.
     */
    async openComparison(id) {

        if (!this.comparisonModal) {

            return;

        }

        this.comparisonAnchorId = id;

        if (this.comparisonBody) {

            this.comparisonBody.innerHTML = `<p class="text-muted mb-0">Cargando...</p>`;

        }

        if (this.comparisonOtherSelect) {

            this.comparisonOtherSelect.innerHTML = `<option value="">Cargando...</option>`;

        }

        this.comparisonModal.show();

        try {

            const chain =
                await this.api.getVersionChain(id);

            const others =
                chain.filter(c => String(c.id) !== String(id));

            if (this.comparisonOtherSelect) {

                if (others.length === 0) {

                    this.comparisonOtherSelect.innerHTML = `<option value="">No hay otras versiones para comparar</option>`;

                    if (this.comparisonBody) {

                        this.comparisonBody.innerHTML =
                            `<p class="text-muted mb-0">Esta calibración todavía no tiene otras versiones en su cadena (sección 2 -- se crean con "Crear nueva calibración" desde una alerta de salud, o manualmente vía la API).</p>`;

                    }

                    return;

                }

                this.comparisonOtherSelect.innerHTML =
                    `<option value="" disabled selected>Selecciona una versión</option>` +
                    others.map(c => `<option value="${c.id}">Calibration #${c.id} (v${c.version}, ${c.status})</option>`).join("");

                if (this.comparisonBody) {

                    this.comparisonBody.innerHTML =
                        `<p class="text-muted mb-0">Selecciona una versión para comparar.</p>`;

                }

            }

        } catch (err) {

            if (this.comparisonBody) {

                this.comparisonBody.innerHTML =
                    `<p class="text-danger mb-0">No fue posible obtener la cadena de versiones: ${err.message}</p>`;

            }

        }

    }

    async handleComparisonOtherChange() {

        const otherId =
            this.comparisonOtherSelect ? this.comparisonOtherSelect.value : "";

        if (!otherId || !this.comparisonAnchorId) {

            return;

        }

        if (this.comparisonBody) {

            this.comparisonBody.innerHTML = `<p class="text-muted mb-0">Cargando...</p>`;

        }

        try {

            const comparison =
                await this.api.getComparison(this.comparisonAnchorId, otherId);

            if (this.comparisonBody) {

                this.comparisonBody.innerHTML =
                    this.buildComparisonHtml(comparison);

            }

        } catch (err) {

            if (this.comparisonBody) {

                this.comparisonBody.innerHTML =
                    `<p class="text-danger mb-0">No fue posible comparar: ${err.message}</p>`;

            }

        }

    }

    /*
     * Sección 8/9/10 -- tabla Métrica | #A | #B + resumen en prosa
     * (generado server-side, ver `CalibrationComparison.js`) +
     * advertencias de evidencia insuficiente/tamaños dispares, nunca
     * redactadas aquí.
     */
    buildComparisonHtml(comparison) {

        const [a, b] =
            comparison.calibrations;

        const row =
            (label, formatter) => `<tr><td>${label}</td><td class="text-end">${formatter(a)}</td><td class="text-end">${formatter(b)}</td></tr>`;

        const warningsHtml =
            (comparison.warnings || []).map(w => `<div class="alert alert-warning small py-2 px-3 mb-2">${w}</div>`).join("");

        const evidenceRow =
            (c) => `<span class="badge bg-${EVALUATION_CONFIDENCE_BADGES[c.evaluationConfidence] || "secondary"}">${c.evaluationConfidence}</span>`;

        return `
            <table class="table table-sm mb-3">
                <thead>
                    <tr><th>Métrica</th><th class="text-end">Calibration #${a.calibrationId} (v${a.version})</th><th class="text-end">Calibration #${b.calibrationId} (v${b.version})</th></tr>
                </thead>
                <tbody>
                    ${row("Offset", c => this.formatOffset(c.offsetHours))}
                    ${row("Estado", c => `<span class="badge bg-${CALIBRATION_STATUS_BADGES[c.status] || "secondary"}">${c.status}</span>`)}
                    ${row("Muestras evaluadas", c => c.sampleSize ?? "—")}
                    ${row("Nivel de evidencia", evidenceRow)}
                    ${row("Periodo evaluado", c => c.evaluationPeriod && c.evaluationPeriod.from ? `${this.formatDate(c.evaluationPeriod.from)} -- ${this.formatDate(c.evaluationPeriod.to)}` : "—")}
                    ${row("MAE", c => c.maeHours !== null ? c.maeHours + " h" : "—")}
                    ${row("RMSE", c => c.rmseHours !== null ? c.rmseHours + " h" : "—")}
                    ${row("Bias", c => this.formatBias(c.biasHours))}
                </tbody>
            </table>
            ${warningsHtml}
            <p class="mb-0">${comparison.summary}</p>
        `;

    }

}

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        window.maturationCalibrationsPage =
            new MaturationCalibrationsPage();

        const params =
            new URLSearchParams(window.location.search);

        if (params.get("modelType")) {

            window.maturationCalibrationsPage.openNew({

                modelType: params.get("modelType"),

                offsetHours: params.get("offsetHours"),

                sampleSize: params.get("sampleSize"),

                biasHours: params.get("biasHours")

            });

        }

        await window.maturationCalibrationsPage.load();

        // Entrega 2.6.1.26, sección 4 -- deep-link "Ver detalle completo
        // de esta calibración" desde la tarjeta de una predicción
        // (measurements.js, calibrationUsedBlockHtml()). Mismo patrón de
        // "?openId=" ya usado en dashboard.js/alertCenter.js/
        // recalibrationProposals.js -- se abre el modal de Versiones
        // (2.6.1.19, ya expone modelo/parámetros/versión/fecha de
        // creación/calibración padre/historial de activación completo,
        // sección 4 de esta entrega no necesitaba ninguna vista nueva)
        // DESPUÉS de cargar la tabla, nunca antes -- no depende de que
        // la fila esté en `calibrationsById` (openVersions() solo
        // necesita el id, pide la cadena de versiones directamente a la
        // API), pero se espera el load() de todos modos para que la
        // pantalla de fondo no quede vacía si el usuario cierra el modal.
        const openVersionsId =
            params.get("openVersionsId");

        if (openVersionsId) {

            window.maturationCalibrationsPage.openVersions(openVersionsId);

        }

        // Entrega 2.6.1.29 -- deep-link simétrico a "openVersionsId" de
        // arriba, pero hacia el modal de Evaluación (donde vive la
        // sección "Estado del modelo" de 2.6.1.28). Lo usa el enlace
        // "Ver alerta origen" de recalibrationProposals.js cuando una
        // propuesta viene del flujo de degradación -- ese modal nunca
        // tuvo, hasta ahora, forma de abrirse directamente desde fuera
        // de esta misma página.
        const openEvaluationId =
            params.get("openEvaluationId");

        if (openEvaluationId) {

            window.maturationCalibrationsPage.openEvaluation(openEvaluationId);

        }

    }

);
