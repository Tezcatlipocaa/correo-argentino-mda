# Implementation Plan: Sistema de Evaluación de Calidad Multi-Canal

## Phase 1: Evolución del Esquema y Catálogo de Parámetros
- [x] Task: Escribir pruebas unitarias para el nuevo modelo de datos y tipos de calidad
  - [x] Escribir tests para tipos de canal (`wise_call`, `wise_email`, `invgate_ticket`) y metadatos
  - [x] Escribir tests de integridad para parámetros con deducción porcentual
- [x] Task: Actualizar esquema Drizzle en `src/db/schema.ts`
  - [x] Agregar `channelType` a `quality_audits` ('wise_call' | 'wise_email' | 'invgate_ticket')
  - [x] Agregar columnas de metadatos (`ringTime`, `creationTime`, `takeTime`, `isPas`, `appliesMda`)
  - [x] Adaptar `audit_parameters` para soportar canal y categoría/sección
- [x] Task: Alinear base de datos local y generar migración
  - [x] Ejecutar `align-db-to-schema.mts` para verificar paridad
- [x] Task: Sembrar/Actualizar catálogo de parámetros de evaluación
  - [x] Cargar los 20 parámetros de Llamadas Wise (Sección Items + Ticket)
  - [x] Cargar los 22 parámetros de Mails Wise (Sección Items + MDA)
  - [x] Cargar los 15 parámetros de Autogestiones (Sección Items + MDA)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Integración de APIs y Extracción de Metadatos
- [x] Task: Escribir pruebas unitarias para los extractores de metadatos
  - [x] Tests con fixtures/mocks para respuesta de Wise Call (`activities.call_data`)
  - [x] Tests con fixtures/mocks para respuesta de Wise Mail
  - [x] Tests con fixtures/mocks para respuesta de InvGate Incident
- [x] Task: Implementar extractores de metadatos en backend
  - [x] Extractor para Llamada Wise: Duración, Ringueo, Operador, Fecha
  - [x] Extractor para Mail Wise: Creación, Toma, Operador, Fecha
  - [x] Extractor para Autogestión InvGate: Prioridad, Fechas, Operador, Detección PAS
- [x] Task: Crear endpoint interno de autocompletado `/api/calidad/fetch-metadata`
  - [x] Validación de sesión y permisos (`requireWriteAccess`)
  - [x] Resolución de caso por canal e ID con manejo de errores y fallbacks
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Motor de Puntuación (Scoring Engine) y Actions
- [x] Task: Escribir pruebas unitarias para el nuevo motor de cálculo (`qualityCalculator.ts`)
  - [x] Tests de cálculo por deducción porcentual de items incumplidos
  - [x] Tests para evaluación condicional de Sección 2 (MDA aplica SÍ/NO)
  - [x] Tests de promedio por canal (Llamadas, Mails, AG) y promedio global
  - [x] Tests de seguimiento de cuota mensual (12 evaluaciones por operador)
- [x] Task: Implementar lógica de cálculo en `src/lib/qualityCalculator.ts`
  - [x] Cálculo de score por sección restando % de ítems no cumplidos
  - [x] Ponderación de Sección 1 y Sección 2 según toggle condicional
  - [x] Funciones de agregación mensual por canal y cálculo de cuota
- [x] Task: Actualizar Astro Actions en `src/actions/index.ts`
  - [x] Modificar `actions.saveAudit` para procesar el payload multi-canal y metadatos
  - [x] Asegurar logging de auditoría para cada nueva evaluación
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Rediseño de UI/UX y Formularios Modales
- [x] Task: Escribir pruebas de componentes / interactividad para el formulario de auditoría
- [x] Task: Renovar el modal de auditoría (`#audit-modal`)
  - [x] Selector visual de Canal (Llamada Wise / Mail Wise / Autogestión)
  - [x] Input de ID de caso con debounce / botón "Buscar" que consulta `/api/calidad/fetch-metadata`
  - [x] Bloque de metadatos autocompletados (Operador, Duración, Ringueo, Fechas, PAS)
  - [x] Checklist dinámico de parámetros con indicador de % de referencia
  - [x] Switch condicional ("¿Aplica evaluación MDA?" / "¿Queda en MDA?") que despliega Sección 2
  - [x] Previsualización reactiva de puntajes en tiempo real
- [x] Task: Rediseñar vista detalle del operador en `CalidadContent.astro`
  - [x] Separación en 3 pestañas o acordeones: Llamadas Wise, Mails Wise, Autogestiones
  - [x] Indicador de progreso de cuota mensual (ej. Llamadas: 4/4, Mails: 2/4, AG: 4/4 - Total: 10/12)
  - [x] Tarjetas de resumen estadístico renovadas (Global, Llamadas, Mails, AG)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: Pruebas E2E y Verificación Final
- [x] Task: Implementar suite E2E en Playwright (`tests/calidad/calidad-multicanal.spec.ts`)
  - [x] Prueba de carga de caso con autocompletado de metadatos
  - [x] Prueba de evaluación con deducción y switch condicional
  - [x] Verificación de persistencia, promedios mensuales y cuota en UI
- [x] Task: Ejecutar build SSR (`npm run build`) y verificar integridad del manifest
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
