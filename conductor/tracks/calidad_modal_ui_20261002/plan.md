# Implementation Plan: Reformulación y Modernización UI/UX del Modal de Auditoría de Calidad

## Phase 1: Encabezado, Selector de Canales y Barra de Búsqueda Unificada
- [ ] Task: Rediseñar Encabezado del Modal y Pestañas de Canales
  - [ ] Alinear título del modal verticalmente con los botones superiores de canal.
  - [ ] Unificar botones de canal en un control segmentado (`join` DaisyUI con estilos neutros/secundarios).
- [ ] Task: Implementar Barra de Búsqueda Unificada con Selector de Servicio
  - [ ] Reemplazar las dos barras independientes por una barra unificada con switch/selector integrado de modo (Wise CX / InvGate).
  - [ ] Adaptar dinámicamente placeholders, iconos y lógica de trigger de búsqueda.
  - [ ] Implementar feedback sutil (toast temporal / badge de estado sin banners intrusivos).
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Organización de Campos Básicos y Detalle del Ticket en Vivo
- [ ] Task: Reorganizar Cuadrícula de Datos Básicos (3 Columnas)
  - [ ] Reestructurar Nro Caso, Nro Ticket, Duración, Fecha, Ringueo, Creación, Toma y PAS en cuadrícula de 3 columnas armónica.
  - [ ] Optimizar espaciado y márgenes de los campos de formulario.
- [ ] Task: Refinar Visor del Ticket / Caso en Vivo
  - [ ] Moderar tipografía del título del ticket con tags alineados.
  - [ ] Presentar metadatos (Categoría, Prioridad, Estado, Solicitante) en cards limpias con bordes suaves y tipografía monospace.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Score Calculado, Criterios de Evaluación y Estado Vacío
- [ ] Task: Rediseñar Bloque de Score Calculado
  - [ ] Jerarquizar `TOTAL FINAL 100%` con máxima prominencia visual.
  - [ ] Subordinar puntajes parciales de Sección 1 y 2 con divisores sutiles.
- [ ] Task: Optimizar Espaciado en "1. Gestión de la Llamada / Atención"
  - [ ] Aumentar padding y gaps entre criterios de evaluación e inputs de observación.
  - [ ] Estilizar scrollbars para que sean discretos.
- [ ] Task: Estado Vacío Elegante en "2. TICKET (Gestión y Registro)"
  - [ ] Diseñar tarjeta ilustrada con icono suave y mensaje centrado cuando `¿Se generó ticket?` esté inactivo.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Microinteracciones, Consistencia Global y Verificación
- [ ] Task: Microinteracciones y Pulido Visual Global
  - [ ] Transiciones de hover/focus consistentes (150-200ms) y tokens semánticos DaisyUI en todo el modal.
- [ ] Task: Verificación E2E y Build
  - [ ] Validar compilación SSR (`npm run build`).
  - [ ] Ejecutar verificaciones automáticas de renderizado.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
