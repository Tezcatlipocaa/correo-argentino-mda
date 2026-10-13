# Modelo de datos del módulo `/automatizaciones`

Cómo el portal persiste el estado del workflow. **InvGate es la fuente de
verdad**: el portal no replica tickets; guarda caches, historial y mutaciones
locales. Motor **SQLite** (`database/mda.db`) + **Drizzle ORM** (`src/db/schema.ts`).

## Diagrama

```
                         ┌────────────────────────┐
   InvGate API ─────────▶│      invgate_cache     │  key/value + expires_at
   (vista 64, colas,     │  category/queues/status│  (caches persistidos)
    incidents, wf.request│  discovery_snapshot    │
    tasks, comments,     │  detail.<id>           │
    users, helpdesks)    │  tasks.<id>            │
                         │  solution.<id>         │
                         │  users / sector_map    │
                         └───────────┬────────────┘
                                     │ lee/escribe
                                     ▼
   discovery scan ────────▶ automation_parents          (historial, nunca poda)
   reconcile worker ──────▶ automation_tracked_parents  (activos, se poda)
                                     │
   detalle (resolver) ────▶ lee closures + manual_data + plantilla + caches
                                     │
   cierre / reapertura ───▶ automation_closures
   editar datos ──────────▶ automation_manual_data
   seed / admin ──────────▶ workflow_stages + workflow_stage_tickets
   toda mutación ─────────▶ audit_logs
```

## Tablas

- **`invgate_cache`** (`key` PK, `value` JSON, `expires_at`): caches persistidos.
  Claves: `automation.category_id`, `automation.queue_ids`,
  `automation.statuses`, `automation.discovery_snapshot_v2`,
  `automation.detail.<id>`, `automation.tasks.<id>`, `automation.solution.<id>`,
  `automation.users`, `automation.sector_map`.
- **`automation_parents`** (`automation_id` PK): historial de todos los padres
  vistos (prettyId, displayName, branch, status, fechas). Alimenta "Todas" y el
  buscador. Nunca poda. Metadatos para métricas: `estimated_end_at` (fecha del
  título), `region`/`locality` (DB de oficinas), `progress_*` (persistido
  oportunista desde detalle/progreso), `assigned_group_id/name` (mesa) y
  `reopen_count`. El scan escribe todos salvo `progress_*` (que sólo lo hace el
  detalle/progreso liviano para no pisarlo en cada re-escaneo).
- **`automation_metrics_monthly`** (`month` PK "YYYY-MM"): snapshot mensual de
  KPIs (creados, finalizados, por portal, activos al cierre, mediana/p90 de lead
  time, on-time). Lo escribe `scripts/snapshot-automation-metrics.ts` (worker
  PM2 diario 04:05).
- **`automation_tracked_parents`** (`automation_id` PK): solo padres **activos**;
  recupera los reasignados a otra mesa. Se poda al finalizar.
- **`automation_closures`** (`automation_id` PK): cierre local (`manual`/`auto`),
  motivo, %, autor, `closed_at` (segundos). Reabrir = borrar.
- **`automation_manual_data`** (`automation_id` PK): override manual —
  `jefe_name`, `jefe_dni`, `jefe_legajo`, `jefe_zonal`, `contact_number`,
  `opening_hours`, `notes`, `updated_by`, `updated_at`.
- **`workflow_stages`** (`id`): etapas (nombre, `scope` workflow/legacy, orden,
  `gate_item_id`).
- **`workflow_stage_tickets`** (`id`): tickets esperados por etapa —
  `match_label`, `aliases`, `match_description`, `display_name`, `blocking`,
  **`kind`** (`ticket`/`form`/`manual`/`subprocess`), orden.
- **`audit_logs`** (`id`): usuario, acción, timestamp.

## Métricas (`/automatizaciones/metricas`)

- Se calculan **server-side sobre datos locales** (`src/lib/workflow/metrics.ts`),
  sin consultar InvGate: leen `automation_parents` + `automation_closures`.
- Definiciones: **en curso** = `statusId` 1-4 sin cierre local; **finalizada** =
  `statusId` 5-8 o cierre local; **resolución** = `closure.closed_at ?? closed_at`
  menos `created_at`.
- Incluye KPIs (total, WIP, finalizadas, lead time mediano/p90/promedio, % cierre
  por portal), throughput mensual (12 meses), backlog por antigüedad, ranking de
  sucursales y desglose de cierres (motivo/usuario).
- Límites: el histórico arranca en la implantación del módulo (la tabla se
  puebla como side-effect del scan) y el `statusId` puede tener hasta el TTL del
  scan de desfase.

## Ciclo de vida

- **Efímero** (memoria, se pierde en restart): caches de discovery/detalle y
  single-flight. Respaldo en `invgate_cache`.
- **Permanente local**: `automation_parents`.
- **Local (no toca InvGate)**: `automation_closures`, `automation_manual_data`.
- **Configuración**: `workflow_stages` / `workflow_stage_tickets` (seed +
  admin).

## Operación

- `npm run db:push` — aplica el schema.
- `npm run db:seed-etapas` — sincroniza la plantilla de etapas (idempotente).
- `npm run db:studio` — inspección GUI.
- `scripts/backup-db.bat` — backup con timestamp (el `.db` no viaja en git).
- Deploy: `auto-deploy.bat` (pull → install → build → restart); correr
  `db:push` (+ `db:seed-etapas`) cuando cambie el schema.
