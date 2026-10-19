# Métricas del módulo `/automatizaciones`

Vista `/automatizaciones/metricas`: indicadores del flujo de automatización de
sucursales calculados **server-side sobre el historial local** (SQLite), sin
consultar InvGate (salvo el monitoreo post-automatización, que sí lee una vista
guardada). Fuente: `automation_parents` + `automation_closures` +
`automation_activity_days`, vía `src/lib/workflow/metrics.ts`.

## Cómo se calcula

- **Cohorte**: se filtra por `created_at` dentro de la ventana temporal elegida
  (`?window=30|90|365|all`; `all` = histórico completo).
- **Clasificación** por caso:
  - **En curso (WIP)**: `status_id` activo en InvGate (1-4) **y** sin cierre
    local en el portal.
  - **Finalizada**: `status_id` finalizado en InvGate (5-8) **o** con cierre
    local (`automation_closures`).
  - **Fecha de resolución**: `closure.closed_at ?? closed_at`.
- Los cierres locales (portal) ganan sobre el estado de InvGate.
- Los umbrales de "estancado" y "crítico" son configurables por env (abajo).

## KPIs

| Indicador | Qué representa | Fórmula / nota |
| --- | --- | --- |
| Total histórico | Casos de la ventana (cohorte por creación) | — |
| En curso (WIP) | Trabajo abierto ahora | activos sin cierre local |
| Finalizadas | Casos resueltos | estado InvGate finalizado o cierre local |
| Tiempo de ciclo (mediana / p90 / promedio) | Días de calendario creación→resolución | incluye esperas |
| Cumplimiento fecha estimada | % resuelto dentro de la fecha del título (AUTSUC) | cierre ≤ fecha estimada + fin del día |
| Tiempo trabajado (mediana) | Días con actividad por caso | `automation_activity_days` |
| Ritmo de cierre | Finalizaciones por semana + ETA del WIP | `finalizadas/semana`, `WIP ÷ ritmo` |
| Activo más antiguo | Peor antigüedad del WIP | — |

## Secciones

- **Resumen ejecutivo**: los números headline (total, finalizadas, WIP, tiempo de
  ciclo) + una línea con el ritmo y la proyección del backlog.
- **Casos por mes** (gráfico de líneas): creadas vs. finalizadas. El rango
  arranca en el **primer mes con datos** (sin "meses fantasma" previos a la
  implantación) y cierra en el mes actual (máx. 12).
- **Tiempo de ciclo por mes** (gráfico de líneas): mediana de días de ciclo de
  los casos resueltos en cada mes.
- **Por región** (donut): reparto de casos por región de la sucursal.
- **Cumplimiento de fecha estimada** (donut): en fecha vs. fuera de fecha.
- **Backlog por antigüedad**: distribución del WIP (0-7 / 8-15 / 16-30 / +30).
- **Tiempo trabajado y sin actividad**: mediana de días activos y de días de
  calendario sin movimiento + distribución del WIP por días sin actividad.
- **Sucursales con errores post-automatización**: tickets de error de la sucursal
  (Mosaic/hardware) creados en los días posteriores al cierre, con desglose por
  tipo (ver abajo).
- **Progreso del WIP**: avance promedio + estancados/críticos.
- **Sucursales con casos más antiguos**: top por antigüedad del WIP.
- **Calidad del dato**: casos sin código de sucursal / sin fecha estimada / sin
  región.
- **Glosario** ("¿Cómo se calcula cada métrica?"): definiciones desde
  `METRIC_DEFINITIONS` (fuente única de los tooltips).

## Tiempo trabajado (días activos)

- **Fuente**: `automation_activity_days` (una fila por caso y día con
  movimiento). Lo alimenta el scan de discovery (cuando cambia `updated_at` o el
  estado) y el **backfill** `scripts/backfill-automation-activity.ts` (deriva los
  días del detalle en InvGate: creación/última actualización/cierre del padre y
  creación/comentarios de los hijos).
- **Definición**: "trabajado" = **días activos** (días con movimiento);
  "sin actividad" = días de calendario − días activos.
- El detalle de cada automatización muestra el bloque **Tiempo** (días
  trabajados, sin actividad, tiempo de ciclo y última actividad).

## Monitoreo post-automatización (Mosaic / hardware)

- **Fuente**: vista guardada de InvGate con los tickets de error
  (`INVGATE_MOSAIC_VIEW_ID`) → ids → bulk, cacheada 5 min. Conviene acotarla a
  **~30 días** (tope de 1000 ids por corrida).
- **Matching**: `branch_code → offices.code → office_invgate_links.invgate_location_id`
  → tickets con ese `location_id` y `created_at ∈ [cierre, cierre + N días]`.
  Fallback por nombre/código en el título cuando el ticket no trae `location_id`.
- **Clasificación por tipo** (ruta de categoría normalizada): **Hardware**
  (`FieldServices` / `HW TMosaic`), **Mosaic** (software) y **Otro**. Se evalúa
  hardware antes que mosaic porque "Terminal Mosaic" contiene "mosaic".
- **Exclusión**: los títulos que empiezan con "Pedido" (pedidos de
  desarrollo/tablas/despliegue) no son errores y se descartan.
- **Ventana**: `AUTOMATION_POST_WINDOW_DAYS` (default 3). Se consideran las
  automatizaciones cerradas en los últimos `AUTOMATION_POST_CANDIDATE_DAYS`
  (default 30).
- Se muestra en la sección de métricas (con desglose por tipo) y en el detalle
  de la automatización. Cada ticket es una **fila clickeable** (abre en InvGate,
  ícono externo al final) con el `#id` (secondary en hover), el **asunto** y la
  **mesa asignada**.
- **Título canónico**: el asunto se matchea contra el catálogo homologado del
  portal (`titles`, vía `title-catalog.ts`) y se muestra el título canónico
  cuando el match es seguro (umbral 0.85); el original queda en el tooltip.
  Evita títulos mal escritos (p. ej. "Mosaic- nohost" → "Mosaic - No host").

## Ventana temporal y delta

El selector 30/90/365/todo cambia la cohorte. Los badges ↑↓ comparan contra el
**período anterior** con la misma semántica (cohorte por `created_at`), para que
el delta sea comparable.

## Export

- `GET /api/automatizaciones/metrics/export.csv?window=…` — reporte en CSV.
- `GET /api/automatizaciones/metrics/export.png?window=…` — reporte en PNG
  (SVG server-side con los gráficos + `@resvg/resvg-js`, ver `metricsExport.ts`).

## Snapshot mensual

`scripts/snapshot-automation-metrics.ts` persiste KPIs por mes en
`automation_metrics_monthly` (creados, finalizados, por portal, activos al cierre,
mediana/p90 de lead time, on-time). Dry-run por defecto; `--apply` escribe
(idempotente por mes). Corre como worker PM2 **`snapshot-automation-metrics`**
(04:05). Sirve para conservar series históricas estables.

## Variables de entorno

| Variable | Default | Uso |
| --- | --- | --- |
| `AUTOMATION_AGE_THRESHOLD_DAYS` | 30 | Antigüedad para marcar un caso en curso "crítico" |
| `AUTOMATION_STALLED_THRESHOLD_DAYS` | 15 | Días sin actualización para marcar "estancado" |
| `INVGATE_MOSAIC_VIEW_ID` | — | Vista guardada de tickets de error (monitoreo post-automatización) |
| `AUTOMATION_POST_WINDOW_DAYS` | 3 | Días posteriores al cierre para buscar errores |
| `AUTOMATION_POST_CANDIDATE_DAYS` | 30 | Días hacia atrás para considerar una automatización recién finalizada |

## Caveats

- El histórico **arranca en la implantación del módulo** (la tabla se puebla como
  side-effect del scan de discovery). Los meses previos no existen como dato.
- El `status_id` puede tener hasta el TTL del scan de desfase (~5 min).
- El **progreso persistido** sólo existe para casos abiertos/resueltos alguna vez
  (se completa al abrir el caso).
- Los **días activos** históricos dependen del backfill; en vivo se acumulan
  desde la implantación del log.
- El **SLA** sólo aplica a títulos con fecha (workflow AUTSUC); los legados sin
  fecha no entran en la muestra.
- El monitoreo Mosaic depende de que exista la vista y de que los tickets traigan
  `location_id` (o el nombre/código en el título).

## Cómo extender

- Cálculos y definiciones: `src/lib/workflow/metrics.ts`
  (`computeAutomationMetrics`, `METRIC_DEFINITIONS`).
- Días de actividad: `src/lib/workflow/activity-days.ts` +
  `scripts/backfill-automation-activity.ts`.
- Monitoreo post-automatización: `src/lib/workflow/post-automation.ts`.
- Título canónico: `src/lib/workflow/title-catalog.ts` (+ catálogo en `titles`).
- Export: `src/lib/workflow/metricsExport.ts` (+ `metricsFormat.ts`).
- Gráficos: `src/components/ui/charts/LineChart.astro` / `DonutChart.astro`.
- UI: `src/pages/automatizaciones/_components/MetricsContent.astro`,
  `MetricsGlossary.astro`, `AutomatizacionDetalleContent.astro` y
  `src/components/ui/StatsCard.astro`/`MetricInfo.astro`.
- Tests: `tests/workflow-metrics.test.mjs` +
  `tests/workflow-post-automation.test.mjs` (dominio) y
  `tests/automatizaciones-metricas.spec.ts` / `automatizaciones-export.spec.ts`
  (E2E).
