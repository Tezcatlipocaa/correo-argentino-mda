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

## Persistencia

SQLite (`database/mda.db`, no viaja en git) + Drizzle. Tablas del módulo:
`invgate_cache`, `automation_parents`, `automation_tracked_parents`,
`automation_closures`, `automation_manual_data`, `workflow_stages`,
`workflow_stage_tickets`.

## Variables de entorno

`INVGATE_AUTOMATION_VIEW_ID` (producción: `64`), `INVGATE_AUTOMATION_CATEGORY_ID`,
`INVGATE_AUTOMATION_GROUP_ID`, `AUTOMATION_*_TTL_MIN`,
`AUTOMATION_CLOSE_THRESHOLD`, `INVGATE_METRICS`. Detalle en `.env.example`.

## Tests

- Unitarios: `npx tsx tests/workflow-*.test.mjs` (scripts tsx).
- `tests/invgate-metrics.test.mjs`.
- E2E: `tests/automatizaciones-sidebar-shell.spec.ts`.

## Deploy

Ver `docs/deploy-produccion.md`. Tras el pull: `npm install` → `npm run db:push`
(crea las tablas nuevas) → `npm run db:seed-etapas` (plantilla de etapas,
idempotente) → `npm run build` → PM2 → `npm run warm:automations`.
