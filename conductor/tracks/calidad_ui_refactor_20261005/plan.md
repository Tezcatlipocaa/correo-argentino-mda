# Plan de Implementación: Refactor UI de Calidad

## Fase 1: Nueva Sección de Creación de Auditorías (`/supervision/calidad-operadores/nueva`)
- [x] Task: Crear página `/supervision/calidad-operadores/nueva.astro` con `BaseLayout` y `FormShell.astro` [6153e6b]
  - [x] Diseñar el layout amplio de la página con `FormShell` según estándar corporativo (`docs/FORM_STANDARD.md`)
  - [x] Implementar soporte para preselección de operador y mes mediante parámetros en la URL (`?agentId=...&month=...`)
- [x] Task: Migrar y adaptar el formulario de auditoría desde `AuditModal.astro` [6153e6b]
  - [x] Modularizar el formulario en un componente dedicado (`NewAuditForm.astro`) aprovechando el ancho completo de pantalla
  - [x] Disponer ergonómicamente los selectores de canal, buscador dual (Wise CX / InvGate), metadatos, reproductor de llamadas y matriz de parámetros
  - [x] Conectar la acción de guardado con `/api/calidad/save-audit`, manejo de errores y redirección con toast a `/supervision/calidad-operadores`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Fase 2: Barra Superior Unificada y Grilla de Operadores
- [ ] Task: Implementar la nueva barra superior en `CalidadContent.astro`
  - [ ] Colocar el buscador interactivo (`SearchBar.astro`) en el extremo izquierdo
  - [ ] Agrupar en el extremo derecho el selector de mes, el botón de configuración de parámetros y el botón principal "Nueva auditoría"
- [ ] Task: Construir la cuadrícula responsive de operadores
  - [ ] Reemplazar la barra lateral por un contenedor `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4`
  - [ ] Crear la tarjeta de operador con avatar (iniciales), nombre completo, insignia de excelencia, username (`@legajo`), badge de score global y conteo mensual (`X / 12 auditorías`)
  - [ ] Implementar filtrado en tiempo real en la grilla mediante el buscador de texto y gestionar el estado vacío (`SearchEmptyState`)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Fase 3: Detalle del Operador (Modal para Supervisores y Vista Directa para Operadores)
- [ ] Task: Encapsular `operator-details-panel` dentro de un modal interactivo para supervisores
  - [ ] Configurar el diálogo modal de DaisyUI (`#operator-details-modal`) con scroll vertical y botón de cierre/backdrop
  - [ ] Vincular el clic de cada tarjeta en la grilla para popular y abrir el modal del operador correspondiente
  - [ ] Configurar el botón "Nueva auditoría" del modal para redirigir a `/supervision/calidad-operadores/nueva?agentId=${id}&month=${month}`
- [ ] Task: Habilitar vista directa en pantalla completa para usuarios con rol `agent`
  - [ ] Renderizar directamente el panel de detalles para operadores sin pasar por la grilla ni modal
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Fase 4: Pruebas E2E y Verificación Integral
- [ ] Task: Implementar prueba E2E en Playwright (`tests/e2e/calidad-ui-refactor.spec.ts`)
  - [ ] Validar visualización de la barra superior y filtrado en vivo de tarjetas en la grilla
  - [ ] Validar apertura y visualización del modal al hacer clic en un operador
  - [ ] Validar navegación a la nueva sección `/supervision/calidad-operadores/nueva` y preselección de operador
  - [ ] Validar vista directa para usuarios con rol `agent`
- [ ] Task: Verificación de build y estilos
  - [ ] Ejecutar `npm run build` para asegurar integridad del SSR y ausencia de regresiones
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
