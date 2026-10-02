# Implementation Plan: Consulta de Origen de Solicitud (Source) en Tickets InvGate

## Phase 1: Test Failing First & Model Extension (TDD Red Phase)
- [ ] Task: Actualizar tests E2E y modelos con la expectativa de Origen de Solicitud
  - [ ] Extender `ExtractedQualityMetadata` en `src/lib/qualityMetadataFetcher.ts` con `source?: string;`
  - [ ] Agregar aserción en `tests/calidad-multicanal-interaction.spec.ts` para verificar `#tv-source` con valor "Teléfono" tras la búsqueda de ticket InvGate
  - [ ] Ejecutar prueba con Playwright para confirmar que falla en la aserción de `#tv-source` (Red)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Backend Resolution of Incident Source (TDD Green Phase)
- [ ] Task: Implementar resolución de Source en `src/lib/qualityMetadataFetcher.ts`
  - [ ] Agregar diccionario `INVGATE_SOURCE_NAMES` con mapeo de orígenes habituales
  - [ ] En `parseInvgateAgMetadata`: resolver `sourceName` a partir de `extra`, `incident.source?.name` o `incident.source_id`
  - [ ] En `fetchInvgateTicketMetadata`: resolver origen del incidente con fallback seguro
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Frontend Integration in Live Ticket Viewer
- [ ] Task: Agregar tarjeta de Origen en la cuadrícula de metadatos de `AuditModal.astro`
  - [ ] Añadir bloque `#tv-source` en la grilla con ícono representativo y layout balanceado
  - [ ] Vincular `#tv-source` en el script del modal (`populateTicketViewer` y `resetTicketViewer`)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Full Automated Verification & Build Check
- [ ] Task: Ejecución integral de suite de pruebas y compilación SSR
  - [ ] Correr `npx playwright test tests/calidad-multicanal-interaction.spec.ts` (Green)
  - [ ] Correr `npm run build` para certificar SSR manifest y tipos TypeScript
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
