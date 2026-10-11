# Specification: Auto-evaluación Asistida del Origen del Ticket InvGate

## Overview
Actualmente, el sistema de calidad cuenta con auto-evaluación para el parámetro de *Título Homologado*, el cual analiza el texto del ticket InvGate contra el catálogo aprobado y ajusta el checkbox correspondiente.
Este track implementa una regla análoga para el parámetro **Origen de la solicitud**:
- **Llamadas Wise (`wise_call`)**: Al vincular o consultar un ticket InvGate, el origen debe ser **Teléfono** (o contener variaciones como "telefono", "llamada"). Si coincide, se mantiene cumplido (`checked=true`); si difiere, se desmarca automáticamente (`checked=false`), se muestra un badge de penalización por regla y se recalcula el score.
- **Mails Wise (`wise_email`)**: El origen debe ser **Correo** (o contener "correo", "email", "mail"). Si coincide, se mantiene cumplido; si difiere, se desmarca automáticamente con advertencia de regla y recálculo de score.
- **Autogestiones / Tickets Directos (`invgate_ticket`)**: No aplica esta regla (el parámetro no existe en la matriz de tickets directos o queda a criterio manual del auditor).

## Functional Requirements
1. **Lógica de Validación Asistida (`src/components/supervision/calidad/AuditModal.astro`):**
   - Función `evaluateTicketSource(sourceStr: string)`:
     - Detecta el canal actual (`formChannelType?.value`).
     - Si es `wise_call`: el parámetro a evaluar es `call_ticket_origen`. El origen esperado es "Teléfono" / "Llamada".
     - Si es `wise_email`: el parámetro a evaluar es `email_mda_origen`. El origen esperado es "Correo" / "Email" / "Mail".
     - Si es `invgate_ticket`: no ejecuta ninguna acción restrictiva.
     - Compara normalizando acentos, mayúsculas y espacios:
       - Si coincide: marca el checkbox correspondiente (`checked = true`), oculta el badge de advertencia del criterio (`setParamRuleBadge(name, false)`), y muestra badge de éxito en el Visor de Ticket (`#tv-source-match-badge` -> "Origen Válido").
       - Si no coincide o falta: desmarca el checkbox (`checked = false`), muestra el badge en el criterio (`setParamRuleBadge(name, true, "Origen incorrecto")`), muestra badge de advertencia en el Visor de Ticket (`#tv-source-match-badge` -> "Origen no coincide") y ejecuta `recalculateScores()`.
2. **Feedback Visual en el Visor de Ticket:**
   - En la tarjeta de **Origen** del Visor de Ticket (`#tv-source`), incorporar un contenedor `#tv-source-match-badge` para mostrar badges compactos DaisyUI (`badge-success` / `badge-warning`).
   - Al invocar `resetTicketViewer()`, limpiar `#tv-source-match-badge` y ocultar los badges de regla asociados.
3. **Invocación:**
   - `evaluateTicketSource` se invoca de forma automática al poblar los datos del ticket en `populateTicketViewer(data)` inmediatamente después de `evaluateTicketTitle(title)`.
4. **Verificación Automatizada (`tests/calidad-multicanal-interaction.spec.ts`):**
   - Caso de prueba validando que al consultar un ticket de origen "Teléfono" en una auditoría de llamada Wise, el checkbox `call_ticket_origen` permanezca marcado y válido.
   - Caso de prueba validando que si en una auditoría de llamada Wise el ticket tiene origen "Correo" o "Portal Web", el checkbox `call_ticket_origen` se desmarque automáticamente y exhiba el badge de regla.

## Acceptance Criteria
- [ ] En auditorías `wise_call`, un ticket con origen "Teléfono" marca como válido `call_ticket_origen`.
- [ ] En auditorías `wise_call`, un ticket con origen no telefónico desmarca `call_ticket_origen` con badge "Origen incorrecto" y descuenta el puntaje correspondiente.
- [ ] En auditorías `wise_email`, un ticket con origen "Correo" marca como válido `email_mda_origen`.
- [ ] En auditorías `wise_email`, un ticket con origen no correo desmarca `email_mda_origen` con badge "Origen incorrecto".
- [ ] En `invgate_ticket` no se aplican restricciones indebidas.
- [ ] Suite de pruebas E2E pasando al 100% y `npm run build` exitoso.
