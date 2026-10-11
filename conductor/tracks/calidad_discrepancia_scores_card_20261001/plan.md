# Plan de Implementación: Corrección de Discrepancia de Scores y Parámetros en Card y Modal de Calidad

## Phase 1: Corrección de Consulta de Parámetros en `saveAudit`
- [x] Task: Escribir prueba unitaria en `tests/unit/quality-calculator.test.ts` / tests de acción
  - [x] Verificar que el cálculo y guardado no arrastren IDs ni deducciones de parámetros obsoletos
  - [x] Verificar que la edición de una auditoría reemplace limpiamente los scores con los del canal activo
- [x] Task: Modificar `saveAudit` en `src/actions/index.ts`
  - [x] Eliminar la consulta condicional a `existingScores` para `input.id`
  - [x] Obtener `allParams` siempre filtrando por `auditParameters.active = true` y `auditParameters.channel = input.channelType`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Renderizado de Card y Normalización de Datos Existentes
- [x] Task: Actualizar `renderCallCard` en `src/components/supervision/calidad/CalidadContent.astro`
  - [x] Filtrar parámetros del canal correspondiente a la auditoría (`p.channel === call.channelType`)
  - [x] Asegurar que la lista de parámetros de Sección 2 no quede en blanco ante faltantes en `details`
- [x] Task: Crear y ejecutar script de normalización `scripts/recalculate-existing-audits.mts`
  - [x] Mapear scores huérfanos de auditorías previas a los parámetros canónicos
  - [x] Recalcular `section1Score`, `section2Score` y `totalScore` con la lógica actual
  - [x] Actualizar filas en `quality_audits` y regenerar `audit_scores`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Verificación E2E y Cierre de Track
- [x] Task: Ejecutar y actualizar tests E2E de Playwright
  - [x] Validar en `tests/calidad-multicanal-interaction.spec.ts` que al guardar o editar una auditoría, la card muestra scores y checks idénticos a los del modal
  - [x] Ejecutar `npx playwright test tests/calidad-multicanal-interaction.spec.ts tests/calidad-multicanal.spec.ts`
- [x] Task: Gates de Calidad y Verificación de Build
  - [x] Ejecutar `npx vitest run quality`
  - [x] Ejecutar `npm run build` (`verify-build`)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
