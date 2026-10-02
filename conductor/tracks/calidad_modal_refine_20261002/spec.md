# Specification: Refinamiento Visual y Ergonómico del Modal de Auditoría de Calidad

## Overview
Optimizar la ergonomía visual y la experiencia de usuario (UX) del modal de auditoría de calidad (`AuditModal.astro`), eliminando la sobrecarga por "card-ception" (cajas dentro de cajas), unificando la tipografía a la familia sans-serif del sistema (`Geist`), reorganizando el modal en un layout de 2 columnas de escritorio (Contexto a la izquierda, Evaluación a la derecha), implementando revelado progresivo de notas/observaciones en los criterios, y normalizando los colores y el cálculo visual del score (exclusión visual de secciones desactivadas en lugar de mostrar "0%").

## Functional Requirements
1. **Layout de 2 Columnas (Desktop lg:)**:
   - **Columna Izquierda (Contexto ~40-45%)**:
     - Reproductor de audio independiente y limpio con controles HTML5 y descarga.
     - Metadatos del caso/llamada (duración, fecha, ringueo) presentados como etiquetas de lectura compactas, no inputs duplicados.
     - Buscador unificado por pestañas (Wise CX / InvGate).
     - Visor en vivo de Ticket InvGate (título, categoría, prioridad, descripción sin tipografía monospace).
   - **Columna Derecha (Evaluación ~55-60%)**:
     - Score en tiempo real destacado con jerarquía clara (Score Total final prominente).
     - Criterios de evaluación de Sección 1 (Gestión de llamada/atención) y Sección 2 (Ticket / Gestión y Registro).
     - Observaciones generales / feedback final.
     - Botones de acción inferiores alineados (Guardar / Cerrar / Eliminar).

2. **Eliminación de Card-Ception y Aligeramiento Visual**:
   - Remover bordes grises excesivos y fondos grises anidados en items de evaluación.
   - Usar divisores sutiles (`border-b border-base-200/60` o `divide-y`) y espaciado consistente (`space-y-3` / `gap-3`).
   - Criterios de evaluación presentados como filas limpias y legibles con hover sutil.

3. **Corrección Tipográfica y Micro-textos**:
   - Reemplazar fuentes monoespaciadas accidentales en los datos del ticket por la fuente sans-serif corporativa (`Geist`).
   - Normalizar textos de ALL CAPS a Sentence case / Title case en títulos, subtítulos, labels y botones (manteniendo mayúsculas únicamente en badges pequeños de código o acrónimos).
   - Eliminar textos redundantes en la tarjeta de audio (mantener solo badge de estado y reproductor).
   - Reducir duplicidad de datos: si el número de ticket ya se muestra en el encabezado/visor, mostrarlo como metadato de lectura en lugar de input editable redundante.

4. **Revelado Progresivo de Observaciones en Criterios**:
   - Por defecto, los inputs de observación de cada criterio permanecen ocultos para evitar saturación de 10-15 cajas vacías.
   - Si el auditor desmarca un check (penalización), el campo de observación se expande automáticamente con animación sutil para registrar el motivo.
   - Si el check está marcado, se provee un botón/link discreto "+ Observación" para agregar notas solo cuando sea necesario.

5. **Lógica Visual del Score para Secciones Excluidas**:
   - Cuando el toggle de "¿Se generó ticket?" esté desactivado (Sección 2 no aplica), la visualización de la Sección 2 en el panel de score debe mostrar "N/A" o "Excluido" en lugar de "0%", evitando la percepción de penalización o error.
   - El score total refleja el 100% ponderado de la Sección 1 activa.

6. **Armonización de Paleta de Colores**:
   - Botón de acción principal ("Guardar auditoría"): botón primario distintivo con contraste alto.
   - Botones secundarios y búsquedas: paleta neutral de DaisyUI (`btn-neutral`, `btn-ghost`, `btn-soft`).
   - Semántica estricta: Verde para éxito/aprobado (80%+), Ámbar para advertencia (60-79%), Rojo para desaprobado/penalizaciones/eliminar. Checks con acento consistente sin competir con botones de acción.

## Acceptance Criteria
- El modal renderiza en 2 columnas en pantallas `>= 1024px` y colapsa a 1 columna en pantallas móviles.
- Los items de criterio no tienen tarjetas con bordes grises anidados; usan separadores limpios.
- Ningún detalle del ticket o texto de encabezado renderiza con fuente monoespaciada accidental ni ALL CAPS innecesario.
- Los campos de observación de los criterios están ocultos por defecto y se revelan progresivamente (al desmarcar o vía toggle).
- Al desactivar el ticket en llamada/mail, la Sección 2 en el desglose de score muestra "N/A" o "Excluido" en vez de "0%".
- Todos los tests E2E de Playwright (`tests/calidad-multicanal-interaction.spec.ts` y afines) pasan con éxito.
- La compilación `npm run build` pasa limpiamente.

## Out of Scope
- Modificaciones en la base de datos o en el esquema de Drizzle.
- Cambios en endpoints backend de Wise CX o InvGate.
