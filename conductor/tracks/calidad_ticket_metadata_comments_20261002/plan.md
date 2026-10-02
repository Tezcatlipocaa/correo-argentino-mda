# Implementation Plan: Bug Fixes — Tickets InvGate (Caracteres y Metadatos) y Comentarios de Calidad

## Phase 1: Decodificación Universal de Entidades HTML [checkpoint: de8bfd8]
- [x] Task: TDD - Crear pruebas unitarias para decodificación de entidades HTML [de8bfd8]
  - [x] Escribir tests en `tests/unit/html-decoding.test.ts` con casos hexadecimales (`&#xED;`, `&#xE9;`, `&#xF3;`), decimales y named entities [de8bfd8]
  - [x] Confirmar que los tests fallen antes de implementar (Red Phase) [de8bfd8]
- [x] Task: Implementar decodificador universal en `cleanHtmlText` [de8bfd8]
  - [x] Actualizar `cleanHtmlText` en `src/lib/titleNormalizer.ts` para decodificar entidades hex y decimales [de8bfd8]
  - [x] Ejecutar tests y confirmar que pasen (Green Phase) [de8bfd8]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [de8bfd8]

## Phase 2: Resolución Integral de Metadatos de Ticket InvGate [checkpoint: 1ecb018]
- [x] Task: TDD - Crear pruebas unitarias para mapeo de metadatos de ticket InvGate [1ecb018]
  - [x] Escribir tests en `tests/unit/invgate-ticket-metadata.test.ts` para validar mapeo de `status_id`, `priority_id`, `user_id` y `category_id` [1ecb018]
  - [x] Confirmar que los tests fallen antes de implementar (Red Phase) [1ecb018]
- [x] Task: Implementar resolución de campos en `qualityMetadataFetcher.ts` [1ecb018]
  - [x] Agregar mapeo de estados InvGate (`STATUS_NAMES`) y prioridades (`PRIORITY_NAMES`) [1ecb018]
  - [x] Implementar resolución de cliente (`user?id=...`), operador asignado (`user?id=...`) y categoría [1ecb018]
  - [x] Integrar fallbacks seguros si la API no responde o datos son nulos [1ecb018]
  - [x] Ejecutar tests y confirmar que pasen (Green Phase) [1ecb018]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [1ecb018]

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
