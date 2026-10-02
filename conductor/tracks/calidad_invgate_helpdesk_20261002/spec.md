# Specification: Consulta de Mesa de Ayuda (Helpdesk) en Tickets InvGate

## Overview
Actualmente, al consultar un ticket de InvGate desde el modal de auditoría de calidad (buscador InvGate o autocompletado en canales llamadas, mails o tickets directos), se obtienen y muestran metadatos clave (título, categoría, prioridad, estado, solicitante, descripción y condición PAS). Sin embargo, no se expone explícitamente en qué **Mesa de Ayuda (Helpdesk)** de InvGate se encuentra radicado el ticket.
Esta funcionalidad permite obtener y resolver el nombre del Helpdesk correspondiente tanto desde los datos embebidos del incidente como mediante la resolución de `helpdesk_id` vía API InvGate, presentándolo visualmente en el Visor de Ticket en vivo del modal de auditoría.

## Functional Requirements
1. **Extracción y Resolución de Helpdesk en Backend (`src/lib/qualityMetadataFetcher.ts`):**
   - Extender la interfaz `ExtractedQualityMetadata` para incluir la propiedad opcional `helpdesk?: string;`.
   - En `fetchInvgateTicketMetadata()`:
     - Leer `incident.helpdesk?.name` o `incident.helpdesk` si viene presente.
     - Si solo se dispone de `helpdesk_id` (o si viene como ID numérico), consultar/resolver el nombre consultando el endpoint de helpdesks de InvGate (`helpdesks` / `helpdesksandlevels`) con fallback seguro si falla o no se encuentra.
     - Pasar el `helpdeskName` a `parseInvgateAgMetadata()` y almacenarlo en `metadata.helpdesk` y `metadata.rawDetails.helpdesk`.
2. **Visualización en el Visor de Ticket del Modal (`src/components/supervision/calidad/AuditModal.astro`):**
   - Incorporar en la cuadrícula de metadatos del Visor de Ticket (`#ticket-viewer-content`) una tarjeta para **Mesa de Ayuda** con ícono semántico (`boxicons:help-circle`), manteniendo la tipografía sans-serif limpia.
   - En la lógica de cliente (`populateTicketViewer()` y `resetTicketViewer()`):
     - Asignar el valor de `data.helpdesk || data.rawDetails?.helpdesk || "Sin mesa asignada"` al elemento DOM correspondiente (`#tv-helpdesk`).
     - Restablecer a `"-"` cuando se limpie o resetee el visor.
3. **Compatibilidad en Tests Automatizados (`tests/calidad-multicanal-interaction.spec.ts`):**
   - Actualizar el mock del endpoint `api/calidad/fetch-metadata` para incluir `helpdesk: "Mesa de Ayuda TI"` en la respuesta de prueba.
   - Agregar aserción Playwright verificando que `#tv-helpdesk` contenga el texto esperado tras la búsqueda del ticket InvGate.

## Non-Functional Requirements
- **Resiliencia & Tolerancia a Fallos:** Fallback transparente si InvGate no retorna el helpdesk o si la llamada auxiliar a helpdesks falla (mostrar `"Sin mesa asignada"` sin romper la consulta del ticket).
- **Consistencia Visual:** Seguir el sistema de tokens DaisyUI v5 y la jerarquía de diseño sin colores hardcodeados ni anidación innecesaria.

## Acceptance Criteria
- [ ] Al consultar un ticket InvGate mediante el buscador `#invgate-search-id`, la respuesta de la API incluye el campo `helpdesk`.
- [ ] El Visor de Ticket en vivo (`#ticket-viewer-content`) muestra una celda clara con el nombre de la Mesa de Ayuda.
- [ ] Cuando se resetea el modal o se cambia de caso sin ticket, el campo `#tv-helpdesk` vuelve a `"-"`.
- [ ] La suite de pruebas E2E `tests/calidad-multicanal-interaction.spec.ts` pasa al 100% validando la presencia del helpdesk en el visor.
- [ ] `npm run build` compila con éxito sin errores de TypeScript ni linter.

## Out of Scope
- Modificar el esquema de la base de datos local SQLite (`quality_audits` / `quality_calls`) para persistir la mesa de ayuda histórica (se mantiene como metadato dinámico de consulta del ticket).
