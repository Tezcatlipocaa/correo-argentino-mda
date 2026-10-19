# Specification: Rúbricas Estandarizadas de Calidad en Markdown para Homogeneización de Modelos IA

## Overview
Actualmente, diferentes modelos de lenguaje (como Nemotron, DeepSeek, MiMo y Gemini) pueden interpretar de manera dispar los criterios de auditoría técnica debido a que las pautas en el prompt son generales o concisas.
Este track implementa una **Guía Maestra de Rúbricas y Criterios de Evaluación en Markdown** (`src/config/ai/rubricas-calidad.md`) que documenta de forma exhaustiva qué significa cada criterio, qué evidencias buscar en el ticket InvGate y ejemplos concretos de **Cumple** y **No cumple** (Few-Shot prompt guidance). Un parser selectivo inyecta en el prompt únicamente las rúbricas de los criterios que aplican al canal evaluado, logrando que todos los modelos evalúen bajo las mismas reglas y produzcan veredictos consistentes, explicables y calibrados con el estándar de los supervisores humanos.

## Functional Requirements
1. **Archivo Maestro de Rúbricas (`src/config/ai/rubricas-calidad.md`)**:
   - Archivo Markdown estructurado por criterio (con anclas identificadoras tipo `## criterio: [codigo]`).
   - Contenido por cada criterio:
     - **Definición y Objetivo**: Qué evalúa el criterio en el servicio de la Mesa de Ayuda TI.
     - **Qué buscar en el ticket**: Puntos específicos en título, descripción, categoría, prioridad o comentarios.
     - **Regla de Cumple**: Condiciones obligatorias para otorgar `cumple = true`.
     - **Regla de No Cumple**: Motivos explícitos para marcar `cumple = false`.
     - **Ejemplo Práctico de Cumple**: Caso con cita textual y justificación esperada.
     - **Ejemplo Práctico de No Cumple**: Caso con cita textual y justificación esperada.
     - **Cuándo marcar Null**: Cuándo la falta de evidencia o campo vacío no debe penalizar.
2. **Parser y Loader Dinámico de Rúbricas (`src/lib/ai/rubricsLoader.ts`)**:
   - Módulo que lee y cachea en memoria `rubricas-calidad.md`.
   - Función `getRubricsForCriteria(criterionCodes: string[])` que extrae y formatea solo los fragmentos Markdown pertinentes a la lista de criterios solicitados para minimizar el consumo de tokens y enfocar la atención del LLM.
3. **Integración en el Prompt del Evaluador (`src/lib/qualityAiEvaluator.ts`)**:
   - Inyección del bloque de rúbricas detalladas en `buildPrompt()`.
   - Instrucción explícita al LLM de guiar su veredicto, evidencia y razonamiento basándose en las rúbricas y ejemplos del Markdown.
4. **Validación en Script de Benchmarking (`scripts/ai-benchmark-models.mts`)**:
   - Actualización del script CLI para incorporar las rúbricas maestras y reportar la tasa de coincidencia inter-modelo (Nemotron vs DeepSeek) antes y después de aplicar la rúbrica estandarizada.

## Non-Functional Requirements
- **Eficiencia en Tokens**: La inyección selectiva debe evitar enviar rúbricas de criterios irrelevantes (ej: no inyectar criterios de autogestión en llamadas).
- **Mantenibilidad**: Modificar o refinar un criterio de auditoría para la IA no requerirá cambiar código TypeScript, sino simplemente editar el Markdown en lenguaje natural.
- **Formato Estricto de Salida**: Preservar la validación Zod existente (`AiResponseSchema` con resumen, veredictos, evidencias y razonamientos).

## Acceptance Criteria
- [ ] `src/config/ai/rubricas-calidad.md` contiene las rúbricas exhaustivas con ejemplos Cumple / No Cumple para todos los criterios evaluables por IA (`call_ticket_*`, `email_mda_*`, `ag_*`).
- [ ] `rubricsLoader.ts` extrae correctamente los fragmentos Markdown según los códigos de criterio.
- [ ] `qualityAiEvaluator.ts` inyecta las rúbricas y los modelos responden alineados con los ejemplos provistos.
- [ ] Los tests unitarios validan la carga y extracción de las rúbricas sin errores.
- [ ] El script `ai-benchmark-models.mts` ejecuta con éxito utilizando la rúbrica maestra.

## Out of Scope
- Evaluación de grabaciones de audio o transcripciones fonéticas (fase posterior).
