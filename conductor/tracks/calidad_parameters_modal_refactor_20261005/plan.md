# Implementation Plan: Refactor y Modernización del Modal de Parámetros de Calidad

## Phase 1: Estructura, Layout Shell y Header Compacto
- [ ] Task: Rediseñar contenedor del modal (`parameters-modal`) en `CalidadContent.astro` para altura controlada (`max-h-[85vh]`), scroll interno independiente y footer fijo
- [ ] Task: Unificar cabecera compacta con selector de Canal horizontal responsive (`overflow-x-auto` en móvil) y selector de pestañas con estados activos contrastados
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Editor de Criterios, Reordenamiento y Acciones de Fila
- [ ] Task: Rediseñar markup de filas de criterios (`renderParameterRow`) con nombre expandido, peso numérico compacto (`w-20`), controles accesibles subir/bajar (▲/▼) y botón de eliminación discreto
- [ ] Task: Implementar lógica de reordenamiento de criterios (swap en array `localParams`) y eliminación suave con estado "A eliminar" y botón "Restaurar"
- [ ] Task: Configurar botón contextual `+ Agregar criterio` adaptativo según la subsección activa
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Resumen Dinámico de Pesos, Validación y Feedback
- [ ] Task: Implementar componente/badge de resumen en vivo (`X criterios · Peso total: Y%`) con estilos semánticos (`success` si 100%, `warning` accesible si != 100%)
- [ ] Task: Conectar validaciones al guardar en `actions.saveParameters`: impedir nombres vacíos, alertar amigablemente si el peso total difiere de 100% y mostrar feedback adecuado
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Verificación E2E y Accesibilidad
- [ ] Task: Crear suite de pruebas E2E con Playwright (`tests/calidad-parameters-modal.spec.ts`) cubriendo apertura del modal, edición de peso, reordenamiento, resumen dinámico y guardado
- [ ] Task: Verificar compilación completa (`npm run build`) y comportamiento responsive / accesibilidad
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
