# Implementation Plan: Calidad — Lógica Reclamo/Novedad, Tildar/Destildar Masivo y Exportación Excel/CSV

## Phase 1: Modal de Auditoría — Lógica de Reclamo/Novedad vs Ticket Nuevo

- [x] Task: Unit tests para cálculo de scores con Reclamo/Novedad vs Ticket Nuevo [7f68937]
  - [x] Escribir tests en `tests/unit/qualityCalculator.test.ts` (o suite equivalente) validando que el modo Reclamo/Novedad asigne automáticamente 100% (55/55 pts en llamadas, 100% en mails) a la sección 2.
  - [x] Validar que el modo Ticket Nuevo calcule scores basándose en las deducciones de los parámetros evaluados.
  - [x] Confirmar fallo inicial de los tests (Fase Roja de TDD).
- [x] Task: Implementación del selector visual en `AuditModal.astro` [7a0f999]
  - [x] Reemplazar el toggle simple `¿Se generó ticket?` por un selector claro y segmentado entre "Ticket nuevo generado" y "Reclamo / Novedad existente".
  - [x] Adaptar la interfaz para ocultar/deshabilitar los 8 checks individuales cuando se elija "Reclamo / Novedad" con mensaje informativo.
  - [x] Actualizar la función `recalculateScores()` en el cliente para aplicar la lógica del 100% automático en Reclamo/Novedad.
- [x] Task: Persistencia y carga en edición de auditorías [7a0f999]
  - [x] Ajustar el envío del formulario y el endpoint de guardado para registrar si la auditoría fue Reclamo/Novedad.
  - [x] Asegurar que al abrir una auditoría existente en el modal, se pre-seleccione el modo adecuado y se recalculen las puntuaciones correctas.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: 7a0f999]

---

## Phase 2: Acciones Rápidas en Checklists — Botones "Marcar Todos" / "Desmarcar Todos" [checkpoint: 98b5c5a]

- [x] Task: Tests para la selección masiva de parámetros [98b5c5a]
  - [x] Escribir pruebas unitarias / funcionales para las funciones de marcado y desmarcado masivo de parámetros por sección.
  - [x] Verificar que el desmarcado total aplique todas las deducciones y el marcado total restablezca el 100%.
- [x] Task: Incorporar controles "Marcar todos" / "Desmarcar todos" en `AuditModal.astro` [7a0f999]
  - [x] Añadir botones compactos y ergonómicos en la cabecera de cada bloque (Llamadas S1, Llamadas S2, Mails S1, Mails S2, Autogestión).
  - [x] Implementar los event listeners para alternar el estado de los checkboxes del bloque objetivo.
  - [x] Conectar cada acción al recálculo inmediato (`recalculateScores()`).
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: 98b5c5a]

---

## Phase 3: Exportación de Auditorías — Revisión CSV y Exportación a Excel (.xlsx) [checkpoint: 92150e6e]

- [x] Task: Tests de estructura y generación de datos exportables [92150e6e]
  - [x] Crear tests unitarios para verificar la estructura de columnas y formateo de datos exportados (CSV y Excel).
- [x] Task: Revisión y enriquecimiento de la exportación CSV [92150e6e]
  - [x] Actualizar la generación del archivo CSV en `CalidadContent.astro` asegurando todas las columnas requeridas (identificadores, auditor, scores S1/S2/Total, modo ticket/reclamo, observaciones).
  - [x] Garantizar codificación UTF-8 con BOM y separador `;` para apertura perfecta en Excel local.
- [x] Task: Implementación de Exportación Nativa a Excel (.xlsx) [92150e6e]
  - [x] Incorporar utilidad / librería para generación de hojas de cálculo `.xlsx` en el cliente o vía endpoint liviano.
  - [x] Configurar encabezados con formato, anchos automáticos de columna y celdas numéricas para scores.
  - [x] Añadir botón "Exportar Excel (.xlsx)" en la barra superior de acciones junto al botón CSV.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: 92150e6e]

---

## Phase 4: Integración, Verificación End-to-End y Regresión [checkpoint: 92150e6e]

- [x] Task: Verificación integral de la suite de tests [92150e6e]
  - [x] Ejecutar la suite completa de tests (`npm run test:unit -- tests/unit`) y asegurar 100% de aprobación.
- [x] Task: Verificación manual y de experiencia de usuario en navegador [92150e6e]
  - [x] Probar flujo completo: creación de auditoría de llamada en modo Reclamo/Novedad, uso de marcar/desmarcar todos, guardado y verificación en el resumen mensual.
  - [x] Probar descarga de CSV y Excel (.xlsx) verificando que abran sin advertencias y con datos correctos.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: 92150e6e]
