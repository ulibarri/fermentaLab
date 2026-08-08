# Brief para ChatGPT — Predicción de maduración (tasa de desaceleración y ETA a pH/SG objetivo)

## 1. Propósito de este documento

Este documento resume (a) el estado actual de FermentaLab, para que cualquier especificación nueva encaje con lo ya construido, y (b) la metodología de predicción de maduración que se ha estado usando manualmente, batch por batch, en el proyecto de Claude **"Tepache production and maturation"** (y sesiones relacionadas: "Tepaches fermentation pH projection", "Kombucha Lote 3 measurements").

El objetivo es que, con este contexto, generes una especificación formal de **Entrega** (siguiendo el mismo formato usado en todas las entregas anteriores de FermentaLab: pasos numerados + criterios de aceptación) para llevar esa metodología —hoy dispersa en hojas de cálculo y conversaciones— a una funcionalidad sistemática dentro de la aplicación.

## 2. Contexto de FermentaLab

**Stack:** Node.js + Express 5, EJS + express-ejs-layouts, Sequelize v6 + SQLite, arquitectura en capas (route → controller → service → repository → model), clases JS vanilla del lado del cliente (`CrudApi`/`CrudForm`/`CrudPage`/`CrudTable`).

**Jerarquía de datos relevante:** `Category → Product → Recipe → RecipeVersion → ProductionBatch → ProductionMeasurement`.

**`ProductionBatch`** — máquina de estados: `PLANNED → IN_PROGRESS → COMPLETED → F2_STARTED → (F2_DONE | F2_SKIPPED)`. Cada transición es una acción explícita del usuario (nunca automática), validada en backend y frontend. Desde la Entrega 2.6.0.5, `ProductionBatch` **no almacena lecturas** — solo estado, fechas, volúmenes y notas de proceso. Las lecturas viven exclusivamente en `ProductionMeasurement`.

**`ProductionMeasurement`** — serie temporal de lecturas por lote, con fase (`F1` | `F2` | `FINAL`) y campos: `measurementDate`, `phase`, `ph`, `brix`, `brixLafmate`, `specificGravity`, `estimatedAlcohol`, `liquidTemperature`, `ambientTemperature`, `psi` (solo F2), `co2Volumes` (solo F2, calculado), `notes`. Se consultan ordenadas ascendentemente por `measurementDate` vía `GET /api/batches/:id/measurements`.

**Convenciones ya establecidas** (importantes para que la entrega nueva encaje sin fricción):
- Cálculos derivados viven en un módulo puro bajo `src/utils/` (sin dependencias de DB/Express), con pruebas ejecutables por separado (`node src/tests/*.test.js`, usando el módulo `assert` nativo, sin framework de testing instalado).
- El módulo de cálculo se integra en el `Service` correspondiente, que persiste el resultado en el momento de crear/actualizar el registro (igual que `co2Volumes`, que se calcula automáticamente en `ProductionMeasurementService.buildValues()` cuando `phase === "F2"`).
- No se duplican datos hacia `ProductionBatch` — toda la información de proceso vive en `ProductionMeasurement`.
- Cada entrega define explícitamente qué queda **fuera** de alcance, para evitar sobre-construir de una vez.
- La vista `/batches/:id/measurements` (Entrega 2.6.0.6) ya muestra, por lote: datos básicos del lote, un resumen por fase (F1/F2/FINAL) con primera/última lectura de cada variable, y el historial cronológico completo. Es el lugar natural para mostrar cualquier predicción.

**Precedente más cercano — Entrega 2.6.0.4 (Cálculo de carbonatación):** se construyó `CarbonationCalculator.js`, un módulo puro que resuelve una fórmula física estándar (ecuación cuadrática) para estimar `co2Volumes` a partir de PSI y temperatura, con pruebas propias, integrado en el servicio de mediciones, más un endpoint `POST /api/carbonation/estimate` para previsualización en vivo desde el formulario. Es un buen modelo de referencia estructural — con una diferencia importante: la fórmula de carbonatación es una constante física universal, mientras que los umbrales de predicción de maduración (ver sección 3) **no lo son**: varían por producto/receta y se han estado ajustando empíricamente lote a lote.

## 3. Metodología ya validada en "Tepache production and maturation"

Durante varias semanas, se ha estado subiendo manualmente (vía CSV exportado de hidrómetro/refractómetro/potenciómetro) una serie de lecturas por lote — de Tepache (variantes Citrus y Tamarindo) y de Kombucha — y usando Claude para:

### 3.1 Tasa de cambio (deceleración)

Entre dos lecturas consecutivas de la misma fase se calcula una tasa:

```
tasa = (valor_actual − valor_anterior) / (horas_actual − horas_anterior)
```

Aplicado principalmente a `pH` durante F1 (también se ha usado con `brix`/`specificGravity`, sobre todo en Kombucha, donde la fermentación es mucho más lenta — cientos de horas). La tasa típicamente arranca alta (fermentación activa) y decae progresivamente hacia ~0 (plateau).

### 3.2 Proyección lineal (ETA)

Extrapolación simple usando la tasa más reciente:

```
horas_restantes = (valor_actual − valor_objetivo) / |tasa_reciente|
eta = fecha_última_lectura + horas_restantes
```

Rápida de calcular, pero poco confiable cuando la tasa está cambiando rápido (es sensible a ruido de la última lectura).

### 3.3 Proyección exponencial (ajuste a asíntota)

Se ajusta una curva de decaimiento exponencial hacia una asíntota sobre **todos los puntos disponibles** de la fase activa:

```
valor(t) = asíntota + (valor₀ − asíntota) · e^(−k·t)
```

Esto se ha usado para dos cosas:
- Proyectar el ETA a un valor objetivo con más estabilidad que la lineal (usa toda la curva, no solo el último tramo).
- Estimar la **asíntota** misma — el valor de plateau al que el lote se va a estabilizar biológicamente. Esto permitió detectar casos donde el objetivo simplemente **no es alcanzable** porque la asíntota proyectada queda por encima/por debajo del target (ej. "el modelo exponencial proyecta una asíntota en ~3.79 — el pH 3.7 es poco probable"), y casos donde el lote ya está "matemáticamente en el plateau" (la lectura actual está a <0.01 unidades de la asíntota ajustada) aunque no haya tocado el valor objetivo exacto.

Con pocos puntos (3-4) el ajuste es inestable y se reporta con incertidumbre explícita ("con solo 4 lecturas no es confiable"); con más puntos y buen ajuste se reporta el error residual (ej. "±0.02–0.06 unidades") como señal de confianza.

### 3.4 Criterio de disparo ("¿listo para embotellar/finalizar F1?")

Un lote se considera listo para terminar la primera fermentación cuando se cumplen **dos condiciones a la vez**:
1. La tasa de cambio de pH cae por debajo de un umbral (empíricamente entre **0.010 y 0.015 unidades/hora**, según el batch — no es una constante fija).
2. El pH está dentro de (o muy cerca de) un rango objetivo.

Importante: esto siempre se ha usado como **señal informativa**, nunca como transición automática — la persona sigue decidiendo y ejecutando la acción de finalizar el lote.

### 3.5 Rangos objetivo observados (varían por producto — no son universales)

- Tepache Citrus: plateau típico de pH ~4.06–4.20, pero se ha visto desplazarse hasta ~4.27–4.32 en lotes con Brix inicial alto (>9.0) — más azúcar inicial parece elevar el pH de equilibrio biológico.
- Tepache Tamarindo: plateau más bajo, ~3.85–3.95 (más ácidos totales en solución por el ácido tartárico nativo de la fruta).
- Otro conjunto de batches de tepache (sesión "Tepaches fermentation pH projection") trabajó con objetivos de pH 3.7–3.8 y también 3.9–3.95, ajustando el target de un lote al mínimo alcanzado por un lote de referencia anterior del mismo producto.
- Kombucha: mismo enfoque pero sobre Brix/SG en vez de pH, con escalas de tiempo de cientos de horas y fases de latencia (lag) muy largas (hasta ~200h) antes de que un SCOBY nuevo muestre movimiento medible.

### 3.6 Factores adicionales observados (contexto, no necesariamente para la v1)

- **Fase de latencia (lag) con reversión inicial:** en Tamarindo, el pH *sube* las primeras horas (compuestos tampón liberándose de la pulpa) antes de empezar a bajar por fermentación real — el pH "efectivo" de arranque no es el de la primera lectura.
- **Sesgo del hidrómetro de 3 escalas:** una vez que hay alcohol presente, el hidrómetro subestima el azúcar residual real (no distingue la caída de densidad por consumo de azúcar de la caída por formación de alcohol). Esto afecta la confiabilidad de proyecciones de Brix/SG (no de pH) durante fermentación activa.
- **Comparación contra lote de referencia:** se compara el lote actual contra un lote anterior del mismo producto en el mismo tiempo transcurrido, y a veces se usa el valor final de un lote de referencia como target del lote nuevo.
- **Descarte manual de outliers:** lecturas que rompen la tendencia monótona esperada se han excluido a criterio del usuario antes de ajustar el modelo.

Estos tres puntos son juicio humano/contextual — no se han encontrado reglas mecánicas fijas para automatizarlos, y se proponen como **fuera de alcance** para una primera entrega (ver sección 5).

## 4. Objetivo de la entrega a especificar

Llevar el cálculo de tasa de cambio y las dos proyecciones (lineal y exponencial) de la sección 3.1–3.4 a FermentaLab, calculadas sobre las lecturas ya almacenadas en `ProductionMeasurement`, y mostradas en la página de resumen del lote (`/batches/:id/measurements`, junto al bloque F1 ya existente de la Entrega 2.6.0.6). Debe quedar disponible también vía API, para poder graficarse más adelante.

## 5. Alcance propuesto (a validar/ajustar por quien redacte la entrega)

**Dentro de alcance:**
- Cálculo de tasa de cambio entre las últimas N lecturas de una fase (mínimo la fase F1, idealmente generalizable a F2/`co2Volumes` y a Kombucha vía `brix`/`specificGravity`).
- Proyección lineal de ETA a un valor objetivo.
- Proyección exponencial (ajuste a asíntota) de ETA + valor de plateau estimado, con indicador de confianza/error cuando haya pocos puntos.
- Umbral de tasa y rango objetivo **configurables** (no hardcodeados) — lugar natural a decidir: ¿`Recipe`, `RecipeVersion`, o una tabla de configuración aparte? Ver preguntas abiertas.
- Señal informativa de "criterio de disparo cumplido" (tasa + rango objetivo), mostrada en el resumen — sin transición automática de estado del lote.
- Endpoint API que entregue estos cálculos (para consumo del frontend y, después, de gráficas).

**Fuera de alcance (proponer para una entrega posterior):**
- Comparación automática contra lotes de referencia / herencia de targets de un lote anterior.
- Corrección de sesgo del hidrómetro por alcohol presente.
- Detección/exclusión automática de outliers.
- Detección de fase de latencia con reversión inicial (compuestos tampón).
- Transición automática de estado del lote al cumplirse el criterio de disparo.
- Gráficas (ya identificado como la Entrega siguiente a 2.6.0.6).
- Importación de CSV del TILT.

## 6. Preguntas de diseño abiertas para quien redacte la entrega

1. ¿Dónde deben vivir el umbral de tasa y el rango de pH/SG objetivo por producto? (`RecipeVersion` parece el candidato más natural, ya que ya concentra las variaciones de una receta, pero implica una migración nueva.)
2. ¿El ajuste exponencial se implementa en JS puro (consistente con `CarbonationCalculator`, sin nuevas dependencias) o se justifica una librería numérica? En las sesiones originales el ajuste se hizo con Python/pandas — hay que portar el método a Node.
3. ¿Cuántas lecturas mínimas se requieren antes de mostrar una proyección exponencial (en las sesiones originales, con 3 se advertía baja confianza, con 5-6 el ajuste ya era razonablemente estable)?
4. ¿La tasa/proyección se calcula solo para `ph`, o de una vez de forma genérica para cualquier campo numérico de la medición (para que sirva también en Kombucha con `brix`/`specificGravity`)?

## 7. Petición

Con este contexto, redacta una especificación de **Entrega** para FermentaLab (formato: pasos numerados + criterios de aceptación, igual que las entregas anteriores del proyecto), que implemente el cálculo de tasa de cambio y las proyecciones lineal/exponencial descritas arriba, integrado a `ProductionMeasurement`, mostrado en el resumen del lote, y expuesto por API.
