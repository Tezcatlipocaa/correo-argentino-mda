# Implementation Plan: Auto-evaluación Asistida del Origen del Ticket InvGate

## Phase 1: Test Failing First (TDD Red Phase)
- [ ] Task: Crear casos de prueba para auto-evaluación de origen en `tests/calidad-multicanal-interaction.spec.ts`
  - [ ] Añadir prueba para origen no coincidente (ej. ticket con origen "Correo" o "Portal Web" consultado en canal `wise_call`), verificando desmarcado de `call_ticket_origen`, presencia del badge de regla "Origen incorrecto" y recálculo del score
  - [ ] Ejecutar prueba con Playwright para confirmar que falla en la aserción de auto-desmarcado / badge (Red)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Implementation of Source Evaluation Rule (TDD Green Phase)
- [ ] Task: Implementar regla `evaluateTicketSource` y badges en `src/components/supervision/calidad/AuditModal.astro`
  - [ ] Agregar badge container `#tv-source-match-badge` en la tarjeta de Origen del Visor de Ticket
  - [ ] Implementar la función `evaluateTicketSource(sourceStr)` para canales `wise_call` y `wise_email`
  - [ ] Integrar `evaluateTicketSource` en `populateTicketViewer()` y su limpieza en `resetTicketViewer()`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Full Automated Verification & Build Check
- [ ] Task: Ejecución integral de suite de pruebas y compilación SSR
  - [ ] Correr `npx playwright test tests/calidad-multicanal-interaction.spec.ts` (Green)
  - [ ] Correr `npm run build` para certificar SSR manifest y tipos TypeScript
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
