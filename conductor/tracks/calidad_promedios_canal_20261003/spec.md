# Specification: Promedios por Canal y Promedio Total en Auditorías de Calidad

## 1. Overview
Actualmente, en la vista de detalle de un operador dentro del módulo de Calidad (`src/components/supervision/calidad/CalidadContent.astro`), las pestañas de canales (`Llamadas Wise`, `Mails Wise`, `Autogestiones`) muestran únicamente el conteo de muestras completadas (por ejemplo `0/4`).
Esta mejora incorpora el cálculo y la visualización del promedio de calificación de calidad obtenido en cada canal directamente en las pestañas, así como el promedio total consolidado de todas las muestras evaluadas en el mes.

## 2. Functional Requirements
- **Cálculo de Promedio por Canal**:
  - Para cada canal (`wise_call`, `wise_email`, `invgate_ticket`), calcular la media aritmética de los puntajes finales (`score`) de las auditorías registradas en dicho mes para el operador. Si no hay auditorías, mostrar `--` o `N/A`.
- **Cálculo de Promedio Total / Consolidado**:
  - Calcular la media aritmética global de los puntajes (`score`) de todas las auditorías completadas en el mes para ese operador (suma de todos los puntajes / cantidad total de auditorías evaluadas).
- **Integración Visual en Tabs de Canal**:
  - Cada pestaña de canal (`tab`) mostrará el conteo y su promedio respectivo con un badge o indicador estilizado (ej: badge de puntaje con color semántico según escala de calidad: verde si >= 85, amarillo si >= 70, rojo si < 70).
  - Incorporar una vista o pill/tab adicional consolidada (por ejemplo una pestaña o badge de resumen "General / Consolidado" al lado de las tabs) que exponga claramente el Promedio General acumulado de las muestras.
  - Al alternar entre pestañas o al registrar/editar/eliminar una auditoría, recalcular en tiempo real tanto los promedios específicos de cada canal como el promedio global consolidado.
- **Ámbito**:
  - Aplicable al detalle del operador seleccionado en `CalidadContent.astro` (tanto para supervisores como para agentes consultando su propio detalle).

## 3. Non-Functional Requirements & Design Contract
- Respetar el sistema de diseño DaisyUI v5 y tokens semánticos definidos en `docs/DESIGN.md`.
- Mantener diseño responsive adaptado a pantallas móviles y de escritorio.
- Sin dependencias externas adicionales.

## 4. Acceptance Criteria
- [ ] En la pestaña de "Llamadas Wise" se visualiza el promedio de puntaje de las llamadas evaluadas (ej: `88%` o badge numérico).
- [ ] En la pestaña de "Mails Wise" se visualiza el promedio de puntaje de los correos evaluados.
- [ ] En la pestaña de "Autogestiones" se visualiza el promedio de puntaje de los tickets evaluados.
- [ ] Se muestra visiblemente el Promedio Total consolidado de todas las muestras evaluadas del mes para el operador.
- [ ] Cuando se registra una nueva evaluación, se edita o se borra, los promedios por canal y el promedio total se actualizan inmediatamente en pantalla.
- [ ] Si un canal no tiene muestras evaluadas, se visualiza de forma limpia sin errores de división por cero (mostrando `--`).

## 5. Out of Scope
- Modificaciones en la base de datos o en esquemas Drizzle (los promedios son calculados en base a las auditorías ya persistidas).
- Cambios en la tabla global de agentes (se mantiene enfocado en el detalle del operador).
