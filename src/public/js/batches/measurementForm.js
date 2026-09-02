class MeasurementForm extends CrudForm {

    constructor(formId) {

        super(

            formId,

            "modalMeasurement"

        );

        this._co2DebounceTimer = null;

        this.form.phase.addEventListener(

            "change",

            () => this.updateFieldsForPhase()

        );

        this.form.psi.addEventListener(

            "input",

            () => this.scheduleCo2Estimate()

        );

        this.form.ambientTemperature.addEventListener(

            "input",

            () => this.scheduleCo2Estimate()

        );

        // Entrega 2.8.0.1, sección 2 -- alternar entre los dos modos de
        // captura del hidrómetro.
        this.hydrometerAutoPanel =
            document.getElementById("hydrometerAutoPanel");

        this.hydrometerErrorEl =
            document.getElementById("hydrometerError");

        this.hydrometerResultEl =
            document.getElementById("hydrometerResult");

        this._lastHydrometerConversion =
            null;

        this.form.hydrometerMode.forEach(radio => {

            radio.addEventListener(

                "change",

                () => this.onHydrometerModeChanged()

            );

        });

        const calculateButton =
            document.getElementById("btnHydrometerCalculate");

        if (calculateButton) {

            calculateButton.addEventListener(

                "click",

                () => this.calculateHydrometerConversion()

            );

        }

        const cancelResultButton =
            document.getElementById("btnHydrometerCancelResult");

        if (cancelResultButton) {

            cancelResultButton.addEventListener(

                "click",

                () => this.hideHydrometerResult()

            );

        }

        const useValuesButton =
            document.getElementById("btnHydrometerUseValues");

        if (useValuesButton) {

            useValuesButton.addEventListener(

                "click",

                () => this.applyHydrometerResult()

            );

        }

        // Sección 11 -- si el operador escribe directamente sobre
        // SG/Brix/Alcohol (ya sea porque nunca usó el modo automático, o
        // porque decidió corregir a mano un valor ya calculado), la
        // trazabilidad deja de reflejar la realidad -- se limpia aquí.
        // Nunca se dispara cuando `applyHydrometerResult()` asigna
        // `.value` por código (asignar `.value` no dispara "input" en el
        // DOM), así que esto solo reacciona a tecleo real del operador.
        ["specificGravity", "brix", "estimatedAlcohol"].forEach(name => {

            this.form[name].addEventListener(

                "input",

                () => this.clearHydrometerTraceability()

            );

        });

    }

    /*
     * Sección 2 -- muestra/oculta el panel de conversión automática
     * según el radio seleccionado. Puramente visual, SIN efectos
     * secundarios sobre la trazabilidad -- se usa tanto al reaccionar a
     * un cambio real del operador (ver `onHydrometerModeChanged()`)
     * como al abrir el formulario para editar/crear (`load()`/
     * `openNew()`), donde NO queremos borrar una trazabilidad que
     * `load()` acaba de restaurar desde la medición existente.
     */
    syncHydrometerPanelVisibility() {

        const isAuto =
            this.form.hydrometerMode.value === "AUTO";

        if (this.hydrometerAutoPanel) {

            this.hydrometerAutoPanel.style.display =
                isAuto ? "block" : "none";

        }

    }

    /*
     * Reacciona a que el OPERADOR cambió el radio a mano (listener del
     * constructor). Cambiar A "Manual" nunca borra los valores de
     * SG/Brix/Alcohol ya escritos (el operador puede seguir
     * editándolos) -- solo limpia la trazabilidad de una conversión
     * automática previa, ya que a partir de ahora el control vuelve a
     * ser manual (sección 11, mismo criterio que el listener de "input"
     * de arriba).
     */
    onHydrometerModeChanged() {

        this.syncHydrometerPanelVisibility();

        if (this.form.hydrometerMode.value !== "AUTO") {

            this.hideHydrometerResult();

            this.clearHydrometerTraceability();

            return;

        }

        // Entrega 2.8.0.3, sección 7 -- "si cambia la lectura de entrada
        // SG 1.022 → SG 1.025, los valores derivados deberán
        // recalcularse". Al volver a modo AUTO sobre una medición que ya
        // tenía trazabilidad (editar), se precargan la escala/valor
        // originales en el panel para que el operador solo tenga que
        // AJUSTAR la lectura y pulsar Calcular, en vez de re-teclear
        // todo desde cero. Nunca aplica nada por sí solo -- sigue
        // requiriendo "Calcular" + "Usar estos valores", como cualquier
        // otro cálculo.
        const existingScale =
            this.form.hydrometerInputScale.value;

        const existingValue =
            this.form.hydrometerInputValue.value;

        const scaleSelect =
            document.getElementById("hydrometerScale");

        const valueInput =
            document.getElementById("hydrometerValue");

        if (existingScale && scaleSelect && valueInput && !valueInput.value) {

            scaleSelect.value = existingScale;
            valueInput.value = existingValue;

        }

    }

    hideHydrometerResult() {

        this._lastHydrometerConversion =
            null;

        if (this.hydrometerResultEl) {

            this.hydrometerResultEl.style.display =
                "none";

        }

        if (this.hydrometerErrorEl) {

            this.hydrometerErrorEl.style.display =
                "none";

        }

    }

    clearHydrometerTraceability() {

        this.form.hydrometerInputScale.value = "";
        this.form.hydrometerInputValue.value = "";
        this.form.hydrometerConversionMethod.value = "";

        this._hydrometerTableLabel = null;

        this.renderHydrometerBadges(null);

        this.renderHydrometerTraceabilityDetail(null);

    }

    /*
     * Sección 8 -- distingue "Lectura introducida" (la escala que el
     * operador realmente tecleó) de "Estimado por tabla/interpolación"
     * (las otras dos), tanto en la vista previa del panel automático
     * como junto a los campos reales del formulario una vez aplicados.
     *
     * Entrega 2.8.0.3, sección 6 -- además del texto del badge, cada uno
     * lleva un `title` (tooltip nativo al pasar el cursor) con el
     * detalle completo: "Calculado a partir de: SG 1.022 · Método:
     * Interpolación lineal · Tabla: Brewer's Elite v1" -- evita
     * confundir una estimación con una lectura instrumental directa
     * incluso sin abrir nada más.
     */
    renderHydrometerBadges(scale, { value, method, tableLabel } = {}) {

        const badgeByField = {

            specificGravity: document.getElementById("specificGravityHydrometerBadge"),

            brix: document.getElementById("brixHydrometerBadge"),

            estimatedAlcohol: document.getElementById("estimatedAlcoholHydrometerBadge")

        };

        const fieldByScale = {

            SG: "specificGravity",

            BRIX: "brix",

            ALCOHOL: "estimatedAlcohol"

        };

        const scaleLabel = {

            SG: "SG",

            BRIX: "Brix",

            ALCOHOL: "% Alcohol"

        };

        const tooltip =
            scale
                ? `Calculado a partir de: ${scaleLabel[scale] || scale} ${value ?? ""} · Método: ${this.methodLabel(method)} · Tabla: ${tableLabel || "—"}`
                : "";

        Object.keys(badgeByField).forEach(field => {

            const badge =
                badgeByField[field];

            if (!badge) {

                return;

            }

            if (!scale) {

                badge.style.display = "none";
                badge.title = "";

                return;

            }

            const inputField =
                fieldByScale[scale];

            if (field === inputField) {

                badge.textContent = "Lectura introducida";
                badge.className = "badge bg-primary";
                badge.title = `Lectura introducida por el operador (${scaleLabel[scale] || scale} ${value ?? ""}).`;

            } else {

                badge.textContent = "ⓘ Estimado";
                badge.className = "badge bg-info text-dark";
                badge.title = tooltip;

            }

            badge.style.display = "inline-block";

        });

    }

    /*
     * Entrega 2.8.0.3, sección 6/8 -- bloque de texto (no solo el
     * tooltip del badge, sección 6: "Al pasar el cursor o consultar
     * detalles") con el mismo detalle, siempre visible mientras haya
     * una conversión aplicada a esta medición -- vista previa recién
     * calculada o trazabilidad restaurada al editar (sección 8: "las
     * mediciones históricas seguirán mostrando: Tabla utilizada: v1").
     */
    renderHydrometerTraceabilityDetail(details) {

        const { scale, value, method, tableLabel } =
            details || {};

        const el =
            document.getElementById("hydrometerTraceabilityDetail");

        if (!el) {

            return;

        }

        if (!scale) {

            el.style.display = "none";
            el.textContent = "";

            return;

        }

        const scaleLabel = {

            SG: "SG",

            BRIX: "Brix",

            ALCOHOL: "% Alcohol"

        };

        el.textContent =
            `Calculado a partir de: ${scaleLabel[scale] || scale} ${value ?? ""} · Método: ${this.methodLabel(method)} · Tabla: ${tableLabel || "consultando…"}`;

        el.style.display = "block";

    }

    methodLabel(method) {

        if (method === "TABLE_EXACT") {

            return "Tabla del fabricante (valor exacto)";

        }

        if (method === "INTERPOLATED") {

            return "Interpolación lineal";

        }

        return "—";

    }

    /*
     * Entrega 2.8.0.3, sección 6/8 -- resuelve `name`/`version` de una
     * tabla a partir de su id (guardado en `hydrometerConversionTableId`,
     * 2.8.0.2). Falla en silencio (indicador puramente informativo,
     * nunca bloquea el resto del formulario) -- si la consulta falla,
     * el detalle simplemente muestra "Tabla #id" en vez del nombre.
     */
    async fetchHydrometerTableLabel(tableId) {

        if (!tableId) {

            return null;

        }

        try {

            const response =
                await Api.get(`/api/hydrometer/tables/${tableId}`);

            const table =
                response.data;

            return `${table.name} v${table.version}`;

        } catch (err) {

            return `Tabla #${tableId}`;

        }

    }

    // Sección 14 -- consulta POST /api/hydrometer/convert; NUNCA
    // calcula la interpolación en el frontend (la tabla del fabricante y
    // su lógica viven exclusivamente en el backend, sección 1/13).
    async calculateHydrometerConversion() {

        const scale =
            document.getElementById("hydrometerScale").value;

        const value =
            this.numberOrNull(document.getElementById("hydrometerValue").value);

        this.hideHydrometerResult();

        if (value === null) {

            this.showHydrometerError("Ingresa un valor numérico para calcular.");

            return;

        }

        try {

            const response =
                await Api.post("/api/hydrometer/convert", { scale, value });

            const data =
                response.data;

            this._lastHydrometerConversion =
                { scale, value, ...data.result, method: data.method, tableId: data.tableId, tableVersion: data.tableVersion };

            document.getElementById("hydrometerResultSg").textContent = data.result.sg;
            document.getElementById("hydrometerResultBrix").textContent = data.result.brix;
            document.getElementById("hydrometerResultAlcohol").textContent = `${data.result.alcohol}%`;

            document.getElementById("hydrometerResultMethod").textContent =
                this.methodLabel(data.method);

            this.hydrometerResultEl.style.display = "block";

            // Entrega 2.8.0.3, sección 6 -- "Tabla del fabricante v1"
            // junto al resultado, ANTES de que el operador confirme
            // "Usar estos valores" (la vista previa completa que pide
            // el spec: escala/valor/resultado/tabla, todo visible antes
            // de guardar). Se captura la referencia AL OBJETO actual
            // (`thisConversion`) en vez de releer `this._lastHydrometerConversion`
            // cuando resuelva la consulta -- si mientras tanto el
            // operador recalculó, canceló (Cancelar/cambió a Manual) o
            // cerró el modal, esa referencia ya no coincide y el
            // resultado tardío se descarta en silencio, en vez de
            // reventar contra `null` o pisar un resultado más nuevo.
            const thisConversion =
                this._lastHydrometerConversion;

            this.fetchHydrometerTableLabel(data.tableId).then(label => {

                if (this._lastHydrometerConversion !== thisConversion) {

                    return;

                }

                thisConversion.tableLabel = label;

                const methodEl =
                    document.getElementById("hydrometerResultMethod");

                if (methodEl) {

                    methodEl.textContent =
                        `${this.methodLabel(data.method)} · Tabla: ${label || "—"}`;

                }

            });

        } catch (err) {

            this.showHydrometerError(err.message || "No fue posible calcular la conversión.");

        }

    }

    showHydrometerError(message) {

        if (!this.hydrometerErrorEl) {

            return;

        }

        this.hydrometerErrorEl.textContent = message;
        this.hydrometerErrorEl.style.display = "block";

    }

    /*
     * Sección 16 -- "no debemos guardar automáticamente una conversión
     * solamente por cambiar un campo": esto solo COPIA el resultado ya
     * revisado a los campos reales del formulario y marca la
     * trazabilidad; el registro solo se persiste cuando el operador
     * pulsa "Guardar" en el pie del modal, como cualquier otro campo.
     */
    applyHydrometerResult() {

        if (!this._lastHydrometerConversion) {

            return;

        }

        const { scale, value, sg, brix, alcohol, method, tableLabel } =
            this._lastHydrometerConversion;

        this.form.specificGravity.value = sg;
        this.form.brix.value = brix;
        this.form.estimatedAlcohol.value = alcohol;

        this.form.hydrometerInputScale.value = scale;
        this.form.hydrometerInputValue.value = value;
        this.form.hydrometerConversionMethod.value = method;

        this._hydrometerTableLabel = tableLabel || null;

        this.renderHydrometerBadges(scale, { value, method, tableLabel: this._hydrometerTableLabel });

        this.renderHydrometerTraceabilityDetail({ scale, value, method, tableLabel: this._hydrometerTableLabel });

    }

    updateFieldsForPhase() {

        const isF2 =
            this.form.phase.value === "F2";

        const psiGroup =
            document.getElementById("psiGroup");

        if (psiGroup) {

            psiGroup.style.display =
                isF2 ? "block" : "none";

        }

        this.form.psi.disabled = !isF2;

        if (!isF2) {

            this.form.psi.value = 0;

        }

        const co2Group =
            document.getElementById("co2Group");

        if (co2Group) {

            co2Group.style.display =
                isF2 ? "block" : "none";

        }

        if (!isF2) {

            this.setCo2Preview(null);

        }

        const f1FinalFieldsGroup =
            document.getElementById("f1FinalFieldsGroup");

        if (f1FinalFieldsGroup) {

            f1FinalFieldsGroup.style.display =
                isF2 ? "none" : "block";

        }

        if (isF2) {

            this.scheduleCo2Estimate();

        }

    }

    setCo2Preview(co2Volumes) {

        const el =
            document.getElementById("co2PreviewValue");

        if (!el) {

            return;

        }

        el.textContent =
            co2Volumes !== null && co2Volumes !== undefined
                ? `≈ ${co2Volumes} volumes`
                : "—";

    }

    scheduleCo2Estimate() {

        clearTimeout(this._co2DebounceTimer);

        this._co2DebounceTimer =
            setTimeout(

                () => this.estimateCo2(),

                400

            );

    }

    async estimateCo2() {

        if (this.form.phase.value !== "F2") {

            return;

        }

        const psi =
            this.numberOrNull(this.form.psi.value);

        const temperature =
            this.numberOrNull(this.form.ambientTemperature.value);

        if (psi === null || temperature === null) {

            this.setCo2Preview(null);

            return;

        }

        try {

            const response =
                await Api.post(

                    "/api/carbonation/estimate",

                    { psi, temperature }

                );

            this.setCo2Preview(response.data.co2Volumes);

        } catch (err) {

            this.setCo2Preview(null);

        }

    }

    numberOrNull(value) {

        if (value === "" || value === null || value === undefined)

            return null;

        return Number(value);

    }

    toDatetimeLocalValue(isoString) {

        const date =
            new Date(isoString);

        const pad =
            n => String(n).padStart(2, "0");

        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

    }

    read() {

        const rawDate =
            this.form.measurementDate.value;

        return {

            measurementDate:
                rawDate
                    ? new Date(rawDate).toISOString()
                    : null,

            phase:
                this.form.phase.value,

            ph:
                this.numberOrNull(this.form.ph.value),

            brix:
                this.numberOrNull(this.form.brix.value),

            brixLafmate:
                this.numberOrNull(this.form.brixLafmate.value),

            specificGravity:
                this.numberOrNull(this.form.specificGravity.value),

            estimatedAlcohol:
                this.numberOrNull(this.form.estimatedAlcohol.value),

            liquidTemperature:
                this.numberOrNull(this.form.liquidTemperature.value),

            ambientTemperature:
                this.numberOrNull(this.form.ambientTemperature.value),

            psi:
                this.form.phase.value === "F2"
                    ? this.numberOrNull(this.form.psi.value)
                    : 0,

            notes:
                this.form.notes.value || null,

            // Entrega 2.8.0.1, sección 10 -- solo van poblados cuando
            // `applyHydrometerResult()` los llenó; en modo manual (o si
            // el operador editó SG/Brix/Alcohol después de aplicar una
            // conversión) quedan vacíos y el backend guarda
            // hydrometerConversionMethod="MANUAL" (o null si no hay
            // ninguna lectura), exactamente el comportamiento previo a
            // esta entrega.
            hydrometerInputScale:
                this.form.hydrometerInputScale.value || null,

            hydrometerInputValue:
                this.numberOrNull(this.form.hydrometerInputValue.value)

        };

    }

    load(measurement) {

        this.editingId = measurement.id;

        this.form.measurementDate.value =
            measurement.measurementDate
                ? this.toDatetimeLocalValue(measurement.measurementDate)
                : "";

        this.form.phase.value =
            measurement.phase;

        this.form.ph.value =
            measurement.ph ?? "";

        this.form.brix.value =
            measurement.brix ?? "";

        this.form.brixLafmate.value =
            measurement.brixLafmate ?? "";

        this.form.specificGravity.value =
            measurement.specificGravity ?? "";

        this.form.estimatedAlcohol.value =
            measurement.estimatedAlcohol ?? "";

        this.form.liquidTemperature.value =
            measurement.liquidTemperature ?? "";

        this.form.ambientTemperature.value =
            measurement.ambientTemperature ?? "";

        this.form.psi.value =
            measurement.psi ?? "";

        this.form.notes.value =
            measurement.notes || "";

        // Entrega 2.8.0.1, sección 11 -- editar SIEMPRE arranca en modo
        // manual (nunca reabre el panel de conversión automática solo
        // porque la medición se generó así originalmente); la
        // trazabilidad existente se conserva tal cual salvo que el
        // operador vuelva a escribir sobre SG/Brix/Alcohol (ver el
        // listener de "input" del constructor).
        this.form.hydrometerModeManual.checked = true;

        this.form.hydrometerInputScale.value =
            measurement.hydrometerInputScale || "";

        this.form.hydrometerInputValue.value =
            measurement.hydrometerInputValue ?? "";

        this.form.hydrometerConversionMethod.value =
            measurement.hydrometerConversionMethod || "";

        this.syncHydrometerPanelVisibility();

        // Entrega 2.8.0.3, sección 8 -- "las mediciones históricas
        // seguirán mostrando: Tabla utilizada: v1". `tableLabel` empieza
        // null (se resuelve de forma asíncrona abajo) para no bloquear
        // la apertura del modal; renderHydrometerBadges()/
        // renderHydrometerTraceabilityDetail() ya toleran `tableLabel`
        // ausente (queda "consultando…"/"—" hasta que resuelva).
        this._hydrometerTableLabel = null;

        const scale =
            measurement.hydrometerInputScale || null;

        this.renderHydrometerBadges(scale, {

            value: measurement.hydrometerInputValue,

            method: measurement.hydrometerConversionMethod,

            tableLabel: null

        });

        this.renderHydrometerTraceabilityDetail(scale ? {

            scale,

            value: measurement.hydrometerInputValue,

            method: measurement.hydrometerConversionMethod,

            tableLabel: null

        } : null);

        if (scale && measurement.hydrometerConversionTableId) {

            this.fetchHydrometerTableLabel(measurement.hydrometerConversionTableId).then(label => {

                // Nunca pisa una edición más reciente del operador (ej.
                // cambió de medición/cerró el modal antes de que
                // resolviera esta consulta perezosa).
                if (this.editingId !== measurement.id) {

                    return;

                }

                this._hydrometerTableLabel = label;

                this.renderHydrometerBadges(scale, {

                    value: measurement.hydrometerInputValue,

                    method: measurement.hydrometerConversionMethod,

                    tableLabel: label

                });

                this.renderHydrometerTraceabilityDetail({

                    scale,

                    value: measurement.hydrometerInputValue,

                    method: measurement.hydrometerConversionMethod,

                    tableLabel: label

                });

            });

        }

        this.submitButton.textContent =
            "Actualizar";

        this.updateFieldsForPhase();

        this.setCo2Preview(measurement.co2Volumes ?? null);

    }

    openNew() {

        this.clear();

        this.form.measurementDate.value =
            this.toDatetimeLocalValue(new Date().toISOString());

        this.updateFieldsForPhase();

        this.syncHydrometerPanelVisibility();

        this._hydrometerTableLabel = null;

        this.renderHydrometerBadges(null);

        this.renderHydrometerTraceabilityDetail(null);

        document
            .getElementById("modalMeasurementTitle")
            .textContent =
            "Nueva Medición";

        this.open();

    }

    openEdit(measurement) {

        this.load(measurement);

        document
            .getElementById("modalMeasurementTitle")
            .textContent =
            "Editar Medición";

        this.open();

    }

}
