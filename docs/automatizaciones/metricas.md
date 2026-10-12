# Métricas del módulo `/automatizaciones`

Vista `/automatizaciones/metricas`: indicadores del flujo de automatización de
sucursales calculados **server-side sobre el historial local** (SQLite), sin
consultar InvGate. Fuente: `automation_parents` + `automation_closures`, vía
`src/lib/workflow/metrics.ts`.

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
| Cierre por el portal | % de finalizadas cerradas localmente | `cierres locales / finalizadas` |
| Activo más antiguo | Peor antigüedad del WIP | — |

## Secciones

- **Backlog por antigüedad**: distribución del WIP (0-7 / 8-15 / 16-30 / +30 días).
  Cada bucket enlaza al listado filtrado (`status=active&age=…`).
- **Progreso del WIP**: avance promedio de los casos con progreso persistido +
  contadores de **estancados** (sin actualización de InvGate en > umbral) y
  **críticos** (antigüedad > umbral).
- **Casos por mes**: creadas vs. finalizadas en los últimos 12 meses.
- **Por región** / **Por mesa**: volumen, WIP y mediana de tiempo de ciclo.
- **Sucursales con casos más antiguos**: top por antigüedad del WIP.
- **Calidad del dato**: casos sin código de sucursal / sin fecha estimada / sin
  región.
- **Glosario** ("¿Cómo se calcula cada métrica?"): definiciones desde
  `METRIC_DEFINITIONS` (fuente única de los tooltips).

## Ventana temporal y delta

El selector 30/90/365/todo cambia la cohorte. Los badges ↑↓ comparan contra el
**período anterior** con la misma semántica (cohorte por `created_at`), para que
el delta sea comparable.

## Export

- `GET /api/automatizaciones/metrics/export.csv?window=…` — reporte en CSV.
- `GET /api/automatizaciones/metrics/export.png?window=…` — reporte en PNG
  (SVG server-side + `@resvg/resvg-js`, ver `metricsExport.ts`).

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

## Caveats

- El histórico **arranca en la implantación del módulo** (la tabla se puebla como
  side-effect del scan de discovery).
- El `status_id` puede tener hasta el TTL del scan de desfase (~5 min).
- El **progreso persistido** sólo existe para casos abiertos/resueltos alguna vez
  (se completa al abrir el caso).
- El **SLA** sólo aplica a títulos con fecha (workflow AUTSUC); los legados sin
  fecha no entran en la muestra.

## Cómo extender

- Cálculos y definiciones: `src/lib/workflow/metrics.ts`
  (`computeAutomationMetrics`, `METRIC_DEFINITIONS`).
- Export: `src/lib/workflow/metricsExport.ts` (+ `metricsFormat.ts`).
- UI: `src/pages/automatizaciones/_components/MetricsContent.astro`,
  `MetricsGroupList.astro`, `MetricsGlossary.astro` y
  `src/components/ui/StatsCard.astro`/`MetricInfo.astro`.
- Tests: `tests/workflow-metrics.test.mjs` (dominio) y
  `tests/automatizaciones-metricas.spec.ts` / `automatizaciones-export.spec.ts` (E2E).
