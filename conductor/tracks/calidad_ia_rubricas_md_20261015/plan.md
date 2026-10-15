# Implementation Plan: Rúbricas Estandarizadas de Calidad en Markdown para Homogeneización de Modelos IA

## Phase 1: Creación del Archivo Maestro de Rúbricas y Loader Selectivo
- [x] Task: Redactar archivo maestro `src/config/ai/rubricas-calidad.md` (c1a15aca)
  - [x] Escribir rúbricas detalladas para criterios de ticket en llamadas Wise (`call_ticket_tipo`, `call_ticket_categorizacion`, `call_ticket_prioridad`, `call_ticket_descripcion`, `call_ticket_exactitud_datos`).
  - [x] Escribir rúbricas detalladas para criterios de registro en MDA para mails Wise (`email_mda_tipo`, `email_mda_categorizacion`, `email_mda_categorizacion_final`, `email_mda_prioridad`, `email_mda_descripcion`, `email_mda_seguimiento`, `email_mda_exactitud_datos`).
  - [x] Escribir rúbricas detalladas para criterios de autogestión (`ag_analisis`, `ag_sondeo`, `ag_procedimiento`, `ag_documentacion`, `ag_correccion_prioridad`, `ag_correccion_tipo`, `ag_categorizacion`, `ag_mda_seguimiento`, `ag_mda_categorizacion_final`, `ag_mda_info_complementaria`).
  - [x] Incluir en cada criterio: Objetivo, Qué buscar, Reglas Cumple / No cumple, Casos de Null, y Ejemplos prácticos con evidencia y razonamiento esperado.
- [x] Task: Implementar loader y parser selectivo (`src/lib/ai/rubricsLoader.ts`) (20f216f2)
  - [x] Escribir tests unitarios en `src/lib/ai/rubricsLoader.test.ts` (Fase Roja).
  - [x] Implementar función `getRubricsForCriteria(codes: string[]): string` con caching en memoria (Fase Verde).
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (20f216f2)

## Phase 2: Integración en el Evaluador IA y Calibración del Prompt
- [x] Task: Integrar rúbricas en `buildPrompt()` dentro de `src/lib/qualityAiEvaluator.ts` (528fc42a)
  - [x] Modificar `buildPrompt` para recibir las rúbricas formateadas de los criterios evaluados.
  - [x] Escribir test unitario que verifique que el prompt contiene las secciones de rúbricas correspondientes.
  - [x] Ajustar instrucciones del sistema para forzar al LLM a apegarse estrictamente a las definiciones y ejemplos del Markdown.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (528fc42a)

## Phase 3: Verificación con Benchmark y Validación de Consistencia Inter-Modelo
- [~] Task: Actualizar `scripts/ai-benchmark-models.mts` y medir consistencia
  - [ ] Ejecutar el benchmark comparando Nemotron vs DeepSeek con las nuevas rúbricas maestras.
  - [ ] Verificar que la variabilidad y discrepancia en justificaciones y veredictos se reduzca significativamente.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
