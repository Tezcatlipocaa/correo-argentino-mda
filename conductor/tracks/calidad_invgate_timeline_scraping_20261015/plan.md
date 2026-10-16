# Implementation Plan: Scraping Unificado de Línea de Tiempo e Historial de Cambios InvGate (vía Azure SSO) para Evaluación IA

## Phase 1: Exploración del DOM Real (Ticket #90688) y Renovador de Sesión Azure SSO
- [ ] Task: Inspeccionar estructura DOM de `/requests/show/index/id/90688` tras login Azure SSO y diseñar el gestor de sesión (`src/lib/invgate/webSession.ts`)
  - [ ] Implementar función de obtención y renovación de cookie `IGSMSESSID` usando `chromium.launchPersistentContext` (clic en `a[data-login-type="azure"]`, espera de redirección SAML y cierre inmediato del navegador).
  - [ ] Guardar y leer `IGSMSESSID` desde caché en memoria y archivo local ignorado en git (`database/.invgate-web-cookie.json`).
  - [ ] Probar contra el ticket `#90688` para capturar el HTML autenticado real y relevar los selectores exactos de comentarios y eventos del historial de cambios.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Parser de Línea de Tiempo Unificada (Comentarios + Historial de Cambios) con TDD
- [ ] Task: Implementar parser HTML de Línea de Tiempo (`src/lib/invgate/timelineScraper.ts`)
  - [ ] Escribir tests unitarios en `src/lib/invgate/timelineScraper.test.ts` con un fixture representativo del HTML de InvGate v8.23.5 (incluyendo comentarios, solución, cambios de categoría, prioridad, tipo, estado y asignaciones) (Fase Roja).
  - [ ] Implementar `parseInvgateTimelineHtml(html: string)` y `fetchInvgateTicketTimeline(ticketId: string)` usando `fetch` rápido con `IGSMSESSID` y fallback automático a renovación SSO si devuelve 401/login (Fase Verde).
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Integración en `qualityAiEvaluator.ts` y Endpoint `/api/calidad/ai-evaluate`
- [ ] Task: Inyectar la Línea de Tiempo e Historial de Cambios en el contexto del prompt IA
  - [ ] Escribir tests unitarios en `src/lib/qualityAiEvaluator.test.ts` verificando que `buildTicketContext()` formatee la línea de tiempo unificada cuando está presente y haga fallback a `rawIncident.comments` cuando no lo está (Fase Roja).
  - [ ] Actualizar `buildTicketContext()`, `evaluateWithAi()` y `src/pages/api/calidad/ai-evaluate.ts` para obtener e inyectar el historial de cambios junto a los metadatos del ticket (Fase Verde).
  - [ ] Verificar de punta a punta con el ticket `#90688`.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
