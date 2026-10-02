# Implementation Plan: Reproductor y Descarga de Grabaciones de Llamadas Wise CX en Auditorías de Calidad

## Phase 1: Extensión de Metadatos y Base de Datos (TDD)
- [x] Task: Escribir tests unitarios que verifiquen extracción de `recordingUrl` y `recordingId` desde `parseWiseCallMetadata` en `tests/unit/quality-metadata.test.ts`.
- [x] Task: Actualizar interfaz `ExtractedQualityMetadata` y función `parseWiseCallMetadata` en `src/lib/qualityMetadataFetcher.ts` para extraer `recordings`.
- [x] Task: Actualizar llamada a API en `fetchQualityCaseMetadata` para solicitar `fields=...,recordings`.
- [x] Task: Añadir columna opcional `recordingUrl: text("recording_url")` en tabla `quality_audits` en `src/db/schema.ts`.
- [x] Task: Ejecutar script de alineación de base de datos (`npx tsx scripts/align-db-to-schema.mts`).
- [x] Task: Actualizar acción `saveAudit` en `src/actions/index.ts` para aceptar y persistir `recordingUrl`.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md).

## Phase 2: Interfaz en Modal de Auditoría (`AuditModal.astro`)
- [x] Task: Agregar contenedor de reproductor de audio `<audio controls>` con estilizado DaisyUI v5 y botón de descarga directa (`<a>` con icono `boxicons:download`) en `AuditModal.astro`.
- [x] Task: Agregar input hidden `name="recordingUrl"` en el formulario `#audit-form` de `AuditModal.astro`.
- [x] Task: Conectar respuesta del buscador Wise (`btn-fetch-wise-api`) para alimentar el reproductor de audio y el input hidden cuando la llamada tenga grabación.
- [x] Task: Conectar carga en modo edición/visualización de auditoría existente para inicializar el reproductor si `audit.recordingUrl` existe.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md).

## Phase 3: Visualización de Audio en Historial y Listado (`CalidadContent.astro`)
- [x] Task: En la tabla de auditorías detalladas del operador en `CalidadContent.astro`, incorporar columna o icono/botón de reproducción/descarga para llamadas con `recordingUrl`.
- [x] Task: Ejecutar suite de pruebas unitarias (`npx vitest run`) y verificar que todos los tests pasen sin regresiones.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md).
