# Specification: Asistente IA Espectacular para Auditorías de Calidad (Modelos Free & Gemini)

## Overview
Implementación de un sistema asistente de evaluación de calidad basado en Inteligencia Artificial para el módulo de supervisión (`/supervision/calidad-operadores/nueva`). 
El sistema permite evaluar por demanda tickets de InvGate utilizando modelos de lenguaje gratuitos provistos por el gateway de OpenCode (como `nemotron-3.5-lightning-free` y `deepseek-v4.1-flash-free`) y ofrece una arquitectura desacoplada para migrar en el futuro a la API oficial de Google Gemini sin cambios en la UI.
El flujo se presenta con un diseño visual moderno y refinado ("Modo IA Espectacular"): incluye un modal comparativo con selección de modelo, barra de progreso por etapas y efectos luminosos, permitiendo al supervisor revisar, editar y aplicar selectivamente los veredictos sugeridos junto con un resumen ejecutivo de la atención.

## Functional Requirements
1. **Selector y Lanzador en UI**:
   - Botón destacado "Analizar con IA" en la barra de configuración de la auditoría.
   - Apertura de un modal interactivo con selección de modelo (Nemotron, DeepSeek, MiMo o Gemini configurado).
2. **Experiencia Visual Espectacular**:
   - Barra de estado / progreso con etapas dinámicas animadas:
     1. *Extrayendo metadatos y comentarios del ticket...*
     2. *Procesando contexto con modelo IA...*
     3. *Sintetizando veredictos y evidencias...*
   - Efectos sutiles de gradiente/resplandor acordes al Design System DaisyUI/Tailwind v4 (usando clases semánticas de tema, sin hex hardcodeados).
3. **Modal Comparativo de Veredictos**:
   - Resumen ejecutivo de la atención redactado por la IA.
   - Lista detallada de criterios evaluados mostrando:
     - Estado sugerido: **Cumple** (verde) o **No cumple** (rojo) con porcentaje de confianza.
     - Justificación estructurada: Cita textual del ticket + razonamiento del modelo.
     - Toggle individual para incluir/descartar la sugerencia en cada criterio.
   - Acciones globales: "Aplicar todas las sugerencias seleccionadas" y "Descartar".
   - Al aplicar: vuelca los estados en los items del formulario, inserta el resumen general en el campo de Notas del formulario y coloca insignias visuales `IA {confianza}%` con tooltip de evidencia.
4. **Arquitectura de Inferencia Desacoplada (`AiProvider`)**:
   - Interfaz común `AiProvider` que independiza la UI del motor de inferencia.
   - Implementación `OpenCodeProvider` (CLI `opencode run` para modelos `-free`).
   - Implementación `GeminiProvider` (vía `fetch` HTTP a Google AI Studio / Gemini API oficial).
   - Detección y fallback de proveedores y modelos mediante variables de entorno (`.env`).
5. **Suite de Benchmarking (CLI)**:
   - Script `scripts/ai-benchmark-models.mts` para testear y contrastar modelos sobre N auditorías históricas reales de `mda.db`, midiendo latencia, validez de JSON y porcentaje de coincidencia con la calificación del supervisor humano.

## Non-Functional Requirements
- **Respeto a Reglas Deterministas**: La IA nunca sobreescribe ni altera criterios gobernados por reglas automáticas preexistentes (SLA 90m, SLA Resolución, Ortografía heurística, Título normalizado, Origen).
- **Rendimiento**: Límite de concurrencia y control de timeout (120 s por defecto) con gestión de errores amigable al usuario.
- **Tokens y Diseño**: Cumplimiento estricto de las reglas de diseño del proyecto (`docs/DESIGN.md`, DaisyUI v5 token colors).

## Acceptance Criteria
- [ ] El botón "Analizar con IA" abre el modal y permite elegir el modelo a utilizar.
- [ ] La barra de carga visualiza las etapas de la consulta.
- [ ] El modal presenta el resumen general y los veredictos con justificación (cita + razonamiento).
- [ ] Los toggles individuales permiten aplicar selectivamente solo los criterios deseados al formulario.
- [ ] Las insignias visuales `IA` quedan reflejadas en los criterios correspondientes del formulario de auditoría.
- [ ] El script de benchmarking ejecuta comparativas entre modelos free sin errores de ejecución.

## Out of Scope
- Evaluación de transcripción de audio de llamadas Wise (reservado para fase posterior).
- Modificación directa de la base de datos sin confirmación del supervisor al guardar.
