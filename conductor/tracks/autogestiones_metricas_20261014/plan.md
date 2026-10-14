# Plan de Implementación: Métricas y Estadísticas de Autogestiones

## Phase 1: Capa de Datos, Servicio de Agregación y Endpoints API [checkpoint: efbeb3b]
- [x] Task: Escribir tests de dominio para el servicio de métricas de autogestión (efbeb3b)
  - [x] Crear `src/lib/autogestion/metricasService.test.ts` definiendo casos de prueba para agregaciones temporales, por operador y por tipo
  - [x] Ejecutar `npm run test:domain` y verificar el estado inicial de pruebas
- [x] Task: Implementar el servicio de agregación de métricas `src/lib/autogestion/metricasService.ts` (efbeb3b)
  - [x] Implementar consultas optimizadas en SQLite sobre `assignment_history` (volumen temporal, carga por operador, desglose por tipo `cyclic`/`manual`/`batch_suggested`/`batch_all`)
  - [x] Integrar lectura de la cola en vivo de InvGate (`getUnassignedTicketsByHelpdesk`) para métricas de tickets pendientes y categorías
  - [x] Implementar cálculo de KPIs globales (total asignadas, % automatización, operadores únicos)
- [x] Task: Implementar endpoints API para consumo dinámico y exportación (efbeb3b)
  - [x] Crear `src/pages/api/autogestion/metricas/index.ts` (GET con filtros de fecha `from`, `to`, `preset`)
  - [x] Crear `src/pages/api/autogestion/metricas/export.csv.ts` para descarga de reporte tabular
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Estructura de Página, Skeleton y Componentes UI (Astro + DaisyUI v5)
- [ ] Task: Crear página base con control de acceso y Skeleton de carga
  - [ ] Crear `src/pages/supervision/autogestiones-metricas.astro` con guard de roles (`supervisor`, `team_leader`, `admin`)
  - [ ] Crear `src/components/supervision/autogestion/AutogestionesMetricasSkeleton.astro` como fallback de `server:defer`
- [ ] Task: Implementar componente principal `AutogestionesMetricasContent.astro`
  - [ ] Barra superior con selector de presets temporales (*Hoy, Ayer, Últimos 7 días, Últimos 30 días, Mes actual*), selector de fechas personalizadas, botón de refresco y exportación
  - [ ] Grilla de KPIs clave (tarjetas DaisyUI v5)
  - [ ] Grilla responsiva de contenedores `<canvas>` para los 5 gráficos
  - [ ] Tabla de auditoría con historial de asignaciones recientes y enlaces a InvGate
  - [ ] Inclusión de Chart.js vía CDN (`chart.umd.min.js@4.4.7`)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Lógica Interactiva en Cliente y Gráficos Chart.js
- [ ] Task: Implementar script cliente `autogestiones-metricas-client.ts`
  - [ ] Detección y espera reactiva de `window.Chart`
  - [ ] Renderizado y configuración visual de los 5 gráficos:
    1. Gráfico de evolución temporal (Bar / Line)
    2. Gráfico de carga por operador (Horizontal Bar)
    3. Gráfico de desglose por modalidad (Doughnut)
    4. Gráfico de cola en vivo por categoría (Doughnut / Bar)
    5. Ranking de creadores / sucursales con más solicitudes
  - [ ] Paleta cromática adaptada a los tokens semánticos de DaisyUI v5
- [ ] Task: Interactividad de filtros y refresco sin recarga completa
  - [ ] Conectar selector de fechas con endpoint API mediante `fetch` para actualización fluida de gráficos y KPIs
  - [ ] Conectar botón de actualización manual para sincronizar datos en vivo de InvGate
  - [ ] Conectar botón de exportación CSV con descarga directa
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Integración en Navegación, Enlaces Cruzados y Verificación E2E
- [ ] Task: Integrar ruta en navegación y enlaces cruzados
  - [ ] Registrar `/supervision/autogestiones-metricas` en `src/lib/navigation.ts`
  - [ ] Añadir botón de acceso directo en `src/components/supervision/asignacion/AsignacionContent.astro` hacia la nueva página de métricas y viceversa
- [ ] Task: Pruebas automatizadas y verificación de compilación
  - [ ] Crear spec E2E en Playwright `tests/supervision/autogestiones-metricas.spec.ts` validando carga de página, RBAC, renderizado de gráficos y conmutación de filtros
  - [ ] Ejecutar build de producción (`npm run build`) y verificar integridad del manifest SSR
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
