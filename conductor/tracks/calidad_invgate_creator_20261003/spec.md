# Specification: Consulta y Visualización del Creador/Generador en Detalle del Ticket InvGate

## 1. Overview
Actualmente, en la obtención de metadatos de tickets de InvGate para las auditorías de Calidad (`src/lib/qualityMetadataFetcher.ts`), se resuelve el solicitante/cliente asignando `targetUserId = incident.user_id ?? incident.creator_id`.
Sin embargo, en el modelo de InvGate existen dos entidades claramente diferenciadas:
- `user_id`: El Solicitante (usuario afectado que pide el requerimiento).
- `creator_id`: El Creador/Generador real del ticket (ej. el agente u operador que cargó la solicitud en el sistema).

Esta mejora añade la consulta y resolución explícita del Creador (`creator_id`) en la API de metadatos de tickets InvGate y su visualización en el Visor de Ticket en Vivo de Calidad (`AuditModal.astro`), diferenciando al Solicitante del Creador/Generador.

## 2. Functional Requirements
- **Resolución en `qualityMetadataFetcher.ts` (`fetchInvgateTicketMetadata`)**:
  - Resolver el solicitante usando específicamente `incident.user_id` (`customerName`).
  - Resolver el creador/generador usando específicamente `incident.creator_id` (`creatorName`). Si `incident.user_id === incident.creator_id`, reutilizar la información ya consultada para optimizar peticiones HTTP.
  - Formato: `Nombre Apellido` (trim) o fallback a `username`. Si no se encuentra, `"Desconocido"`.
- **Estructura de Datos `ExtractedQualityMetadata`**:
  - Exponer tanto `customer` (o mantener `creator` como solicitante por compatibilidad) como un nuevo campo explícito `createdBy` (nombre de quien generó/creó el ticket), y actualizar `rawDetails` para contener `createdBy` (creador real) y `customer` (solicitante).
- **Visor de Ticket en Vivo (`AuditModal.astro`)**:
  - Incorporar una nueva celda/tarjeta en el grid de metadatos del Visor de Ticket para **"Creado por" / "Generador"** (`#tv-created-by`), manteniendo la de **"Solicitante"** (`#tv-creator`).
  - Mostrar claramente a ambos:
    - *Solicitante*: Nombre del usuario afectado.
    - *Creado por*: Nombre del agente/usuario que generó el ticket.
  - Al consultar el ticket (tanto por autogestión como por ticket asociado a llamada/correo), poblar inmediatamente ambos campos.

## 3. Non-Functional Requirements & Design Contract
- Respetar DaisyUI v5 y la tipografía / escala de íconos de `docs/DESIGN.md`.
- No degradar performance: evitar llamadas redundantes a la API de InvGate (`user?id=...`) si `user_id === creator_id`.
- Responsive: el grid de detalles del ticket debe adaptarse limpiamente en pantallas pequeñas (`grid-cols-2 md:grid-cols-3` o similar).

## 4. Acceptance Criteria
- [ ] La API de metadatos (`qualityMetadataFetcher.ts`) resuelve `creator_id` y devuelve el nombre de quien creó el ticket en `createdBy`.
- [ ] Si `user_id` y `creator_id` son personas distintas, la API devuelve ambos nombres diferenciados.
- [ ] Si `user_id` y `creator_id` son la misma persona, la resolución se hace en una sola llamada a la API de usuario.
- [ ] En el modal de auditoría de calidad (`AuditModal.astro`), el visor de ticket muestra ambas tarjetas: "Solicitante" y "Creado por".
- [ ] Todas las pruebas unitarias existentes y las nuevas para resolución de `creator_id` pasan exitosamente.

## 5. Out of Scope
- Modificación del esquema de base de datos (`mda.db`), ya que esto es información consumida en vivo de la API de InvGate para visualización y validación del ticket.
