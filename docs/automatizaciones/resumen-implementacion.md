# Resumen de implementación — módulo `/automatizaciones`

Bitácora del desarrollo por commit. Para el detalle funcional ver
`guia-flujo.md`, `instructivo-operativo.md`, `nota-tecnica-api.md` y
`modelo-datos.md`.

## Alcance por commit

| Commit    | Tipo             | Alcance                                                        |
| --------- | ---------------- | -------------------------------------------------------------- |
| `ccf2df7` | chore            | Dependencias y configuración base del módulo                   |
| `cbf54ea` | feat(infra)      | Schema, RBAC, navegación y layout                              |
| `f6e2d2b` | feat(workflow)   | Dominio y monitoreo de automatizaciones en InvGate             |
| `e1dffd5` | feat             | Vista de monitoreo de sucursales (listado + detalle)           |
| `3823247` | feat(admin)      | CRUD de etapas del workflow                                    |
| `d37287f` | chore            | Workers (warm/reconcile), seeds y dump del workflow            |
| `684cf17` | test             | Cobertura unitaria y E2E                                       |
| `8c0cdcf` | docs             | Guía técnica, diseño y lecciones                               |
| `fd9dd5f` | feat             | Paginación, frescura de estados y detalle minimalista          |
| `585e632b` | fix(automatizaciones)  | Cierre local, guard de título, cache en vuelo, reapertura y ordinales |
| `a9deb9c3` | feat(automatizaciones) | Métricas del workflow (KPIs, SLA, snapshot, export)           |
| `cdaba6f8` | feat(automatizaciones) | Filtros, vista tabla, drawer y export del listado             |
| `343875f4` | refactor(automatizaciones) | Acento secondary/primary y limpieza                       |

## Qué quedó implementado

- **Monitoreo**: listado y detalle de automatizaciones de sucursales (InvGate).
  Discovery por vista de categoría / colas + tracking persistido de padres.
- **Cierre local** (portal, no InvGate): manual (admin, ≥ umbral) y automático al
  100% sin etapas bloqueantes faltantes.
- **Etapas**: plantilla `workflow` (AUTSUC) y `legacy`, administrable y seedeable.
- **Datos del formulario**: elección de fuente (description / comentario / hijo
  Instalaciones), registrador desde el creator del padre y fallback de sucursal.

## Última tanda (`fd9dd5f`)

- **Listado**: paginación server-side (`LIMIT/OFFSET` + `count`), búsqueda y
  filtro de estado en SQL; se reutiliza `Pagination.astro`; se elimina el
  filtrado client-side (`automationListFilterClient`).
- **Frescura**: fix del stale-while-revalidate del detalle persistido; write-back
  del estado del padre desde el progreso; revalidación manual (`?refresh=1`) +
  `GET /api/automatizaciones/revalidate` con indicador "Actualizando" y recarga.
- **Detalle**: UI minimalista (paneles sin bordes, badges `soft`) y mejor
  contraste en avisos y tablero.
- **Datos**: `chooseInitialForm` (sucursal como señal autoritativa), registrador
  desde `creator` del padre, fallback de nombre de sucursal y cache de detalle v2.

## Tanda 2026-10 — métricas, filtros y UI

Trabajo en la rama `feat/automatizaciones-metricas-ui` (4 commits por tema).

- **Fixes**: badge "En curso" en casos con cierre local; guard de `title`
  `undefined` del padre; race de invalidación de caches (generación anti-pipeline
  en vuelo); reapertura que no se re-auto-cierra (marcador persistido);
  `stripLeadingOrdinals` que mutilaba prefijos jerárquicos ("1-Equipamiento").
- **Métricas** (`/automatizaciones/metricas`): KPIs con ventana temporal y delta,
  SLA, por región/mesa, progreso/estancados/críticos, calidad del dato; snapshot
  mensual (`automation_metrics_monthly` + worker PM2) y export CSV/PNG. Detalle en
  `metricas.md`.
- **Listado**: filtros (estado/región/antigüedad/fechas/orden) en un drawer
  lateral, vista tarjetas/tabla, export CSV y "datos al".
- **UI/refactor**: acento secondary (claro) ↔ steel-azure-400 (oscuro); `StatsCard`
  unificado (absorbe `MetricStat`); tooltips/glosario; limpieza de código muerto y
  de abstracciones.

## Persistencia

SQLite (`database/mda.db`, no viaja en git) + Drizzle. Tablas del módulo:
`invgate_cache`, `automation_parents`, `automation_tracked_parents`,
`automation_closures`, `automation_manual_data`, `automation_metrics_monthly`,
`workflow_stages`, `workflow_stage_tickets`.

## Métricas

`/automatizaciones/metricas` calcula KPIs server-side sobre el historial local
(`src/lib/workflow/metrics.ts`): ventana temporal + delta, SLA, por región/mesa,
progreso/estancados, reaperturas y calidad del dato. Export CSV/PNG
(`metricsExport.ts`). El histórico mensual se persiste con
`scripts/snapshot-automation-metrics.ts` (worker PM2 04:05).

## Variables de entorno

`INVGATE_AUTOMATION_VIEW_ID` (producción: `64`), `INVGATE_AUTOMATION_CATEGORY_ID`,
`INVGATE_AUTOMATION_GROUP_ID`, `AUTOMATION_*_TTL_MIN`,
`AUTOMATION_CLOSE_THRESHOLD`, `AUTOMATION_AGE_THRESHOLD_DAYS`,
`AUTOMATION_STALLED_THRESHOLD_DAYS`, `INVGATE_METRICS`. Detalle en `.env.example`.

## Tests

- Unitarios: `npx tsx tests/workflow-*.test.mjs` (scripts tsx).
- `tests/invgate-metrics.test.mjs`.
- E2E: `tests/automatizaciones-sidebar-shell.spec.ts`,
  `tests/automatizaciones-rbac.spec.ts`,
  `tests/automatizaciones-metricas.spec.ts`,
  `tests/automatizaciones-export.spec.ts`,
  `tests/automatizaciones-listado.spec.ts`.

## Deploy

Ver `docs/deploy-produccion.md`. Tras el pull: `npm install` →
`npx tsx scripts/align-db-to-schema.mts` (alinea columnas/tablas nuevas con
backup) → `npm run db:seed-etapas` (plantilla de etapas, idempotente) →
`npm run build` → PM2 → `npm run warm:automations`.
