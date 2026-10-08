# Implementation Plan: Unificación de Búsqueda API en Campos de Atención y Enlace Directo InvGate

## Phase 1: Estructura UI y Markup en Datos de la Atención
- [ ] Task: Preparar obtención de URL base de InvGate en el cliente (data-attribute en AuditModal)
- [ ] Task: Reemplazar `unified-search-card` y rediseñar campos `callId` y `ticketId` en `AuditModal.astro` como input groups con botones de búsqueda y enlace directo
- [ ] Task: Ubicar contenedores de alertas/feedback en la sección de datos de atención
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Lógica Cliente y Eventos de Búsqueda
- [ ] Task: Migrar listeners de búsqueda de Wise CX hacia `form-call-id` y su botón, con soporte de tecla `Enter` y spinner
- [ ] Task: Migrar listeners de búsqueda de InvGate hacia `form-ticket-id` y su botón, con soporte de tecla `Enter` y spinner
- [ ] Task: Implementar lógica reactiva para el botón de enlace directo a InvGate (`input` event y tras fetch exitoso)
- [ ] Task: Limpiar referencias en desuso a tabs e inputs eliminados de `unified-search-card`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Verificación Integral E2E y Regresiones
- [ ] Task: Verificar carga de modal en modo llamada, mail y ticket
- [ ] Task: Probar búsqueda con `Enter` y botones en ambos campos
- [ ] Task: Probar enlace directo a InvGate
- [ ] Task: Verificar que el formulario no envíe submit involuntario al presionar `Enter`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
