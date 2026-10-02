# Implementation Plan: Corrección de Copiado de Imágenes en Cronograma (Grupos y Horas Extras)

## Phase 1: Tests E2E de Detección de Falla (Red Phase) [checkpoint: d78bd26]
- [x] Task: Crear/extender tests E2E en Playwright para verificar copiado de Saturday Rotation Card y Overtime Compact List (d78bd26)
  - [x] Escribir caso de prueba en `tests/cronograma/export-image.spec.ts` para el botón "Copiar Tabla" en la rotación de sábados verificando que capture la card completa (#saturday-rotation-card) y genere un PNG no vacío.
  - [x] Escribir caso de prueba para el botón "Copiar Tabla" en horas extras verificando que capture el bloque de turnos guardados (Columna 2+3) y genere un PNG no vacío.
  - [x] Ejecutar el test y confirmar la falla/gap de comportamiento en el estado actual.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Corrección del Renderizado Offscreen y Elementos Objetivo
- [x] Task: Corregir posicionamiento del contenedor host en `exportAsClipboardImage` (`src/components/cronograma/lib/exporters.ts`) (2c5b604)
  - [x] Sustituir `left: -99999px` por posicionamiento offscreen seguro (`top: 0; left: 0; opacity: 0; pointer-events: none; z-index: -9999;`) para evitar que el canvas de `html-to-image` dibuje fuera del viewport.
  - [x] Asegurar que `captureWidth`, `captureHeight` y el fondo del host contengan correctamente el clon con su margen.
- [~] Task: Redirigir la captura de rotación de sábados a `#saturday-rotation-card`
  - [ ] Modificar `handleCopyRotationImage` en `src/components/cronograma/lib/dashboard-client.ts` para que `targetEl` sea `saturdayCard`.
  - [ ] Calibrar el ancho fijo (`width`) y padding para un encuadre nítido que incluya título, badge de grupo y grilla.
- [ ] Task: Identificar y redirigir la captura de horas extras a la Columna 2+3
  - [ ] Agregar `id="overtime-compact-list-card"` al contenedor de la Columna 2+3 ("Turnos Guardados") en `src/components/cronograma/CronogramaDashboard.astro`.
  - [ ] Modificar `handleCopyOvertimeImage` en `src/components/cronograma/lib/dashboard-client.ts` para capturar dicho elemento con dimensiones óptimas.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Verificación Final y Calidad (Green Phase)
- [ ] Task: Ejecutar suite de pruebas Playwright y verificar que pasen en verde
  - [ ] Correr `npx playwright test tests/cronograma/export-image.spec.ts`.
  - [ ] Confirmar que las imágenes copiadas y descargadas no son transparentes/en blanco y poseen firmas PNG íntegras.
  - [ ] Confirmar que los elementos `.no-export` no figuran en las capturas y que el DOM visible no sufre mutaciones.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
