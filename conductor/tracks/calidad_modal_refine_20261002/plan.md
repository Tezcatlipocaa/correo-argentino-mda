# Plan: Refinamiento Visual y Ergonómico del Modal de Auditoría de Calidad

## Phase 1: Preparación y E2E Test Suite (Red Phase)
- [x] Task: Agregar pruebas E2E para el layout de 2 columnas y componentes rediseñados
  - [x] Escribir assertions en `tests/calidad-multicanal-interaction.spec.ts` para verificar la existencia del layout responsive de 2 columnas (`#modal-grid-context` y `#modal-grid-evaluation`)
  - [x] Escribir test para revelado progresivo de notas de observación (ocultas por defecto, visibles al desmarcar o activar "+ Agregar nota")
  - [x] Escribir test para validar visualización de "N/A" / "Excluido" en Sección 2 cuando el ticket no aplica
  - [x] Ejecutar Playwright y verificar que las nuevas aserciones fallen (Red Phase)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Reestructuración de Layout y Desanidación de Tarjetas
- [x] Task: Reestructurar el modal a 2 columnas fijas en escritorio
  - [x] Crear estructura responsive en `AuditModal.astro` (`lg:grid lg:grid-cols-12 gap-6`, izquierda Contexto col-5, derecha Evaluación col-7)
  - [x] Ajustar scrollbars: permitir scroll independiente en evaluación sin atrapar la rueda del ratón
- [x] Task: Desanidar tarjetas de evaluación y aligerar la interfaz
  - [x] Eliminar contenedores grises rígidos (`card`, `bg-base-200`, `border`) de cada criterio individual
  - [x] Reemplazar por lista limpia con divisores tenues (`divide-y` o `border-b`) y espaciado vertical
  - [x] Normalizar tipografía de ticket: reemplazar clases monoespaciadas por la fuente sans-serif (`Geist`) del sistema
  - [x] Transformar datos de ticket redundantes en metadatos limpios de solo lectura
  - [x] Limpiar tarjeta de audio eliminando micro-textos redundantes
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Revelado Progresivo de Observaciones y Lógica de Score
- [x] Task: Implementar revelado progresivo de observaciones en los criterios
  - [x] Ocultar los text inputs de observación por defecto (`hidden` o colapsados)
  - [x] Conectar listener para desplegar automáticamente al desmarcar el checkbox de cualquier criterio
  - [x] Incorporar botón / enlace sutil "+ Agregar nota" para habilitar la observación cuando el check está activo
- [x] Task: Actualizar representación visual del Score
  - [x] Modificar el indicador de Sección 2 para mostrar "N/A" / "Excluido" cuando el ticket está desactivado en vez de "0%"
  - [x] Asegurar que el total final mantenga 100% como puntaje prioritario y visible en primer término
- [x] Task: Armonizar paleta de colores y estilos tipográficos
  - [x] Pasar encabezados de ALL CAPS a Sentence case / Title case
  - [x] Reservar color primario para acción principal de Guardar y neutrales para búsquedas y acciones secundarias
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Verificación Integral y Fidelidad
- [x] Task: Ejecutar suite de pruebas y validación SSR
  - [x] Correr `npx playwright test tests/calidad-multicanal-interaction.spec.ts` (Green Phase)
  - [x] Ejecutar `npm run build` para asegurar integridad del build SSR
  - [x] Validar visualmente en navegador con capturas o Playwright inspector
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
