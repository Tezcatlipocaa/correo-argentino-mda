# Specification: Cálculo de Tiempo de Respuesta y Unificación de Campos en Mails Wise

## 1. Overview
En el módulo de Auditorías de Calidad, para el canal Mails Wise (`channel === "wise_email"`), los campos separados "Creación" (`creationTime`) y "Toma / Lectura" (`takeTime`) se unifican y reemplazan visualmente por un único campo denominado **"Respuesta"** (Tiempo de respuesta).
Este campo calcula automáticamente el lapso transcurrido entre el ingreso del mail (`created_at`) y la respuesta/resolución por parte del operador (`solved_at` o fallback a `closed_at`).
El resultado se formatea como `MM:SS` (o `HH:MM:SS` para casos mayores a 60 minutos), permitiendo también edición manual en el formulario, y se almacena en el campo `duration` de la auditoría. Asimismo, en la vista de tarjetas/lista de auditorías de calidad, para `wise_email` se visualiza la métrica "Respuesta" con dicho valor.

## 2. Functional Requirements
1. **Metadata Fetcher (`src/lib/qualityMetadataFetcher.ts`)**:
   - Al consultar un caso de correo Wise (`wise_email`), además de extraer `created_at`, se analiza `solved_at` (o fallback a `closed_at`).
   - Se implementa una función de cálculo de diferencia temporal `calculateWiseEmailResponseTime(createdAt, solvedAt, closedAt)`:
     - Diferencia en segundos: `Math.max(0, Math.floor((solvedDate.getTime() - createdDate.getTime()) / 1000))`.
     - Si la diferencia es < 3600 segundos (1 hora): formato `MM:SS` (ej: 1154 seg -> `19:14`, 446 seg -> `07:26`, 998 seg -> `16:38`).
     - Si la diferencia es >= 3600 segundos: formato `HH:MM:SS` (ej: `01:15:30`).
     - Si falta `solved_at`/`closed_at` o fecha inválida: fallback a `"00:00"`.
   - Se asigna este valor formateado a `metadata.duration`.

2. **Formulario de Auditoría (`AuditModal.astro`)**:
   - Para el canal `wise_email`:
     - Ocultar los contenedores `meta-creation-container` y `meta-take-container` (estos solo aplican a `invgate_ticket`).
     - Mostrar el contenedor `meta-duration-container` con la etiqueta (label) correspondiente: cuando sea `wise_call` dice "Duración", y cuando sea `wise_email` dice "Respuesta".
     - El valor pre-cargado desde la API en `duration` se asigna a `form-duration`.
   - Para `wise_call`: mantiene `meta-duration-container` con label "Duración" y `meta-ring-container`.
   - Para `invgate_ticket`: mantiene `meta-creation-container` y `meta-take-container` ("Creación" y "Toma / Lectura").

3. **Visualización en Cards y Edición (`CalidadContent.astro`)**:
   - En el renderizado de la tarjeta/fila de auditoría: si `call.channel === "wise_email"`, se muestra el bloque "Respuesta" con el valor de `call.duration || "00:00"`.
   - Al abrir el modal en modo edición (`editQualityCall`), para `wise_email` se carga `callData.duration` en el campo `form-duration`.

4. **Persistencia & Tipos**:
   - Reutiliza el campo existente `duration` en `quality_audits` (no requiere migraciones de base de datos).

## 3. Non-Functional Requirements
- Cumplimiento de la Testing Policy (TDD: tests unitarios en `tests/unit/` antes de implementar el cálculo).
- Sin dependencias externas pesadas adicionales (cálculo de fechas nativo de JS/TS).
- Coherencia con el diseño de Tailwind v4 y DaisyUI v5.

## 4. Acceptance Criteria
- Casos de prueba Wise CX validados:
  - Caso `533785`: creación `12:16:16`, resolución `12:35:30` -> Respuesta: `19:14` (~19 min).
  - Caso `535257`: creación `13:45:46`, resolución `13:53:12` -> Respuesta: `07:26` (~8 min).
  - Caso `538644`: creación `11:41:45`, resolución `11:58:23` -> Respuesta: `16:38` (~17 min).
- En el modal de auditoría, al seleccionar "Mails Wise", se ocultan los campos "Creación" y "Toma / Lectura", mostrando únicamente el campo "Respuesta".
- Al guardar o editar una auditoría de mail Wise, el valor de "Respuesta" persiste y se refleja correctamente en la tarjeta/tabla de Calidad.

## 5. Out of Scope
- Modificación del esquema de base de datos (`quality_audits` ya cuenta con `duration`).
- Alteración del comportamiento en llamadas Wise (`wise_call`) o tickets InvGate (`invgate_ticket`).
