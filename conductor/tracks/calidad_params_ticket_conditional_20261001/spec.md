# Especificación: Ajuste de Parámetros de Calidad y Condicional de Ticket en Llamadas y Mails

## 1. Overview
Este track implementa la reestructuración canónica de los parámetros de evaluación de calidad para los canales **Llamadas Wise** y **Mails Wise**, remueve parámetros obsoletos (`Reclamo / Novedad` y `Solicitud`), e incorpora una verificación condicional explícita (**¿Se generó ticket?**) para evaluar llamadas y correos que no requirieron apertura o derivación a ticket en InvGate.

---

## 2. Functional Requirements

### 2.1 Reestructuración de Parámetros en Llamadas Wise (`wise_call`)
1. **Sección 1: Gestión de la Llamada / Atención (Base 45 puntos)**
   - Debe contener exclusivamente los siguientes 10 parámetros:
     1. `call_cordialidad`: Cordialidad y cortesía (3%)
     2. `call_saludo_estandar`: Uso del saludo estándar (3%)
     3. `call_interes_resolver`: Demuestra interés en resolver el problema (3%)
     4. `call_sondeo`: Sondeo (6%)
     5. `call_escucha_activa`: Escucha en forma activa y atenta (6%)
     6. `call_control_conversacion`: Control de la conversación (3%)
     7. `call_contencion_espera`: Contención en la espera (3%)
     8. `call_despedida_cordial`: Se despide cordialmente (3%)
     9. `call_lenguaje_apropiado`: Lenguaje apropiado (5%)
     10. `call_procedimiento`: Cumplimiento de procedimiento (10%)
   - **Eliminar:** `call_solicitud` ("Solicitud").
   - Total base Sección 1: 45 puntos.

2. **Sección 2: TICKET (Gestión y Registro) (Base 55 puntos)**
   - Debe contener exclusivamente los siguientes 8 parámetros:
     1. `call_ticket_origen`: Origen de la solicitud (6%)
     2. `call_ticket_tipo`: Tipo de solicitud (5%)
     3. `call_ticket_categorizacion`: Categorización (10%)
     4. `call_ticket_ortografia`: Ortografía (8%)
     5. `call_ticket_prioridad`: Prioridad (6%)
     6. `call_ticket_titulo`: Título (7%)
     7. `call_ticket_descripcion`: Descripción / Evidencia (7%)
     8. `call_ticket_exactitud_datos`: Exactitud en el ingreso de datos (6%)
   - **Eliminar:** `call_ticket_reclamo_novedad` ("Reclamo / Novedad").
   - Total base Sección 2: 55 puntos.

### 2.2 Condicional de Ticket en Llamadas Wise
1. Añadir el control `¿Se generó ticket? [checkbox/toggle]` en la cabecera de la Sección 2 de Llamadas Wise.
2. **Estado inicial por defecto:** `checked = true` al abrir una nueva auditoría.
3. **Comportamiento interactivo:**
   - Si está marcado (`true`): se muestra la lista de parámetros de ticket y se pondera Sección 1 (45) + Sección 2 (55) = 100%.
   - Si está desmarcado (`false`): se oculta la lista de parámetros de ticket, se muestra un mensaje informativo ("No se generó ticket para esta llamada (solo puntúa Sección 1)"), y el score total se calcula al 100% únicamente con la Sección 1 (`Math.round((s1Raw / 45) * 100)`).

### 2.3 Reestructuración y Condicional en Mails Wise (`wise_email`)
1. **Renombrar control condicional:**
   - Cambiar la etiqueta `¿Aplica MDA?` por `¿Se generó ticket?`.
   - Actualizar el placeholder cuando está desmarcado a: "No se generó ticket para este correo (solo puntúa Sección 1)".
2. **Eliminar parámetro `Reclamo / Novedad`:**
   - Remover `email_mda_reclamo_novedad` de `WISE_EMAIL_PARAMETERS`.
   - La Sección 2 queda con los 10 parámetros vigentes cuya suma total da exactamente 100%.

### 2.4 Motor de Cálculo (`qualityCalculator.ts`)
1. Actualizar `calculateMultiChannelAuditScores`:
   - Para `wise_call`: si `hasSection2 === false`, `section2Score = 0`, y `totalScore = section1Score`. Si `hasSection2 === true`, `totalScore = s1Raw + s2Raw`.
   - Para `wise_email`: mantiene cálculo existente con Sección 1 al 100% cuando no tiene ticket.

---

## 3. Acceptance Criteria
1. El modal de auditoría en Llamadas Wise muestra exactamente los 10 parámetros solicitados en Atención y los 8 en Ticket.
2. Al desmarcar `¿Se generó ticket?` en Llamadas Wise, la Sección 2 se oculta y el score total refleja el 100% de la Sección 1.
3. En Mails Wise el toggle dice `¿Se generó ticket?` y la lista de MDA ya no contiene `Reclamo / Novedad`.
4. Todos los tests unitarios (`vitest`) y de integración E2E (`playwright`) pasan con éxito.

---

## 4. Out of Scope
- Modificaciones al canal de Autogestiones (`invgate_ticket`).
- Modificaciones a tablas de auditoría en SQLite (se reutilizan los campos existentes de compatibilidad).
