# Plan: Consulta y Visualización del Creador/Generador en Detalle del Ticket InvGate

## Phase 1: Resolución en Backend y Pruebas Unitarias (TDD)
- [ ] Task: Actualizar y agregar pruebas unitarias en `tests/unit/invgate-ticket-metadata.test.ts`
  - [ ] Escribir tests que validen:
    - Resolución diferenciada cuando `user_id` (Solicitante) y `creator_id` (Creador) tienen IDs distintos.
    - Resolución eficiente cuando `user_id === creator_id`.
    - Presencia de `createdBy` y `customer` en el resultado de `fetchInvgateTicketMetadata`.
- [ ] Task: Implementar resolución de `creator_id` en `src/lib/qualityMetadataFetcher.ts`
  - [ ] Actualizar la interfaz `ExtractedQualityMetadata` para incluir `createdBy?: string` y `customer?: string`.
  - [ ] En `fetchInvgateTicketMetadata`, consultar `user?id=${incident.creator_id}` para obtener el nombre del generador.
  - [ ] En `parseInvgateAgMetadata`, mapear `createdBy` y mantener retrocompatibilidad en `creator`/`customer`.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Integración en Visor de Ticket en Vivo (Frontend)
- [ ] Task: Actualizar el marcado del Visor de Ticket en `src/components/supervision/calidad/AuditModal.astro`
  - [ ] Añadir celda destacada con ícono para "Creado por" (`#tv-created-by`) manteniendo la celda de "Solicitante".
  - [ ] Ajustar el grid (`grid-cols-2 md:grid-cols-3` o `lg:grid-cols-4`) para un layout equilibrado y legible.
- [ ] Task: Actualizar la función JS `populateTicketViewer` en `AuditModal.astro`
  - [ ] Extraer `createdBy` o `data.rawDetails?.createdBy` y poblar `#tv-created-by`.
  - [ ] Si no estuviera disponible, mostrar fallback `"Desconocido"` o el Solicitante si aplica.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
