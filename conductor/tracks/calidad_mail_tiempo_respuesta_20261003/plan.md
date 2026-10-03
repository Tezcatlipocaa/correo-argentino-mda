# Implementation Plan: Cálculo de Tiempo de Respuesta y Unificación de Campos en Mails Wise

## Phase 1: TDD & Metadata Parser Unit Tests
- [ ] Task: Escribir tests unitarios para cálculo y formateo de tiempo de respuesta en `tests/unit/wiseEmailResponseTime.test.ts`
  - [ ] Escribir tests para diferencias en segundos < 3600 (ej: 1154 seg -> `19:14`, 446 seg -> `07:26`, 998 seg -> `16:38`).
  - [ ] Escribir tests para diferencias >= 3600 (formato `HH:MM:SS`, ej: 3665 seg -> `01:01:05`).
  - [ ] Escribir tests para valores nulos, inválidos o fallback de `solved_at` a `closed_at` -> retorno por defecto `"00:00"`.
  - [ ] Escribir test de `parseWiseEmailMetadata` asegurando que `duration` contenga el tiempo de respuesta calculado.
- [ ] Task: Implementar lógica de cálculo en `src/lib/qualityMetadataFetcher.ts`
  - [ ] Crear helper `calculateWiseEmailResponseTime(createdAt, solvedAt, closedAt)`.
  - [ ] Actualizar `parseWiseEmailMetadata(caseData, operatorName)` para asignar `duration: calculateWiseEmailResponseTime(caseData?.created_at, caseData?.solved_at, caseData?.closed_at)`.
  - [ ] Ejecutar `npm run test:unit -- tests/unit/wiseEmailResponseTime.test.ts` y verificar tests en verde.
- [ ] Task: Phase Verification & Checkpoint (TDD en verde y paridad con ejemplos de Wise CX)

## Phase 2: UI/UX — Unificación en Modal y Visualización en Cards
- [ ] Task: Actualizar `AuditModal.astro` para unificar y conmutar el campo "Respuesta"
  - [ ] Configurar etiqueta dinámica para `meta-duration-container` entre "Duración" para llamadas y "Respuesta" para correos.
  - [ ] Ajustar `onChannelChange` en `AuditModal.astro`:
    - [ ] Ocultar `meta-creation-container` y `meta-take-container` cuando el canal sea `wise_email`.
    - [ ] Mostrar `meta-duration-container` cuando el canal sea `wise_call` o `wise_email`.
    - [ ] Conmutar label de input a "Respuesta" para `wise_email` y "Duración" para `wise_call`.
    - [ ] No sobreescribir `formDuration.value` con `"00:00"` si el canal es `wise_email` y ya viene con el cálculo de la API.
  - [ ] En la función de auto-llenado de metadatos del modal, vincular `d.duration` a `form-duration`.
- [ ] Task: Actualizar `CalidadContent.astro` para la visualización en Cards y Edición
  - [ ] En el render de tarjetas/filas de auditoría, para `call.channel === "wise_email"`, mostrar la métrica "Respuesta" con `call.duration || "00:00"`.
  - [ ] Al abrir el modal en modo edición (`editQualityCall`), para `wise_email` cargar `callData.duration` en `form-duration`.
- [ ] Task: Phase Verification & Checkpoint (Verificación manual de UI y coherencia visual)

## Phase 3: Verificación Final & Build
- [ ] Task: Ejecutar suite de pruebas unitarias (`npm run test:unit -- tests/unit/`) y verificar build de producción (`npm run build`).
- [ ] Task: Phase Verification & Checkpoint (Verificación integral sin errores de compilación ni regresiones)
