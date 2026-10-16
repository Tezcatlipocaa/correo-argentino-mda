# Specification: Scraping Unificado de Línea de Tiempo e Historial de Cambios InvGate (vía Azure SSO) para Evaluación IA

## 1. Overview
La API REST de InvGate Service Management (`incident?id={id}`) provee los metadatos estáticos actuales del ticket, pero **no expone el historial de auditoría ni los eventos de cambio** (quién recategorizó el caso, si la prioridad o el tipo fueron corregidos desde su valor original, qué mesas atravesó el ticket o cuándo cambió de estado). Estos eventos solo existen en la vista web del ticket (`/requests/show/index/id/{id}`), donde conviven en orden cronológico junto a los comentarios.

Dado que el portal web de InvGate de Correo Argentino autentica mediante **Azure AD SAML SSO** (haciendo clic en el botón `[data-login-type="azure"]` *"Iniciar sesión"*), este track implementa un cliente híbrido:
1. Usa **Playwright con Contexto Persistente (`launchPersistentContext`)** únicamente para iniciar o renovar la sesión SAML de Azure AD haciendo clic en `[data-login-type="azure"]` y capturando la cookie `IGSMSESSID`.
2. Reutiliza esa cookie `IGSMSESSID` en memoria y disco para hacer **consultas HTTP `fetch` directas y ultrarrápidas (< 0.5s)** al HTML del ticket (`/requests/show/index/id/{id}`), sin abrir un navegador en cada evaluación.
3. Extrae la **Línea de Tiempo Unificada (Comentarios + Historial de Cambios)** y la inyecta en el contexto del Asistente IA antes de evaluar las rúbricas de calidad.

## 2. Functional Requirements
1. **Autenticación SAML Azure AD con Contexto Persistente + Cache de `IGSMSESSID` (`src/lib/invgate/webSession.ts`):**
   - Almacenar el perfil persistente de navegador y la cookie cacheada en un directorio local seguro (ej. `database/.invgate-session` y `database/.invgate-web-cookie.json`).
   - En cada solicitud de scraping de un ticket:
     - **Paso Rápido (Fast-Path):** Intentar `fetch` directo a `/requests/show/index/id/{ticketId}` enviando `Cookie: IGSMSESSID=<cached>`.
     - **Detección de Expiración:** Si la respuesta es `401` o contiene el formulario `#form_login` / `[data-login-type="azure"]`, disparar el renovador de sesión con Playwright (`chromium.launchPersistentContext`).
     - **Renovación SAML Automática:** Navegar a la URL del ticket, hacer clic en `a[data-login-type="azure"]` (*"Iniciar sesión"*), aguardar la redirección automática de Azure AD de regreso a InvGate, extraer la nueva cookie `IGSMSESSID` (y el HTML ya cargado) y cerrar el navegador liberando toda la RAM.

2. **Extracción Unificada de Línea de Tiempo (Comentarios + Historial de Cambios):**
   - Parsear el DOM del ticket (validado contra el ticket real `#90688` y estructura de InvGate v8.23.5).
   - Extraer en orden cronológico unificado:
     - **Comentarios y Mensajes:** Autor, fecha/hora, contenido limpio, indicador de solución o nota interna.
     - **Eventos del Historial de Cambios:**
       - Cambios de **Categoría** (inicial vs. final — clave para `email_mda_categorizacion_final` y `ag_mda_categorizacion_final`).
       - Cambios de **Prioridad** y **Tipo de solicitud** (clave para `ag_correccion_prioridad` y `ag_correccion_tipo`).
       - Reasignaciones de **Mesa de Ayuda / Operador** y cambios de **Estado** (Abierto → En espera → Solucionado → Cerrado).
       - Adjuntos o referencias vinculadas.

3. **Integración Híbrida con Fallback Transparente en `qualityAiEvaluator.ts`:**
   - Mantener los metadatos base de la API REST de InvGate (`fetchInvgateTicketMetadata`) y enriquecer el contexto del ticket con la Línea de Tiempo completa extraída del HTML.
   - Si la extracción web devuelve la línea de tiempo unificada, utilizarla en lugar de la lista simple de comentarios de la API para evitar duplicados y preservar la secuencia exacta entre comentarios y cambios de estado/categoría/prioridad.
   - Si el scraping falla (ej. entorno sin sesión de Azure o timeout), hacer **fallback transparente** a los comentarios de la API REST para no bloquear nunca la auditoría.

## 3. Non-Functional Requirements
- **Eficiencia de Recursos:** El navegador de Playwright solo se abre cuando `IGSMSESSID` no existe o expiró, y se cierra inmediatamente después de capturar la nueva cookie. Las evaluaciones subsiguientes corren por `fetch` puro en < 500ms.
- **Seguridad:** Los archivos de sesión y cookies locales deben estar ignorados en `.gitignore` y nunca exponerse en respuestas de API ni logs.

## 4. Acceptance Criteria
- [ ] El renovador de sesión navega al login de InvGate, hace clic en `a[data-login-type="azure"]`, obtiene la cookie `IGSMSESSID` tras el SSO de Azure y la persiste localmente.
- [ ] Con `IGSMSESSID` vigente, el scraper obtiene y parsea el ticket `#90688` mediante `fetch` directo sin levantar Chromium.
- [ ] El parser extrae tanto los comentarios como los cambios de historial (categoría, prioridad, tipo, asignaciones y estados) en orden cronológico.
- [ ] `buildTicketContext()` inyecta la línea de tiempo enriquecida en el prompt de OpenCode y mantiene fallback a los comentarios de la API si el scraper no está disponible.
