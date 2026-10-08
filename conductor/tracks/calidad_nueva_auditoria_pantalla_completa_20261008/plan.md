# Implementation Plan: Rediseño de Pantalla Completa: Nueva Auditoría de Calidad

## Phase 1: Estructura General de Pantalla, Header Sticky y Barra de Configuración
- [ ] Task: Crear pruebas o validaciones para layout completo, header compacto y barra de configuración
    - [ ] Definir casos de prueba en suite E2E para la página completa `/supervision/calidad-operadores/nueva`
    - [ ] Verificar presencia de header compacto, badge de estado, botones de acción y barra de configuración
- [ ] Task: Refactorizar contenedor general en `src/pages/supervision/calidad-operadores/nueva.astro`
    - [ ] Adaptar página a pantalla completa (max 1440px, padding responsive, sin contenedor de modal restrictivo)
    - [ ] Implementar scroll general natural del documento
- [ ] Task: Diseñar e implementar Header Superior Compacto
    - [ ] Incluir botón "Volver a evaluaciones", título, subtítulo, badge "Borrador / Sin guardar"
    - [ ] Incluir acciones secundarias ("Guardar borrador", "Ayuda") y acción primaria derecha ("Guardar auditoría")
- [ ] Task: Implementar Barra de Configuración Principal
    - [ ] Bloque Operador: selector con avatar, nombre completo y usuario
    - [ ] Bloque Periodo: selector de mes y año
    - [ ] Bloque Canal de Atención: segmented control interactivo (*Llamada Wise*, *Mail Wise*, *Autogestión*) con estilo activo destacado
    - [ ] Línea de contexto: cantidad de criterios y peso total (100%)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Columna Izquierda — Datos de Atención y Contexto del Ticket
- [ ] Task: Crear casos de prueba para formulario de atención y contexto de ticket
    - [ ] Validar inputs de llamada/caso, ticket InvGate, fecha obligatoria, duración y ringue/primera respuesta
    - [ ] Validar comportamiento de tarjeta de contexto del ticket (cargado, sin ticket, acordeón)
- [ ] Task: Implementar Tarjeta "Datos de la atención"
    - [ ] Grid responsive de 2 columnas para inputs con botones de búsqueda rápida
    - [ ] Formateo y validación de campos de tiempo (mm:ss) y fecha
- [ ] Task: Implementar Tarjeta "Contexto del ticket"
    - [ ] Estado visual: badge "Ticket cargado" o "Sin ticket cargado"
    - [ ] Botones "Abrir en InvGate" y "Cargar datos del ticket"
    - [ ] Acordeón colapsable con detalles del ticket (título, categoría, prioridad, cliente, fecha)
    - [ ] Empty state informativo y compacto cuando no hay ticket cargado
- [ ] Task: Conectar integraciones de búsqueda de caso/ticket existentes
    - [ ] Integrar búsqueda con endpoint Wise CX e InvGate
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Columna Derecha — Score en Tiempo Real, Stepper y Tarjetas de Criterios con Notas Inline
- [ ] Task: Crear casos de prueba para cálculo de score, navegación de secciones y notas inline
    - [ ] Probar reactividad del score en tiempo real, pesos y barras de progreso
    - [ ] Probar controles "Todos" / "Ninguno", colapso de secciones y despliegue de notas inline
- [ ] Task: Implementar Tarjeta de "Score en tiempo real"
    - [ ] Indicadores de criterios evaluados (X de Y), score actual y peso completado
    - [ ] Barra de progreso con colores semánticos (verde, ámbar, rojo) y sin estados vacíos ambiguos
- [ ] Task: Implementar Navegación de Secciones (Tabs / Stepper horizontal)
    - [ ] Tabs para Interacción con el usuario, Gestión del ticket y Resumen
    - [ ] Progreso por sección visible y responsive con scroll horizontal en móvil
- [ ] Task: Implementar Tarjetas de Sección de Criterios
    - [ ] Cabecera de tarjeta: número, nombre, peso en puntos, score actual
    - [ ] Botones de cabecera: "Todos", "Ninguno", expandir/contraer sección
- [ ] Task: Implementar Filas de Criterios y Notas Inline
    - [ ] Checkbox/switch de cumplimiento, peso, badge de estado visual (Cumple / No cumple / N/A / Pendiente)
    - [ ] Botón de nota inline que expande textarea debajo de la fila sin abrir modal
- [ ] Task: Implementar Tarjeta "Resumen y observaciones"
    - [ ] Puntaje proyectado, fortalezas detectadas, oportunidades de mejora
    - [ ] Textarea para feedback y observaciones generales
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Footer Sticky, Validaciones y Guardado de Auditoría
- [ ] Task: Crear pruebas para sticky footer y flujo de guardado
    - [ ] Validar sincronización de score en el footer y habilitación de botones
    - [ ] Validar llamada a `actions.saveAudit` y redirección con toast de confirmación
- [ ] Task: Implementar Footer Inferior Sticky
    - [ ] Barra sticky al pie con resumen de score, estado y botones de acción
- [ ] Task: Implementar Validaciones Inline y Prevención de Errores
    - [ ] Validación de campos obligatorios y aviso no bloqueante sobre criterios pendientes
- [ ] Task: Conectar persistencia con `actions.saveAudit`
    - [ ] Mapear datos del nuevo formulario a la firma esperada por el backend
    - [ ] Manejo de respuesta, notificación toast y redirección
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: Verificación Integral, Pruebas E2E y Cierre
- [ ] Task: Ejecutar suite de pruebas unitarias (`npm run test:unit -- tests/unit`)
- [ ] Task: Ejecutar suite de pruebas E2E de Playwright (`npx playwright test tests/calidad-*.spec.ts`)
- [ ] Task: Ejecutar build SSR de producción para verificar manifest y assets (`npm run build`)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
