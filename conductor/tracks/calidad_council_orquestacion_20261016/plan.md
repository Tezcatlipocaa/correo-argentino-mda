# Implementation Plan: Council de Calidad MDA (Orquestación Multi-Agente & Fallback Resiliente)

## Phase 1: Core Provider & Domain Suite Update (TDD) [checkpoint: 4a281575]
- [x] Task: Actualizar `package.json` para incluir `src/lib/ai/*.test.ts` en `test:domain` 8a7ee6d
- [x] Task: Escribir tests para el fallback de modelos en `src/lib/ai/opencodeProvider.test.ts` 4a281575
- [x] Task: Implementar fallback de modelos en `src/lib/ai/opencodeProvider.ts` 4a281575
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Council Engine & Consensus Rules (TDD) [checkpoint: f10edec2]
- [x] Task: Escribir tests exhaustivos de partición y consenso en `src/lib/ai/councilEvaluator.test.ts` f10edec2
- [x] Task: Implementar `src/lib/ai/councilEvaluator.ts` con split explícito, mergeCouncil puro y prompt quirúrgico al juez f10edec2
- [x] Task: Exportar e integrar tipos del debate en `src/lib/ai/types.ts` f10edec2
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: API Endpoint Integration (TDD) [checkpoint: 61d9c06c]
- [x] Task: Actualizar tests en `src/pages/api/calidad/ai-evaluate.test.ts` con soporte para `model: "council"` 61d9c06c
- [x] Task: Implementar branch de Council en `src/pages/api/calidad/ai-evaluate.ts` retornando payload aditivo 61d9c06c
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: UI Experience & Debate Visualization
- [~] Task: Añadir opción Council en `src/components/supervision/calidad/AiInspectionModal.astro`
- [ ] Task: Añadir 4to paso "Arbitraje" condicional al indicador de etapas en `src/components/supervision/calidad/NewAuditForm.astro`
- [ ] Task: Implementar badges de consenso y acordeón `<details>` con el debate en `src/components/supervision/calidad/NewAuditForm.astro`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: End-to-End Validation & Production Integrity
- [ ] Task: Ejecutar `npm run test:domain` y `npm run test:unit`
- [ ] Task: Ejecutar `npm run build` para garantizar compilación SSR limpia
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
