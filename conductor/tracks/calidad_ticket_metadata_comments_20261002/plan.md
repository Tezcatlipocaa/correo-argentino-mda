# Implementation Plan: Bug Fixes — Tickets InvGate (Caracteres y Metadatos) y Comentarios de Calidad

## Phase 1: Decodificación Universal de Entidades HTML
- [ ] Task: TDD - Crear pruebas unitarias para decodificación de entidades HTML
  - [ ] Escribir tests en `tests/unit/html-decoding.test.ts` con casos hexadecimales (`&#xED;`, `&#xE9;`, `&#xF3;`), decimales y named entities
  - [ ] Confirmar que los tests fallen antes de implementar (Red Phase)
- [ ] Task: Implementar decodificador universal en `cleanHtmlText`
  - [ ] Actualizar `cleanHtmlText` en `src/lib/titleNormalizer.ts` para decodificar entidades hex y decimales
  - [ ] Ejecutar tests y confirmar que pasen (Green Phase)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Resolución Integral de Metadatos de Ticket InvGate
- [ ] Task: TDD - Crear pruebas unitarias para mapeo de metadatos de ticket InvGate
  - [ ] Escribir tests en `tests/unit/invgate-ticket-metadata.test.ts` para validar mapeo de `status_id`, `priority_id`, `user_id` y `category_id`
  - [ ] Confirmar que los tests fallen antes de implementar (Red Phase)
- [ ] Task: Implementar resolución de campos en `qualityMetadataFetcher.ts`
  - [ ] Agregar mapeo de estados InvGate (`STATUS_NAMES`) y prioridades (`PRIORITY_NAMES`)
  - [ ] Implementar resolución de cliente (`user?id=...`), operador asignado (`user?id=...`) y categoría
  - [ ] Integrar fallbacks seguros si la API no responde o datos son nulos
  - [ ] Ejecutar tests y confirmar que pasen (Green Phase)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Mejoras Visuales, Visibilidad y Persistencia de Comentarios por Parámetro
- [ ] Task: TDD - Pruebas de integración para persistencia y lectura de comentarios por parámetro
  - [ ] Validar que los comentarios se persistan y recuperen correctamente junto a cada score
- [ ] Task: Actualizar UI de inputs de comentario en `AuditModal.astro`
  - [ ] Reemplazar `input-xs text-xxs` por `input-sm text-xs` con padding cómodo y bordes suaves
- [ ] Task: Exponer y renderizar comentarios en tarjetas de detalle (`CalidadContent.astro`)
  - [ ] Incluir comentarios en el mapping de scores de `CalidadContent.astro`
  - [ ] Mostrar bloque de comentario estilizado debajo de cada parámetro en la tarjeta de auditoría
- [ ] Task: Sincronizar comentarios en modo edición y reseteo en nueva auditoría
  - [ ] Precargar los valores de `_comment` al abrir una auditoría existente en el modal
  - [ ] Limpiar los campos de comentario al crear una nueva auditoría
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
