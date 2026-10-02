# Plan: Refinamiento Visual y Ergonómico del Modal de Auditoría de Calidad

## Phase 1: Preparación y E2E Test Suite (Red Phase)
- [ ] Task: Agregar pruebas E2E para el layout de 2 columnas y componentes rediseñados
  - [ ] Escribir assertions en `tests/calidad-multicanal-interaction.spec.ts` para verificar la existencia del layout responsive de 2 columnas (`#modal-grid-context` y `#modal-grid-evaluation`)
  - [ ] Escribir test para revelado progresivo de notas de observación (ocultas por defecto, visibles al desmarcar o activar "+ Agregar nota")
  - [ ] Escribir test para validar visualización de "N/A" / "Excluido" en Sección 2 cuando el ticket no aplica
  - [ ] Ejecutar Playwright y verificar que las nuevas aserciones fallen (Red Phase)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Reestructuración de Layout y Desanidación de Tarjetas
- [ ] Task: Reestructurar el modal a 2 columnas fijas en escritorio
  - [ ] Crear estructura responsive en `AuditModal.astro` (`lg:grid lg:grid-cols-12 gap-6`, izquierda Contexto col-5, derecha Evaluación col-7)
  - [ ] Ajustar scrollbars: permitir scroll independiente en evaluación sin atrapar la rueda del ratón
- [ ] Task: Desanidar tarjetas de evaluación y aligerar la interfaz
  - [ ] Eliminar contenedores grises rígidos (`card`, `bg-base-200`, `border`) de cada criterio individual
  - [ ] Reemplazar por lista limpia con divisores tenues (`divide-y` o `border-b`) y espaciado vertical
  - [ ] Normalizar tipografía de ticket: reemplazar clases monoespaciadas por la fuente sans-serif (`Geist`) del sistema
  - [ ] Transformar datos de ticket redundantes en metadatos limpios de solo lectura
  - [ ] Limpiar tarjeta de audio eliminando micro-textos redundantes
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Revelado Progresivo de Observaciones y Lógica de Score
- [ ] Task: Implementar revelado progresivo de observaciones en los criterios
  - [ ] Ocultar los text inputs de observación por defecto (`hidden` o colapsados)
  - [ ] Conectar listener para desplegar automáticamente al desmarcar el checkbox de cualquier criterio
  - [ ] Incorporar botón / enlace sutil "+ Agregar nota" para habilitar la observación cuando el check está activo
- [ ] Task: Actualizar representación visual del Score
  - [ ] Modificar el indicador de Sección 2 para mostrar "N/A" / "Excluido" cuando el ticket está desactivado en vez de "0%"
  - [ ] Asegurar que el total final mantenga 100% como puntaje prioritario y visible en primer término
- [ ] Task: Armonizar paleta de colores y estilos tipográficos
  - [ ] Pasar encabezados de ALL CAPS a Sentence case / Title case
  - [ ] Reservar color primario para acción principal de Guardar y neutrales para búsquedas y acciones secundarias
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Verificación Integral y Fidelidad
- [ ] Task: Ejecutar suite de pruebas y validación SSR
  - [ ] Correr `npx playwright test tests/calidad-multicanal-interaction.spec.ts` (Green Phase)
  - [ ] Ejecutar `npm run build` para asegurar integridad del build SSR
  - [ ] Validar visualmente en navegador con capturas o Playwright inspector
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
