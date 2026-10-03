# Plan de Implementación: Bugfix & Mejoras — Calidad Multi-Canal

## Fase 1: Fixes Críticos de Runtime

> Sin estos fixes, el feature no funciona en absoluto.

- [x] Task: Fix `await` faltante en `fetch-metadata.ts` (C1)
  - [x] Agregar `await` a `requireWriteAccess(locals, "calidad")` en línea 8
  - [x] Agregar try/catch global con `jsonError` como safety net

- [x] Task: Fix imports faltantes en `actions/index.ts` (C2, C3)
  - [x] Agregar `and` al import de `drizzle-orm`
  - [x] Agregar `calculateMultiChannelAuditScores` al import de `@lib/qualityCalculator`

- [x] Task: Fix endpoint InvGate en `qualityMetadataFetcher.ts` (C5)
  - [x] Cambiar `incidents/${cleanId}` → `incident?id=${cleanId}&date_format=iso8601`
  - [x] Fix parseo de `created_at` para soportar epoch numérico (A1)

- [x] Task: Fix scoring matemático de `wise_call` (C4)
  - [x] En `qualityCalculator.ts`: implementar ponderación 45/55 para `wise_call`
  - [x] En `AuditModal.astro` script: replicar misma lógica en `recalculateScores()` (M3)

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Fase 2: Fixes de Lógica (Alta Prioridad)

> Corrigen comportamiento incorrecto en guardado y configuración.

- [x] Task: Fix `saveAudit` — scores fantasmas de Sección 2 (A2)
  - [x] Filtrar parámetros de Sección 2 cuando `appliesMda=false` o `staysInMda=false`

- [x] Task: Fix validación dinámica del formulario (A5)
  - [x] Quitar `required` estático de `callId` en `AuditModal.astro`
  - [x] Validar por script según canal activo: llamada→callId, AG→ticketId

- [x] Task: Fix `saveParameters` para multi-canal (A3)
  - [x] Agregar `channel` y `section` al schema Zod de `saveParameters`
  - [x] Pasar `channel`/`section` en el insert

- [x] Task: Actualizar modal de configuración de parámetros (A4)
  - [x] Agregar selector de canal al modal de parámetros en `CalidadContent.astro`
  - [x] Filtrar parámetros mostrados por canal seleccionado
  - [x] Enviar `channel`/`section` al guardar

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Fase 3: Fixes de UX y Estadísticas (Media Prioridad)

> Corrigen cálculos, indicadores y flujo de usuario.

- [x] Task: Fix cálculo de cuota mensual (M4)
  - [x] Cambiar `audits.length/12` → `Math.min(calls,4)+Math.min(emails,4)+Math.min(ags,4)` sobre 12

- [x] Task: Fix estadísticas del panel de operador (M5, M6)
  - [x] AHT: filtrar solo `wise_call` con duración > 00:00
  - [x] Promedio Sección 2: excluir auditorías donde no aplica

- [x] Task: Fix reseteo de modal al abrir nueva auditoría (M7, M1)
  - [x] Resetear toggles `appliesMda`/`staysMda` al abrir modal nuevo
  - [x] Limpiar metadatos al cambiar de tab de canal

- [x] Task: Fix autofill de `ticketId` en llamadas (M2)
  - [x] Solo asignar `ticketId` si `rawDetails.incidentId` existe o canal es `invgate_ticket`

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Fase 4: Polish y Completitud (Baja Prioridad)

- [x] Task: Mejorar exportación CSV (B1)
  - [x] Agregar columna "Canal" y metadatos: `ringTime`, `creationTime`, `takeTime`, `isPas`

- [x] Task: Fix campos condicionales del modal (B2)
  - [x] Ocultar campo duración en mails/AG
  - [x] Agregar listener Enter en input de búsqueda

- [x] Task: Fix tipo `weight` en `quality.ts` (B3)
  - [x] Cambiar `weight: number` → `weight: number | null`

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
