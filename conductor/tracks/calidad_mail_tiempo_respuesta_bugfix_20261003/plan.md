# Implementation Plan: Bugfix: Tiempo de Respuesta en Mails Wise basado en Primera Respuesta del Operador (`user_reply`)

## Phase 1: TDD & Parser Unit Tests
- [ ] Task: Actualizar tests unitarios en `tests/unit/wiseEmailResponseTime.test.ts` con caso `533959`
  - [ ] Añadir prueba para el caso `533959` verificando que cuando existe `replyAt` (16:39:12), la respuesta calculada sea `"49:25"` y no el tiempo de `solvedAt` (18:33:04, `"02:43:17"`).
  - [ ] Añadir prueba para `parseWiseEmailMetadata` recibiendo `firstReplyAt` y asignando la duración correcta.
  - [ ] Verificar pruebas de fallback a `solved_at`/`closed_at` si `firstReplyAt` es nulo o vacío.
- [ ] Task: Implementar lógica de `firstReplyAt` en `src/lib/qualityMetadataFetcher.ts`
  - [ ] Actualizar `calculateWiseEmailResponseTime(createdAt, replyAt, solvedAt, closedAt)` para priorizar `replyAt`.
  - [ ] Actualizar `parseWiseEmailMetadata(caseData, operatorName, firstReplyAt)` para utilizar `firstReplyAt`.
  - [ ] Actualizar `fetchQualityCaseMetadata` para el canal `wise_email`, consultando actividades (`/core/v1/cases/:id/activities?fields=id,case_id,type,user_id,channel,created_at`) y extrayendo la fecha de `user_reply`.
  - [ ] Ejecutar `npm run test:unit -- tests/unit/wiseEmailResponseTime.test.ts` y validar tests en verde.
- [ ] Task: Phase Verification & Checkpoint (Validación TDD y paridad exacta con caso 533959)

## Phase 2: Verificación Integral & Build
- [ ] Task: Ejecutar suite de pruebas unitarias (`npm run test:unit -- tests/unit/`) y verificar build de producción (`npm run build`).
- [ ] Task: Phase Verification & Checkpoint (Verificación integral sin errores de compilación ni regresiones)
