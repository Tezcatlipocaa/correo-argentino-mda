# Implementation Plan: Cálculo de Tiempo de Respuesta y Unificación de Campos en Mails Wise

## Phase 1: TDD & Metadata Parser Unit Tests
- [x] Task: Escribir tests unitarios para cálculo y formateo de tiempo de respuesta en `tests/unit/wiseEmailResponseTime.test.ts`
  - [x] Escribir tests para diferencias en segundos < 3600 (ej: 1154 seg -> `19:14`, 446 seg -> `07:26`, 998 seg -> `16:38`).
  - [x] Escribir tests para diferencias >= 3600 (formato `HH:MM:SS`, ej: 3665 seg -> `01:01:05`).
  - [x] Escribir tests para valores nulos, inválidos o fallback de `solved_at` a `closed_at` -> retorno por defecto `"00:00"`.
  - [x] Escribir test de `parseWiseEmailMetadata` asegurando que `duration` contenga el tiempo de respuesta calculado.
- [x] Task: Implementar lógica de cálculo en `src/lib/qualityMetadataFetcher.ts`
  - [x] Crear helper `calculateWiseEmailResponseTime(createdAt, solvedAt, closedAt)`.
  - [x] Actualizar `parseWiseEmailMetadata(caseData, operatorName)` para asignar `duration: calculateWiseEmailResponseTime(caseData?.created_at, caseData?.solved_at, caseData?.closed_at)`.
  - [x] Ejecutar `npm run test:unit -- tests/unit/wiseEmailResponseTime.test.ts` y verificar tests en verde.
- [x] Task: Phase Verification & Checkpoint (TDD en verde y paridad con ejemplos de Wise CX)

## Phase 2: UI/UX — Unificación en Modal y Visualización en Cards
- [x] Task: Actualizar `AuditModal.astro` para unificar y conmutar el campo "Respuesta"
  - [x] Configurar etiqueta dinámica para `meta-duration-container` entre "Duración" para llamadas y "Respuesta" para correos.
  - [x] Ajustar `onChannelChange` en `AuditModal.astro`:
    - [x] Ocultar `meta-creation-container` y `meta-take-container` cuando el canal sea `wise_email`.
    - [x] Mostrar `meta-duration-container` cuando el canal sea `wise_call` o `wise_email`.
    - [x] Conmutar label de input a "Respuesta" para `wise_email` y "Duración" para `wise_call`.
    - [x] No sobreescribir `formDuration.value` con `"00:00"` si el canal es `wise_email` y ya viene con el cálculo de la API.
  - [x] En la función de auto-llenado de metadatos del modal, vincular `d.duration` a `form-duration`.
- [x] Task: Actualizar `CalidadContent.astro` para la visualización en Cards y Edición
  - [x] En el render de tarjetas/filas de auditoría, para `call.channel === "wise_email"`, mostrar la métrica "Respuesta" con `call.duration || "00:00"`.
  - [x] Al abrir el modal en modo edición (`editQualityCall`), para `wise_email` cargar `callData.duration` en `form-duration`.
- [x] Task: Phase Verification & Checkpoint (Verificación manual de UI y coherencia visual)

## Phase 3: Verificación Final & Build
- [x] Task: Ejecutar suite de pruebas unitarias (`npm run test:unit -- tests/unit/`) y verificar build de producción (`npm run build`).
- [x] Task: Phase Verification & Checkpoint (Verificación integral sin errores de compilación ni regresiones)
