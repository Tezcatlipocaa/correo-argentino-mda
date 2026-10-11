# Plan de Implementación: Buscador Dual, Visor de Ticket y Auditoría Asistida de Títulos

## Phase 1: API & Extracción de Metadatos Ampliados (Wise CX e InvGate)
- [x] Task: Escribir tests unitarios para extracción de metadatos completos de InvGate (Título, Categoría, Prioridad, Estado, Solicitante, Descripción)
  - [x] Escribir tests en `tests/unit/quality-metadata.test.ts` para nuevos campos de detalle
  - [x] Verificar fallo de tests (Red Phase)
- [x] Task: Actualizar `src/lib/qualityMetadataFetcher.ts` y el endpoint `/api/calidad/fetch-metadata`
  - [x] Ampliar `parseInvgateAgMetadata` para extraer descripción, solicitante, categoría y estado
  - [x] Soportar consultas específicas directas por canal/fuente (`wise` o `invgate`)
  - [x] Ejecutar tests unitarios y verificar éxito (Green Phase)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Lógica de Auditoría Asistida & Validación de Títulos
- [x] Task: Escribir tests unitarios para validación de títulos contra catálogo homologado
  - [x] Crear suite de pruebas `tests/unit/quality-title-matcher.test.ts`
  - [x] Probar coincidencia exacta, normalizada (sin acentos, minúsculas, espacios) y discrepancias
  - [x] Verificar fallo de tests (Red Phase)
- [x] Task: Implementar módulo de validación de títulos (`src/lib/qualityTitleMatcher.ts`)
  - [x] Función `matchApprovedTitle(ticketTitle, approvedTitlesList)`
  - [x] Consulta eficiente al catálogo de `titles` del sistema
  - [x] Ejecutar tests unitarios y verificar éxito (Green Phase)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Interfaz de Usuario (Buscador Dual, Visor de Ticket y Validación Visual)
- [x] Task: Actualizar la barra de búsqueda en `src/components/supervision/calidad/AuditModal.astro`
  - [x] Implementar dos buscadores independientes con botones propios (Wise CX e InvGate) adaptativos por canal
  - [x] Vincular eventos de búsqueda independientes con estados de carga y feedback de error aislados
- [x] Task: Implementar el Visor de Ticket / Caso en vivo en el modal
  - [x] Crear tarjeta de visualización (DaisyUI card/accordion) con Título, Categoría, Prioridad, Estado, Solicitante y Descripción
  - [x] Diseñar estado vacío / placeholder inicial
- [x] Task: Integrar la auto-evaluación visual del parámetro "Título"
  - [x] Al resolver el ticket, evaluar el título automáticamente con `qualityTitleMatcher`
  - [x] Auto-marcar/desmarcar el checkbox de "Título" mostrando badge de estado (`✓ Homologado` / `⚠ No homologado`)
  - [x] Permitir ajuste manual libre por parte del auditor
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Integración E2E, Regresión y Verificación Final
- [x] Task: Escribir y ejecutar prueba E2E de Playwright
  - [x] Actualizar/crear test en `tests/calidad-multicanal-interaction.spec.ts` verificando búsqueda dual, renderizado del visor y comportamiento de auto-evaluación
  - [x] Ejecutar `npx playwright test`
- [x] Task: Ejecutar suite de pruebas completa y gates de calidad
  - [x] Ejecutar `npx vitest run` (todos los tests de calidad pasando)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
