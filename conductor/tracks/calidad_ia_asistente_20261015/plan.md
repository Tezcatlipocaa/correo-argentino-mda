# Implementation Plan: Asistente IA Espectacular para Auditorías de Calidad

## Phase 1: Arquitectura de Inferencia Desacoplada y Abstracción de Proveedores [checkpoint: 9065078]
- [x] Task: Definir interfaces y esquemas Zod unificados en `src/lib/ai/types.ts` 61a1236
  - [x] Escribir tipos para `AiEvaluationRequest`, `AiEvaluationVerdict`, `AiEvaluationSummary` y la interfaz `AiProvider`.
  - [x] Definir esquema Zod estricto para validar las respuestas del LLM incluyendo resumen y justificaciones estructuradas.
- [x] Task: Implementar proveedor OpenCode CLI (`src/lib/ai/opencodeProvider.ts`) b8645a7
  - [x] Manejo de ejecución desacoplada por `spawn` en Windows sin fugas de procesos.
  - [x] Parsing de eventos `text` con soporte para modelos `-free`.
- [x] Task: Implementar proveedor Google Gemini HTTP (`src/lib/ai/geminiProvider.ts`) a262ac7
  - [x] Cliente directo `fetch` para la API REST oficial de Gemini con `responseSchema`.
- [x] Task: Refactorizar `src/lib/qualityAiEvaluator.ts` para usar la factoría de proveedores 9065078
  - [x] Soporte para selección dinámica de modelo/proveedor desde la petición o fallback a `.env`.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 9065078

## Phase 2: Endpoint API y Suite de Benchmarking
- [x] Task: Actualizar endpoint `POST /api/calidad/ai-evaluate` 78d3f54
  - [x] Recibir parámetro opcional `model` y `provider`.
  - [x] Devolver veredictos desglosados (cita textual, razonamiento, confianza) y resumen general de atención.
- [~] Task: Desarrollar script CLI de benchmarking (`scripts/ai-benchmark-models.mts`)
  - [ ] Extracción de N casos históricos de `mda.db`.
  - [ ] Ejecución paralela/secuencial comparando `deepseek-v4.1-flash-free` vs `nemotron-3.5-lightning-free`.
  - [ ] Impresión de tabla comparativa de latencia, tasa de éxito JSON y coincidencia con supervisor.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Interfaz de Usuario "Modo IA Espectacular" en Nueva Auditoría
- [ ] Task: Diseñar y maquetar el modal de inspección IA en `src/components/supervision/calidad/`
  - [ ] Selector de modelo activo (Nemotron, DeepSeek, etc.).
  - [ ] Animación de gradiente/resplandor y barra de progreso por etapas (*Extrayendo datos...*, *Procesando IA...*, *Sintetizando...*).
  - [ ] Sección de "Resumen Ejecutivo de la Atención".
  - [ ] Grilla de veredictos con toggles individuales de selección y tags de color según Cumple / No cumple.
- [ ] Task: Implementar lógica de cliente en `NewAuditForm.astro`
  - [ ] Disparo de la llamada al endpoint con el modelo seleccionado.
  - [ ] Transición fluida de estados (idle -> loading con etapas -> preview de veredictos).
  - [ ] Aplicación selectiva de sugerencias al formulario y actualización del campo Notas generales con el resumen de atención.
  - [ ] Renderizado de insignias visuales luminosas tipo badge en los criterios aplicados.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
