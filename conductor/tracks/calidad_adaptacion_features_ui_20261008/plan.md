# Implementation Plan: Adaptación e Integración de Features de Calidad en Refactor de UI

## Phase 1: Consolidación Git y Resolución de Conflictos Base
- [ ] Task: Preparar rama de integración e incorporar commits de `origin/calidad` en `refactor/UI`
    - [ ] Realizar merge controlado de `origin/calidad` en `refactor/UI`
    - [ ] Resolver conflictos preservando la arquitectura modular de UI (`CalidadContent`, `NewAuditForm`, `OperatorDetailsPanel`) y la lógica de backend/scripts de `calidad`
    - [ ] Ejecutar comprobación de sintaxis y tipos con TypeScript (`astro check` o `npm run build`)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Paridad y Adaptación de Features en Formularios (`NewAuditForm` y `AuditModal`)
- [ ] Task: Integrar selector Reclamo / Novedad y cálculo dinámico de puntuación en `NewAuditForm.astro`
    - [ ] Incorporar selector de modo Ticket Nuevo vs Reclamo / Novedad en llamadas y correos Wise CX
    - [ ] Sincronizar cálculo de scores (sección 2 al 100% en Reclamo/Novedad) y asegurar persistencia de `is_reclamo_novedad`
- [ ] Task: Integrar búsqueda directa en inputs y deep-link a InvGate
    - [ ] Integrar botón de búsqueda en `#form-call-id` (Wise CX) y `#form-ticket-id` (InvGate) con soporte Enter
    - [ ] Incorporar feedback de validación de operador y deep-link al ticket
- [ ] Task: Integrar controles de selección masiva (Tildar / Destildar todo)
    - [ ] Añadir controles por sección con feedback visual y actualización automática del score
- [ ] Task: Garantizar paridad en `AuditModal.astro` para visualización y edición inline
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Integración en Barra Superior, Exportación y Panel de Operador
- [ ] Task: Integrar exportación Excel (.xlsx) y CSV enriquecido en la barra superior unificada
    - [ ] Conectar acciones de descarga nativa Excel multi-hoja en la barra de herramientas de `CalidadContent.astro`
    - [ ] Asegurar que el botón global "Nueva Auditoría" dirija correctamente a `/supervision/calidad-operadores/nueva`
- [ ] Task: Conectar `OperatorDetailsPanel.astro` con `AuditModal` para ver/editar auditorías históricas
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Verificación Integral, Pruebas y Cierre
- [ ] Task: Ejecutar suite de pruebas unitarias relevantes (`npm run test:unit -- tests/unit`)
- [ ] Task: Ejecutar pruebas E2E de calidad (`npx playwright test tests/calidad-*.spec.ts`)
- [ ] Task: Ejecutar build SSR de producción para verificar manifest y bundles (`npm run build`)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
