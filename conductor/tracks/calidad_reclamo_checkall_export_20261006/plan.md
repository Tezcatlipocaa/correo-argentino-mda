# Implementation Plan: Calidad — Lógica Reclamo/Novedad, Tildar/Destildar Masivo y Exportación Excel/CSV

## Phase 1: Modal de Auditoría — Lógica de Reclamo/Novedad vs Ticket Nuevo

- [ ] Task: Unit tests para cálculo de scores con Reclamo/Novedad vs Ticket Nuevo
  - [ ] Escribir tests en `tests/unit/qualityCalculator.test.ts` (o suite equivalente) validando que el modo Reclamo/Novedad asigne automáticamente 100% (55/55 pts en llamadas, 100% en mails) a la sección 2.
  - [ ] Validar que el modo Ticket Nuevo calcule scores basándose en las deducciones de los parámetros evaluados.
  - [ ] Confirmar fallo inicial de los tests (Fase Roja de TDD).
- [ ] Task: Implementación del selector visual en `AuditModal.astro`
  - [ ] Reemplazar el toggle simple `¿Se generó ticket?` por un selector claro y segmentado entre "Ticket nuevo generado" y "Reclamo / Novedad existente".
  - [ ] Adaptar la interfaz para ocultar/deshabilitar los 8 checks individuales cuando se elija "Reclamo / Novedad" con mensaje informativo.
  - [ ] Actualizar la función `recalculateScores()` en el cliente para aplicar la lógica del 100% automático en Reclamo/Novedad.
- [ ] Task: Persistencia y carga en edición de auditorías
  - [ ] Ajustar el envío del formulario y el endpoint de guardado para registrar si la auditoría fue Reclamo/Novedad.
  - [ ] Asegurar que al abrir una auditoría existente en el modal, se pre-seleccione el modo adecuado y se recalculen las puntuaciones correctas.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

---

## Phase 2: Acciones Rápidas en Checklists — Botones "Marcar Todos" / "Desmarcar Todos"

- [ ] Task: Tests para la selección masiva de parámetros
  - [ ] Escribir pruebas unitarias / funcionales para las funciones de marcado y desmarcado masivo de parámetros por sección.
  - [ ] Verificar que el desmarcado total aplique todas las deducciones y el marcado total restablezca el 100%.
- [ ] Task: Incorporar controles "Marcar todos" / "Desmarcar todos" en `AuditModal.astro`
  - [ ] Añadir botones compactos y ergonómicos en la cabecera de cada bloque (Llamadas S1, Llamadas S2, Mails S1, Mails S2, Autogestión).
  - [ ] Implementar los event listeners para alternar el estado de los checkboxes del bloque objetivo.
  - [ ] Conectar cada acción al recálculo inmediato (`recalculateScores()`).
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

---

## Phase 3: Exportación de Auditorías — Revisión CSV y Exportación a Excel (.xlsx)

- [ ] Task: Tests de estructura y generación de datos exportables
  - [ ] Crear tests unitarios para verificar la estructura de columnas y formateo de datos exportados (CSV y Excel).
- [ ] Task: Revisión y enriquecimiento de la exportación CSV
  - [ ] Actualizar la generación del archivo CSV en `CalidadContent.astro` asegurando todas las columnas requeridas (identificadores, auditor, scores S1/S2/Total, modo ticket/reclamo, observaciones).
  - [ ] Garantizar codificación UTF-8 con BOM y separador `;` para apertura perfecta en Excel local.
- [ ] Task: Implementación de Exportación Nativa a Excel (.xlsx)
  - [ ] Incorporar utilidad / librería para generación de hojas de cálculo `.xlsx` en el cliente o vía endpoint liviano.
  - [ ] Configurar encabezados con formato, anchos automáticos de columna y celdas numéricas para scores.
  - [ ] Añadir botón "Exportar Excel (.xlsx)" en la barra superior de acciones junto al botón CSV.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

---

## Phase 4: Integración, Verificación End-to-End y Regresión

- [ ] Task: Verificación integral de la suite de tests
  - [ ] Ejecutar la suite completa de tests (`npm run test:unit -- tests/unit`) y asegurar 100% de aprobación.
- [ ] Task: Verificación manual y de experiencia de usuario en navegador
  - [ ] Probar flujo completo: creación de auditoría de llamada en modo Reclamo/Novedad, uso de marcar/desmarcar todos, guardado y verificación en el resumen mensual.
  - [ ] Probar descarga de CSV y Excel (.xlsx) verificando que abran sin advertencias y con datos correctos.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
