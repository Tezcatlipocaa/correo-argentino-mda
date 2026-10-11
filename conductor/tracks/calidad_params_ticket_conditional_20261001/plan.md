# Plan de Implementación: Parámetros de Calidad y Condicional de Ticket en Llamadas y Mails

## Phase 1: Configuración de Parámetros y Motor de Cálculo (TDD)
- [x] Task: Escribir pruebas unitarias en `tests/unit/quality-calculator.test.ts` y `tests/unit/quality-multicanal.test.ts`
  - [x] Validar lista canónica de parámetros en `WISE_CALL_PARAMETERS` (10 en Atención, 8 en Ticket; sin Solicitud ni Reclamo/Novedad)
  - [x] Validar exclusión de `email_mda_reclamo_novedad` en `WISE_EMAIL_PARAMETERS`
  - [x] Validar cálculo de `calculateMultiChannelAuditScores` para `wise_call` cuando `hasSection2 = false` (puntaje 100% sobre base 45 de Atención)
  - [x] Ejecutar tests y verificar fallo (Red Phase)
- [x] Task: Actualizar `src/config/qualityParams.ts` y `src/lib/qualityCalculator.ts`
  - [x] Reestructurar `WISE_CALL_PARAMETERS` y `WISE_EMAIL_PARAMETERS` según especificación
  - [x] Implementar soporte de `hasSection2 = false` en `calculateMultiChannelAuditScores` para `wise_call`
  - [x] Ejecutar tests y verificar éxito (Green Phase)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Interfaz de Usuario y Controles Condicionales (`AuditModal.astro`)
- [x] Task: Actualizar la interfaz de Sección 2 en Llamadas Wise
  - [x] Agregar control toggle/checkbox `¿Se generó ticket?` en el header de la Sección 2
  - [x] Agregar contenedor colapsable con placeholder ("No se generó ticket para esta llamada (solo puntúa Sección 1)")
  - [x] Establecer estado por defecto `checked = true`
- [x] Task: Actualizar la interfaz de Sección 2 en Mails Wise
  - [x] Renombrar etiqueta de `¿Aplica MDA?` a `¿Se generó ticket?`
  - [x] Actualizar texto de placeholder informativo
- [x] Task: Actualizar interactividad cliente y recálculo en tiempo real
  - [x] Sincronizar eventos de cambio del toggle de llamadas con `recalculateScores()`
  - [x] Asegurar lectura de `hasSection2` en llamadas y actualización de opacity en `preview-s2-block`
  - [x] Vincular carga/guardado de auditoría en `CalidadContent.astro` y `src/actions/index.ts`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Verificación E2E y Cierre de Track
- [x] Task: Actualizar y ejecutar tests E2E de Playwright
  - [x] Agregar escenarios en `tests/calidad-multicanal-interaction.spec.ts` verificando el toggle `¿Se generó ticket?` en Llamadas Wise y recálculo al 100% solo con Atención
  - [x] Ejecutar `npx playwright test tests/calidad-*.spec.ts`
- [x] Task: Ejecutar suite de pruebas completa y gates de calidad
  - [x] Ejecutar `npx vitest run quality`
  - [x] Ejecutar `npm run build` para validar manifest SSR y verificación de build
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
