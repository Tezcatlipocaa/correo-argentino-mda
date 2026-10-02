# Implementation Plan: Reformulación y Modernización UI/UX del Modal de Auditoría de Calidad

## Phase 1: Encabezado, Selector de Canales y Barra de Búsqueda Unificada
- [x] Task: Rediseñar Encabezado del Modal y Pestañas de Canales
  - [x] Alinear título del modal verticalmente con los botones superiores de canal.
  - [x] Unificar botones de canal en un control segmentado (`join` DaisyUI con estilos neutros/secundarios).
- [x] Task: Implementar Barra de Búsqueda Unificada con Selector de Servicio
  - [x] Reemplazar las dos barras independientes por una barra unificada con switch/selector integrado de modo (Wise CX / InvGate).
  - [x] Adaptar dinámicamente placeholders, iconos y lógica de trigger de búsqueda.
  - [x] Implementar feedback sutil (toast temporal / badge de estado sin banners intrusivos).
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Organización de Campos Básicos y Detalle del Ticket en Vivo
- [x] Task: Reorganizar Cuadrícula de Datos Básicos (3 Columnas)
  - [x] Reestructurar Nro Caso, Nro Ticket, Duración, Fecha, Ringueo, Creación, Toma y PAS en cuadrícula de 3 columnas armónica.
  - [x] Optimizar espaciado y márgenes de los campos de formulario.
- [x] Task: Refinar Visor del Ticket / Caso en Vivo
  - [x] Moderar tipografía del título del ticket con tags alineados.
  - [x] Presentar metadatos (Categoría, Prioridad, Estado, Solicitante) en cards limpias con bordes suaves y tipografía monospace.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Score Calculado, Criterios de Evaluación y Estado Vacío
- [x] Task: Rediseñar Bloque de Score Calculado
  - [x] Jerarquizar `TOTAL FINAL 100%` con máxima prominencia visual.
  - [x] Subordinar puntajes parciales de Sección 1 y 2 con divisores sutiles.
- [x] Task: Optimizar Espaciado en "1. Gestión de la Llamada / Atención"
  - [x] Aumentar padding y gaps entre criterios de evaluación e inputs de observación.
  - [x] Estilizar scrollbars para que sean discretos.
- [x] Task: Estado Vacío Elegante en "2. TICKET (Gestión y Registro)"
  - [x] Diseñar tarjeta ilustrada con icono suave y mensaje centrado cuando `¿Se generó ticket?` esté inactivo.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Microinteracciones, Consistencia Global y Verificación
- [x] Task: Microinteracciones y Pulido Visual Global
  - [x] Transiciones de hover/focus consistentes (150-200ms) y tokens semánticos DaisyUI en todo el modal.
- [x] Task: Verificación E2E y Build
  - [x] Validar compilación SSR (`npm run build`).
  - [x] Ejecutar verificaciones automáticas de renderizado (Playwright E2E 100% verde).
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
