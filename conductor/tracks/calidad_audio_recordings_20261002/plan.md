# Implementation Plan: Reproductor y Descarga de Grabaciones de Llamadas Wise CX en Auditorías de Calidad

## Phase 1: Extensión de Metadatos y Base de Datos (TDD)
- [ ] Task: Escribir tests unitarios que verifiquen extracción de `recordingUrl` y `recordingId` desde `parseWiseCallMetadata` en `tests/unit/quality-metadata.test.ts`.
- [ ] Task: Actualizar interfaz `ExtractedQualityMetadata` y función `parseWiseCallMetadata` en `src/lib/qualityMetadataFetcher.ts` para extraer `recordings`.
- [ ] Task: Actualizar llamada a API en `fetchQualityCaseMetadata` para solicitar `fields=...,recordings`.
- [ ] Task: Añadir columna opcional `recordingUrl: text("recording_url")` en tabla `quality_audits` en `src/db/schema.ts`.
- [ ] Task: Ejecutar script de alineación de base de datos (`npx tsx scripts/align-db-to-schema.mts`).
- [ ] Task: Actualizar acción `saveAudit` en `src/actions/index.ts` para aceptar y persistir `recordingUrl`.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md).

## Phase 2: Interfaz en Modal de Auditoría (`AuditModal.astro`)
- [ ] Task: Agregar contenedor de reproductor de audio `<audio controls>` con estilizado DaisyUI v5 y botón de descarga directa (`<a>` con icono `boxicons:download`) en `AuditModal.astro`.
- [ ] Task: Agregar input hidden `name="recordingUrl"` en el formulario `#audit-form` de `AuditModal.astro`.
- [ ] Task: Conectar respuesta del buscador Wise (`btn-fetch-wise-api`) para alimentar el reproductor de audio y el input hidden cuando la llamada tenga grabación.
- [ ] Task: Conectar carga en modo edición/visualización de auditoría existente para inicializar el reproductor si `audit.recordingUrl` existe.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md).

## Phase 3: Visualización de Audio en Historial y Listado (`CalidadContent.astro`)
- [ ] Task: En la tabla de auditorías detalladas del operador en `CalidadContent.astro`, incorporar columna o icono/botón de reproducción/descarga para llamadas con `recordingUrl`.
- [ ] Task: Ejecutar suite de pruebas unitarias (`npx vitest run`) y verificar que todos los tests pasen sin regresiones.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md).
