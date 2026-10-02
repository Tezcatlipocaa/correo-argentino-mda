# Implementation Plan: Consulta de Mesa de Ayuda (Helpdesk) en Tickets InvGate

## Phase 1: Test Failing First & Model Extension (TDD Red Phase)
- [ ] Task: Actualizar tests E2E y modelos con la expectativa de Mesa de Ayuda
  - [ ] Extender `ExtractedQualityMetadata` en `src/lib/qualityMetadataFetcher.ts` con `helpdesk?: string;`
  - [ ] Agregar aserción en `tests/calidad-multicanal-interaction.spec.ts` para verificar `#tv-helpdesk` con valor "Mesa de Ayuda TI" tras la búsqueda
  - [ ] Ejecutar prueba con Playwright para confirmar que falla en la aserción de `#tv-helpdesk` (Red)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Backend Resolution of Helpdesk in InvGate Metadata (TDD Green Phase)
- [ ] Task: Implementar resolución de Helpdesk en `src/lib/qualityMetadataFetcher.ts`
  - [ ] Extraer `incident.helpdesk?.name` o `incident.helpdesk` si está disponible
  - [ ] Implementar resolución auxiliar con `invgateGet("helpdesks")` en caso de solo poseer `helpdesk_id` numérico
  - [ ] Asignar `helpdeskName` a `parseInvgateAgMetadata()` retornándolo en el payload
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Frontend Integration in Live Ticket Viewer
- [ ] Task: Agregar tarjeta de Mesa de Ayuda en el Visor de Ticket del modal (`src/components/supervision/calidad/AuditModal.astro`)
  - [ ] Añadir bloque `#tv-helpdesk` en la grilla de metadatos con ícono representativo y estilos estándar
  - [ ] Conectar `#tv-helpdesk` en `populateTicketViewer()` y `resetTicketViewer()`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Full Automated Verification & Build Check
- [ ] Task: Ejecución integral de suite de pruebas y compilación SSR
  - [ ] Correr `npx playwright test tests/calidad-multicanal-interaction.spec.ts` (Green)
  - [ ] Correr `npm run build` para certificar SSR manifest y tipos TypeScript
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
