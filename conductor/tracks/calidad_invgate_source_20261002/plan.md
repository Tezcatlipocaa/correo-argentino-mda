# Implementation Plan: Consulta de Origen de Solicitud (Source) en Tickets InvGate

## Phase 1: Test Failing First & Model Extension (TDD Red Phase)
- [x] Task: Actualizar tests E2E y modelos con la expectativa de Origen de Solicitud
  - [x] Extender `ExtractedQualityMetadata` en `src/lib/qualityMetadataFetcher.ts` con `source?: string;`
  - [x] Agregar aserción en `tests/calidad-multicanal-interaction.spec.ts` para verificar `#tv-source` con valor "Teléfono" tras la búsqueda de ticket InvGate
  - [x] Ejecutar prueba con Playwright para confirmar que falla en la aserción de `#tv-source` (Red)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Backend Resolution of Incident Source (TDD Green Phase)
- [x] Task: Implementar resolución de Source en `src/lib/qualityMetadataFetcher.ts`
  - [x] Agregar diccionario `INVGATE_SOURCE_NAMES` con mapeo de orígenes habituales
  - [x] En `parseInvgateAgMetadata`: resolver `sourceName` a partir de `extra`, `incident.source?.name` o `incident.source_id`
  - [x] En `fetchInvgateTicketMetadata`: resolver origen del incidente con fallback seguro
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Frontend Integration in Live Ticket Viewer
- [x] Task: Agregar tarjeta de Origen en la cuadrícula de metadatos de `AuditModal.astro`
  - [x] Añadir bloque `#tv-source` en la grilla con ícono representativo y layout balanceado
  - [x] Vincular `#tv-source` en el script del modal (`populateTicketViewer` y `resetTicketViewer`)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Full Automated Verification & Build Check
- [x] Task: Ejecución integral de suite de pruebas y compilación SSR
  - [x] Correr `npx playwright test tests/calidad-multicanal-interaction.spec.ts` (Green)
  - [x] Correr `npm run build` para certificar SSR manifest y tipos TypeScript
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
