# Especificación Técnica: Buscador Dual (Wise CX & InvGate), Visor de Ticket y Validación Asistida de Títulos

## 1. Overview / Resumen
Dotar al modal de auditoría de calidad de:
1. **Buscadores independientes y específicos**: Buscador de Wise CX y buscador de InvGate accesibles de forma simultánea en auditorías de canales mixtos (Llamada Wise y Mail Wise) y buscador exclusivo de InvGate en Autogestión.
2. **Visor de datos de ticket en vivo**: Panel informativo integrado dentro del modal que visualiza los metadatos y contenido del ticket (Título, Categoría, Prioridad, Estado, Solicitante, Descripción/Evidencia).
3. **Auditoría asistida para "Título"**: Validación automática del título del ticket contra el catálogo de títulos estándar homologados (`titles` / `/api/titulos`), marcando automáticamente la casilla de cumplimiento (Sí/No) con posibilidad de ajuste manual por parte del auditor.

---

## 2. Requerimientos Funcionales

### 2.1 Buscadores Independientes en el Modal
- **Canal Llamada Wise (`wise_call`) y Mail Wise (`wise_email`)**:
  - **Buscador Wise CX**: Campo de texto para número de caso/llamada de Wise con botón "Buscar en Wise". Autocompleta: Nro Caso Wise (`callId`), duración, tiempo de ringueo, fecha, operador.
  - **Buscador InvGate**: Campo de texto para ID de ticket/incidente de InvGate con botón "Buscar en InvGate". Autocompleta: Nro Ticket (`ticketId`), prioridad, operador (si no vino en Wise), y carga los datos en el Visor de Ticket.
- **Canal Autogestión (`invgate_ticket`)**:
  - Buscador exclusivo de InvGate con botón "Buscar en InvGate". Autocompleta todos los metadatos y carga el visor.

### 2.2 Visor de Ticket / Caso en Vivo
- Componente de visualización dentro del modal (tarjeta colapsable / lateral con diseño DaisyUI).
- Muestra de manera clara y tipográfica:
  - **Título del ticket**
  - **Categoría asignada**
  - **Prioridad**
  - **Estado actual**
  - **Solicitante / Contacto**
  - **Descripción / Primer comentario**
- Estado vacío amigable cuando aún no se ha buscado ningún ticket.

### 2.3 Validación Asistida del Parámetro "Título"
- Al cargar el ticket de InvGate:
  - Se normaliza el título del ticket (trim, minúsculas, eliminación de espacios duplicados y caracteres especiales redundantes).
  - Se compara contra la lista de títulos homologados activos del sistema (obtenidos de la tabla `titles` vía endpoint o consulta directa).
  - Si el título existe en el catálogo:
    - Se marca automáticamente el checkbox del parámetro "Título" (o "Corrección del título de la solicitud") como **Cumple (Checked)**.
    - Se muestra un badge verde indicando: `✓ Título homologado válido`.
  - Si el título NO coincide:
    - Se desmarca el checkbox como **No Cumple (Unchecked)**.
    - Se muestra un badge/alerta de advertencia: `⚠ Título no coincide con el catálogo oficial`.
  - El auditor puede alterar manualmente el estado del checkbox en cualquier momento.

### 2.4 Persistencia y Trazabilidad
- Se guardan tanto `call_id` (identificador Wise) como `ticket_id` (identificador InvGate) en la tabla `quality_audits`.

---

## 3. Requerimientos No Funcionales
- **Compatibilidad con estándares del proyecto**: Seguir DaisyUI v5, Astro SSR y Tailwind CSS v4.
- **Sin bloqueo**: Si una de las APIs (Wise o InvGate) falla o se ingresa un ID inexistente, se notifica el error específico sin interrumpir la carga del otro buscador.
- **Extensibilidad**: Estructurar la lógica de validación asistida en funciones modulares para facilitar la adición futura de reglas sobre Categorización, Prioridad y SLA.

---

## 4. Criterios de Aceptación
1. En Llamadas y Mails de Wise existen dos buscadores independientes (Wise e InvGate) que consultan sus respectivas APIs sin pisarse.
2. Al consultar un ticket de InvGate, el visor muestra título, descripción, categoría, estado y prioridad.
3. El parámetro de "Título" se auto-evalúa comparando con el catálogo oficial de títulos, reflejando el estado visual y permitiendo modificación manual.
4. Las pruebas unitarias y E2E validan la búsqueda dual, la renderización del visor y la auto-evaluación del título.

---

## 5. Fuera de Alcance
- Auto-evaluación automática de otros parámetros distintos de "Título" (se implementarán en iteraciones futuras según las reglas específicas de cada uno).
- Modificación directa del ticket en InvGate desde el portal.
