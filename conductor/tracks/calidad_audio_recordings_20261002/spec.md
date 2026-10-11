# Specification: Reproductor y Descarga de Grabaciones de Llamadas Wise CX en Auditorías de Calidad

## 1. Overview
Permitir a los auditores y supervisores de calidad escuchar directamente desde el Portal MDA las grabaciones de llamadas de Wise CX asociadas a los casos evaluados, además de habilitar la descarga del archivo MP3 y persistir el enlace en la base de datos para auditorías pasadas y futuras.

## 2. Functional Requirements
1. **Extracción de Grabación desde la API de Wise CX:**
   - En `fetchQualityCaseMetadata` y `fetchWiseCaseData` (`src/lib/qualityMetadataFetcher.ts`), solicitar el campo `recordings` al consultar las actividades de llamadas (`/core/v1/cases/:id/activities?fields=...,recordings`).
   - Extraer `recordingUrl` y `recordingId` de la actividad correspondiente e incluirlos en la respuesta estructurada de metadatos (`ExtractedQualityMetadata`).

2. **Persistencia en Base de Datos:**
   - Agregar columna opcional `recordingUrl: text("recording_url")` en la tabla `quality_audits` en `src/db/schema.ts`.
   - Modificar las acciones de creación y actualización de auditorías (`src/actions/index.ts`) para persistir `recordingUrl` cuando esté presente.
   - Ejecutar la alineación segura del esquema SQLite (`scripts/align-db-to-schema.mts`).

3. **Interfaz en Modal de Auditoría (`AuditModal.astro`):**
   - Cuando se consulta y carga una llamada de Wise CX que posee grabación de audio:
     - Mostrar un reproductor nativo HTML5 (`<audio controls>`) estilizado con tokens semánticos de DaisyUI / Tailwind.
     - Botón de descarga directa con icono de descarga (`boxicons:download`) que abra/descargue el archivo MP3.
     - Campo oculto en el formulario para enviar `recordingUrl` al guardar la auditoría.
   - Si no hay grabación disponible (o canal es mail/autogestión), ocultar el reproductor.

4. **Visualización en Historial de Auditorías (`CalidadContent.astro` o tabla de detalle):**
   - En el listado de auditorías realizadas, para aquellas de canal `wise_call` que posean `recording_url`:
     - Mostrar un icono/botón de audio que permita abrir/reproducir o descargar la grabación directamente.

## 3. Non-Functional & Security Requirements
- URLs externas provistas por Wise CX alojadas en AWS S3: abrir/descargar de forma segura con `rel="noopener noreferrer"`.
- Manejo de fallos en llamadas sin grabación o grabaciones archivadas (fallback limpio sin romper el modal ni la carga de metadatos).
- Compatibilidad completa con el estándar DaisyUI v5 y diseño móvil/escritorio sin estilos arbitrarios.

## 4. Acceptance Criteria
- [x] Consulta a API de Wise CX extrae correctamente la URL de la grabación (`.mp3`).
- [x] El modal de auditoría renderiza el reproductor `<audio>` funcional con reproducción y barra de progreso.
- [x] El botón de descarga permite bajar el archivo de audio.
- [x] Al guardar la auditoría, `recording_url` queda almacenada en SQLite.
- [x] En la tabla de auditorías se visualiza el acceso directo al audio para llamadas auditadas.
