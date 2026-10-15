# Implementation Plan: Rúbricas Estandarizadas de Calidad en Markdown para Homogeneización de Modelos IA

## Phase 1: Creación del Archivo Maestro de Rúbricas y Loader Selectivo
- [ ] Task: Redactar archivo maestro `src/config/ai/rubricas-calidad.md`
  - [ ] Escribir rúbricas detalladas para criterios de ticket en llamadas Wise (`call_ticket_tipo`, `call_ticket_categorizacion`, `call_ticket_prioridad`, `call_ticket_descripcion`, `call_ticket_exactitud_datos`).
  - [ ] Escribir rúbricas detalladas para criterios de registro en MDA para mails Wise (`email_mda_tipo`, `email_mda_categorizacion`, `email_mda_categorizacion_final`, `email_mda_prioridad`, `email_mda_descripcion`, `email_mda_seguimiento`, `email_mda_exactitud_datos`).
  - [ ] Escribir rúbricas detalladas para criterios de autogestión (`ag_analisis`, `ag_sondeo`, `ag_procedimiento`, `ag_documentacion`, `ag_correccion_prioridad`, `ag_correccion_tipo`, `ag_categorizacion`, `ag_mda_seguimiento`, `ag_mda_categorizacion_final`, `ag_mda_info_complementaria`).
  - [ ] Incluir en cada criterio: Objetivo, Qué buscar, Reglas Cumple / No cumple, Casos de Null, y Ejemplos prácticos con evidencia y razonamiento esperado.
- [ ] Task: Implementar loader y parser selectivo (`src/lib/ai/rubricsLoader.ts`)
  - [ ] Escribir tests unitarios en `src/lib/ai/rubricsLoader.test.ts` (Fase Roja).
  - [ ] Implementar función `getRubricsForCriteria(codes: string[]): string` con caching en memoria (Fase Verde).
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Integración en el Evaluador IA y Calibración del Prompt
- [ ] Task: Integrar rúbricas en `buildPrompt()` dentro de `src/lib/qualityAiEvaluator.ts`
  - [ ] Modificar `buildPrompt` para recibir las rúbricas formateadas de los criterios evaluados.
  - [ ] Escribir test unitario que verifique que el prompt contiene las secciones de rúbricas correspondientes.
  - [ ] Ajustar instrucciones del sistema para forzar al LLM a apegarse estrictamente a las definiciones y ejemplos del Markdown.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Verificación con Benchmark y Validación de Consistencia Inter-Modelo
- [ ] Task: Actualizar `scripts/ai-benchmark-models.mts` y medir consistencia
  - [ ] Ejecutar el benchmark comparando Nemotron vs DeepSeek con las nuevas rúbricas maestras.
  - [ ] Verificar que la variabilidad y discrepancia en justificaciones y veredictos se reduzca significativamente.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
