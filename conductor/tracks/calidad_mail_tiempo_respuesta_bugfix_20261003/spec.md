# Specification: Bugfix: Tiempo de Respuesta en Mails Wise basado en Primera Respuesta del Operador (`user_reply`)

## 1. Overview
En el cálculo del campo "Respuesta" para Mails Wise (`channel === "wise_email"`), casos con rebotes posteriores o reaperturas (como el caso `533959`) registraban un tiempo inflado (ej. `02:43:17`) debido a que se utilizaba exclusivamente `solved_at` / `closed_at`, el cual se actualizó a las 15:33 cuando el operador cerró definitivamente el caso tras el fallo de entrega. Sin embargo, la atención y respuesta real del operador ocurrió a las 13:39 (actividad `user_reply`), representando 49 minutos y 25 segundos (`49:25`).
Este bugfix actualiza la obtención y parseo de metadatos de Mails Wise para consultar las actividades del caso (`/core/v1/cases/:id/activities?fields=id,case_id,type,user_id,channel,created_at`) y extraer la fecha de la primera respuesta del operador (`type === "user_reply"`). Si existe, se utiliza dicha fecha contra `created_at` del caso; de lo contrario, se mantiene `solved_at` o `closed_at` como fallback.

## 2. Functional Requirements
1. **Metadata Fetcher (`src/lib/qualityMetadataFetcher.ts`)**:
   - En `fetchQualityCaseMetadata` cuando `channel === "wise_email"`:
     - Además de `fetchWiseCaseData`, consultar las actividades del caso vía `/core/v1/cases/:id/activities?fields=id,case_id,type,user_id,channel,created_at`.
     - Buscar la primera actividad de respuesta del operador (`a.type === "user_reply"`).
     - Si hay `user_reply`, pasar su `created_at` a `parseWiseEmailMetadata` (como `firstReplyAt`).
   - En `calculateWiseEmailResponseTime(createdAt, replyAt, solvedAt, closedAt)`:
     - Prioridad de fecha de fin: `replyAt || solvedAt || closedAt`.
     - Calcular diferencia en segundos contra `createdAt`.
     - Retornar tiempo formateado como `MM:SS` (o `HH:MM:SS` si >= 3600 segundos). Fallback `"00:00"`.
   - En `parseWiseEmailMetadata(caseData, operatorName, firstReplyAt)`:
     - Invocar `calculateWiseEmailResponseTime(caseData.created_at, firstReplyAt, caseData.solved_at, caseData.closed_at)`.
     - Asignar el resultado a `metadata.duration`.
     - Incluir `firstReplyAt` en `metadata.rawDetails`.

## 3. Non-Functional Requirements
- Cumplimiento de la Testing Policy (TDD: tests unitarios en `tests/unit/` antes de escribir la implementación).
- No degradar performance (la llamada de actividades es rápida y paralela o ligera con campos específicos).
- Coherencia con el diseño existente de Tailwind v4 y DaisyUI v5.

## 4. Acceptance Criteria
- Caso de error `533959`:
  - `created_at`: 2026-09-02 15:49:47
  - `user_reply` `created_at`: 2026-09-02 16:39:12
  - `solved_at`: 2026-09-02 18:33:04
  - Tiempo de respuesta calculado: **`49:25`** (en lugar de `02:43:17`).
- Casos de prueba anteriores sin regresión:
  - Caso `533785`: **`19:14`**.
  - Caso `535257`: **`07:25`** o **`07:26`**.
  - Caso `538644`: **`16:38`**.
- Casos sin actividad `user_reply`: fallback transparente a `solved_at` o `closed_at`.

## 5. Out of Scope
- Modificaciones al canal de llamadas Wise (`wise_call`) o tickets InvGate (`invgate_ticket`).
- Cambios de base de datos.
