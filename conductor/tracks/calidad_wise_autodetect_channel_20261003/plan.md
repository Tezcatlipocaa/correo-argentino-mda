# Implementation Plan: Auto-detección y Conmutación de Canal (Llamada vs Mail) en Búsqueda Wise CX

## Phase 1: TDD & Metadata Fetcher Logic
- [x] Task: Escribir tests unitarios para detección de canal Wise en `tests/unit/wiseChannelAutodetect.test.ts`
  - [x] Test para discernimiento de canal a partir de `source_channel` (`"email"` -> `"wise_email"`, `"incoming_call"` / `"outgoing_call"` / `"call"` -> `"wise_call"`).
  - [x] Test asegurando que `fetchQualityCaseMetadata` o el parser asigne `detectedChannel` adecuadamente cuando el canal solicitado difiere del real del caso.
- [x] Task: Implementar detección y resolución dinámica de canal en `src/lib/qualityMetadataFetcher.ts`
  - [x] Crear helper `discernWiseChannel(sourceChannel?: string): ChannelType`.
  - [x] En `fetchQualityCaseMetadata`, al obtener `caseData`, evaluar `discernWiseChannel(caseData.source_channel)`. Si difiere del canal solicitado (o si se invoca de manera genérica para Wise), procesar con la lógica del canal detectado y retornar `detectedChannel`.
  - [x] Ejecutar `npm run test:unit -- tests/unit/wiseChannelAutodetect.test.ts` y validar tests en verde.
- [x] Task: Phase Verification & Checkpoint (TDD en verde y detección correcta en backend)

## Phase 2: Frontend — Conmutación Automática en Modal de Auditoría
- [x] Task: Actualizar `AuditModal.astro` para procesar `detectedChannel`
  - [x] En el handler del botón `btnFetchWise`, inspeccionar `d.detectedChannel`.
  - [x] Si `d.detectedChannel` está presente y es distinto de `formChannelType.value`:
    - [x] Conmutar la pestaña activa ejecutando el click en `.channel-btn[data-channel="${d.detectedChannel}"]`.
    - [x] Mostrar feedback informativo en `wiseFeedbackAlert` indicando que el caso fue detectado como Llamada/Mail y el canal fue conmutado automáticamente.
  - [x] Poblar los datos del caso en el formulario ya adaptado al canal detectado.
- [x] Task: Phase Verification & Checkpoint (Verificación manual de UI y conmutación fluida en ambas direcciones)

## Phase 3: Verificación Final & Build
- [x] Task: Ejecutar suite de pruebas unitarias (`npm run test:unit -- tests/unit/`) y verificar build de producción (`npm run build`).
- [x] Task: Phase Verification & Checkpoint (Verificación integral sin errores de compilación ni regresiones)
