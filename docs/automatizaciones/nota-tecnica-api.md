# Nota técnica: mapeo del portal con InvGate (módulo `/automatizaciones`)

Cómo el portal descubre, resuelve y muestra las automatizaciones de sucursal.
Base API: `INVGATE_BASE_URL` (incluye `/api/v1/`), auth Basic
`INVGATE_API_USERNAME:INVGATE_API_KEY` vía `invgateGet`/`invgatePost`.

## 1. Identificadores (no hardcodear entre instancias)

- **Categoría hoja:** `TI Tecnologia informatica » Gestión de Servicios » Mesa de
  Coordinación » Proyectos » Automatizar sucursal`. En producción es **3023**.
  Se resuelve por ruta verbatim (`category-resolver.ts`), con override
  `INVGATE_AUTOMATION_CATEGORY_ID`.
- **Workflow:** `WKF Automatizar Sucursal PRODUCTIVO`. `workflow_id = 609`; el
  `process_id` varía por versión del proceso (615, 616, 653 observados).
- **Colas (fallback):** helpdesk/nivel resueltos por nombre vía
  `queue-resolver.ts` (producción: 6409 / 6410). Override
  `INVGATE_AUTOMATION_GROUP_ID`.

## 2. Descubrimiento de padres

Fuente **autoritativa por categoría** (2026-10):

- **Vista guardada de InvGate** filtrada SOLO por la categoría (todos los
  estados), configurada con `INVGATE_AUTOMATION_VIEW_ID` (producción: **64**).
- `GET /incidents.by.view?view_id=64` → `{requestIds[]}` (sin `total`; se pagina
  por `offset` defensivamente).
- Se unen los IDs de la vista con los **trackeados** (persistidos) y se traen los
  detalles con `GET /incidents?ids[]=...` (chunks de 200, concurrencia 4).
- Filtro local `category_id === 3023`.

Sin vista configurada, el fallback escanea colas con
`GET /incidents.by.helpdesk?helpdesk_id=<nivel>`. El tracking persistido
(`automation_tracked_parents`) y el historial (`automation_parents`) cubren
padres reasignados o finalizados. Worker de reconciliación:
`scripts/reconcile-automation-parents.ts` (usa la vista si está configurada).

> Nota: **no existe** endpoint de incidencias por categoría (`incidents.by.category`
> no existe) y `incidents.by.status` ignora `category_id`; el filtro por categoría
> es siempre local.

## 3. Detalle de una automatización

`resolveAutomationDetail(id)` (`resolver.ts`), cacheado 2 min:

- `GET /incident.link?request_id=<padre>` → hijos vinculados.
- `GET /incidents?ids[]=<padre>&ids[]=<hijos>&comments=1` → datos + actividad.
- `GET /incident.tasks?request_id=<hijo>` → tareas internas (concurrencia 8).
- `GET /incident.comment?request_id=<hijo completado>` → solución (`is_solution`).
- `GET /wf.request?id=<padre>` → **initial fields + `current_variables_values`**.
- `GET /users?ids[]=...` → nombres de autores.
- `GET /incident.attributes.status` → nombres de estado (cache 24 h).

### Formulario inicial

`/wf.request` requiere permiso del usuario de API (antes devolvía 403).
`parseWorkflowInitialFields` extrae de `steps[].executions[].fields[]`:

| Campo | Variable / tipo | Extracción |
| --- | --- | --- |
| Jefe de Sucursal (nombre) | `users` — nombre en `value_label` | `workers-request.ts: "jefe de sucursal"` |
| Jefe de Sucursal (DNI/Legajo) | `paragraph` (tabla HTML) | regex `DNI` / `Legajo` |
| Jefe Zonal | `users` — nombre en `value_label` | label `jefe zonal` |
| NIS | `text` | label `nis` |

Otras fuentes del formulario: description del padre, primer comentario y (si no
hay ninguna) la prosa de un hijo "Instalaciones"/"TECO Instalaciones"
(`findInstalacionesChild` + `parseInstalacionesDescription`).

### Tablero Status Proyecto

Se alimenta de `current_variables_values` (misma respuesta, sin llamadas extra).
`parseWorkflowVariables` normaliza `nombre → valor` (usa `value_label` cuando el
`value` es numérico/hash) y `buildAutomationBoard` arma semáforos, links y datos
técnicos:

| Indicador portal | Variable(s) |
| --- | --- |
| Servidor | `EstadoServerMOA` |
| HandHeld | `EstadoHH` |
| Equipamiento (otro) | `EstadoOtroHW`, `EstadoSolicitudEquipamiento` |
| Red y cableado | `EstadoTecoInstalaciones` |
| Servicios M&F | `EstadoServiciosM&F` |
| CAI informado | `EstadoCAI` |
| Punto de venta | `EstadoPuntoDeVenta` |
| Carpeta BUI | `EstadoBUI` |
| Acción a tomar | `TableroGoNoGo` (`value_label`: "Avanzar" / "Actualizar") |

Links a hijos: `IDticketServerMOA`, `IDticketHH`, `IDticketEquipamiento`,
`IDticketServiciosMF`, `IDticketTECOinstalaciones`, `idTicketVisitaTecnico`,
`IDticketRecambio`. Datos técnicos: `Rango IPS`, `IPsAdicionales`,
`HostnamesAdicional`, `PuntoDeVenta`, `CarpetaBUI`, `Acceso VDIs a Rango IPs`,
`Fecha de Apertura`.

Semáforo (tono): verde para `Finalizado` / `Entregado` / `Realizado` / `Si` /
`Avanzar`; amarillo para `En proceso` / `Pendiente` / `No` / `Actualizar`;
neutro en el resto.

## 4. Formatos de título

- **Padre:** `AUTSUC <Sucursal> (B####)  <YYYY-MM-DD>` (la fecha es la estimada
  de implementación). Formato viejo: `Automatización de sucursal B#### - Nombre`.
- **Hijo nuevo:** `AUTSUC <Sucursal> (B####)  <gestión> #<id padre> <d mmm aaaa>`.
- **Hijo viejo:** `AUTSUC #<id> - <gestión>` / `<gestión> - Automatización SUC B####`.

`stripAutomationEmbeddedRefs` quita prefijo, `#<id>` y fecha; `parseEstimatedEndFromTitle`
extrae la fecha; `resolveNodeDisplayLabel` deriva la gestión y `stages.ts` la usa
para matchear los templates configurados (incluye aliases como `1-Equipamiento`,
`1.1-Equipamiento - Server`, etc.).

- **Equipamiento anidado:** dentro del ítem "Equipamiento (Prep y Despacho)", el
  ticket general (`1-Equipamiento`) es el padre y los sub-tickets (`1.1-…Server`,
  `1.2-…HH`, `1.3-…Otro HW`) se muestran anidados (`timeline-plan.ts`).
- **Tipos de ítem (`kind`)** en `workflow_stage_tickets`: `ticket` (default),
  `form` (se completa por formulario), `manual` (gestión de MDC) y `subprocess`
  (ticket de subproceso). `form`/`manual` no cuentan como faltantes ni muestran
  "Faltante"; se editan en `/admin/automatizaciones/etapas`. Producción: GDI/VDI
  y Hostnames = `form`; Alta en OfficeTrack, Mosaic, Configuraciones de Soporte
  Técnico y Revisión general = `manual`; Alta NIS en OnBase = `subprocess`
  (alias `Alta NIS`).

## 4.b Estado de espera de un nodo

El texto exacto "Esperando fecha …" que muestra la UI de InvGate **no se expone
por la API** (no hay `waiting_for` en el incidente, `custom_fields` vacío y sin
tareas). Lo que sí está disponible: el nombre del estado (`incident.attributes.status`,
p. ej. status 4 = "En espera") y, en la descripción del ticket, la fecha
programada ("programar instalaciones para el día 6 oct 2026"). El portal muestra
el nombre del estado en el badge y "Programada <fecha>" (`schedule.ts`:
`parseScheduledDate`).

## 4.c Datos manuales del portal

`automation_manual_data` guarda un override local por automatización (jefe,
zonal, DNI, legajo, Número de contacto, Franja horaria, notas). Se edita desde el
detalle ("Editar datos", admin) con la action `saveAutomationManualData` (RBAC
`automatizaciones` write + auditoría) y el resolver lo mezcla sobre el formulario
parseado (el manual gana). La franja horaria también se autoparsea de la prosa
("Horario: 10 a 17hs") como fallback. Igual que los cierres, no toca InvGate.

## 5. Cierre local (portal, no InvGate)

El portal puede finalizar un caso sin tocar InvGate (`automation_closures`):

- **Manual:** admin, con progreso ≥ `AUTOMATION_CLOSE_THRESHOLD` (default 80).
- **Automático:** al 100% sin etapas bloqueantes faltantes (oportunista, en el
  pipeline de detalle; se revierte si el progreso retrocede).
- Reabrir aplica solo a cierres manuales. Toda mutación invalida los caches de
  detalle y discovery y audita con `logAdminFromAstro`.

## 6. Persistencia en la DB del portal

InvGate es la fuente de verdad; el portal **no replica tickets**. La SQLite
(`database/mda.db`, Drizzle) guarda caches, historial y mutaciones locales:

| Tabla | PK | Qué guarda | Escribe | TTL/poda |
| --- | --- | --- | --- | --- |
| `invgate_cache` | `key` | Caches persistidos: categoría, colas, estados, snapshot de discovery, **detalle resuelto** (`automation.detail.<id>`), **tasks** (`automation.tasks.<id>`), **soluciones** (`automation.solution.<id>`), **usuarios** (`automation.users`), **sectores** (`automation.sector_map`) | resolvers/discovery | Por `expiresAt` |
| `automation_parents` | `automationId` | Historial completo de padres vistos (→ "Todas" y buscador) | discovery/reconcile | Nunca poda |
| `automation_tracked_parents` | `automationId` | Padres **activos** (recupera reasignados a otra mesa) | discovery/reconcile | Poda al finalizar |
| `automation_closures` | `automationId` | Cierre local (manual/auto) | actions + auto-cierre | Fila única; reabrir borra |
| `automation_manual_data` | `automationId` | Override manual (jefe/zonal/DNI/legajo/contacto/franja/notas) | action de edición | Fila única (upsert) |
| `workflow_stages` / `workflow_stage_tickets` | `id` | Plantilla de etapas (labels, aliases, `blocking`, `kind`) | seed + admin | Config |
| `audit_logs` | `id` | Auditoría de mutaciones | `logAdminFromAstro` | — |

Los timestamps de dominio se guardan en **segundos** (consistente con InvGate).

## 7. Presupuesto de API y caches

TTLs configurables por env (minutos):

```
AUTOMATION_DETAIL_TTL_MIN="15"        # snapshot del detalle
AUTOMATION_CHILD_CACHE_TTL_MIN="30"   # tasks/solutions por hijo
AUTOMATION_USERS_CACHE_TTL_MIN="1440" # usuarios y mapa de sectores
AUTOMATION_PROGRESS_TTL_MIN="2"       # progreso liviano del listado
INVGATE_METRICS="0"                    # 1 = loguea el conteo de llamadas
```

Capas: **memoria** (TTL corto, single-flight) → **SQLite** (`invgate_cache`,
sobrevive restarts y se comparte entre usuarios) → API. El progreso del listado
usa un pipeline **liviano** (`resolveAutomationProgress`: `incident.link` + bulk,
sin tasks/solutions/wf.request) y reusa el detalle/progreso persistido si existe;
al 100% dispara la pipeline de detalle en background para evaluar el auto-cierre.
El detalle persistido omite las fechas `createdAt/updatedAt` del template (drift
y peso). Los ids de autores que la API no devuelve se cachean como "ausentes"
(negative cache) para no re-pedirlos.

Medición real (caso de 7 hijos, `INVGATE_METRICS=1`):

| Escenario | Llamadas |
| --- | --- |
| Detalle cold (sin caches) | 13 (link 1, incidents 1, tasks 7, wf.request 1, users 1, helpdesks 1, levels 1) |
| Detalle cold con tasks/solutions cacheados | 4 |
| Detalle repetido (memoria) | 0 |
| Progreso (reusa detalle persistido) | 0 |
| Progreso cold (link+bulk) | 2 |

Discovery: `incidents.by.view` (1) + bulk (1) con la vista configurada; SWR 5–30 min.
Reconcile worker: usa la vista si `INVGATE_AUTOMATION_VIEW_ID` está seteada.

Otros caches: estados, categoría y colas 24 h; progreso de cards del listado en
`sessionStorage` (TTL 5 min).
