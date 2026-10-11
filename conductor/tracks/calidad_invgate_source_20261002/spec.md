# Specification: Consulta de Origen de Solicitud (Source) en Tickets InvGate

## Overview
Al consultar un ticket de InvGate desde el modal de auditoría de calidad (sea mediante el buscador manual de InvGate o por autocompletado en auditorías de llamadas, emails o tickets directos), se visualizan datos clave del incidente. Sin embargo, no se expone el canal o vía por la cual ingresó el ticket a la plataforma (**Origen de la solicitud**: ej. *Correo*, *Teléfono*, *Web / Portal*, *API*, etc.).
Esta funcionalidad incorpora la extracción y resolución del Origen de la Solicitud desde los datos del ticket de InvGate, integrándolo en el modelo de metadatos y visualizándolo en la cuadrícula de metadatos del Visor de Ticket en vivo (`#ticket-viewer-content`).

## Functional Requirements
1. **Extensión del Modelo de Metadatos (`src/lib/qualityMetadataFetcher.ts`):**
   - Extender la interfaz `ExtractedQualityMetadata` agregando la propiedad opcional: `source?: string;`.
   - Definir un diccionario de nombres canónicos para orígenes frecuentes de InvGate:
     - `INVGATE_SOURCE_NAMES: Record<number, string>` (1: "Correo", 2: "Portal Web", 3: "Teléfono", 4: "Chat", 8: "API", etc.).
2. **Extracción y Resolución en Backend (`src/lib/qualityMetadataFetcher.ts`):**
   - En `parseInvgateAgMetadata()`:
     - Aceptar `extra.sourceName` y resolver como fallback `incident.source?.name`, o mediante `INVGATE_SOURCE_NAMES[incident.source_id]`.
     - Devolver el campo `source` en el objeto resultante y en `rawDetails.source`.
   - En `fetchInvgateTicketMetadata()`:
     - Obtener `incident.source?.name` o derivarlo de `incident.source_id`.
     - Si no estuviera en el diccionario y hay un `source_id`, consultar opcionalmente `incident.attributes.source` con fallback seguro a `"Sin origen registrado"`.
3. **Visualización en el Visor de Ticket (`src/components/supervision/calidad/AuditModal.astro`):**
   - Agregar en la cuadrícula de metadatos (`grid grid-cols-2`) una tarjeta para **Origen**:
     - Elemento `#tv-source` con ícono representativo (`boxicons:broadcast`).
     - Reordenar de forma equilibrada los metadatos (Categoría, Prioridad, Estado, Solicitante, Mesa de Ayuda y Origen).
   - En el script cliente:
     - Declarar la referencia a `const tvSource = document.getElementById("tv-source");`.
     - En `populateTicketViewer(data)`: asignar `data.source || data.rawDetails?.source || "Sin origen"`.
     - En `resetTicketViewer()`: restablecer `#tv-source` a `"-"`.
4. **Verificación Automatizada (`tests/calidad-multicanal-interaction.spec.ts`):**
   - Extender el mock de respuesta de InvGate con `source: "Teléfono"`.
   - Agregar aserción Playwright verificando que `#tv-source` contenga `"Teléfono"`.

## Non-Functional Requirements
- **Tolerancia a fallos:** Si InvGate no provee `source_id` o el endpoint de atributos no responde, la consulta del ticket no debe verse afectada (mostrar `"Sin origen"`).
- **Consistencia de diseño:** Seguir estrictamente el sistema de tokens DaisyUI v5 y tipografía sans-serif.

## Acceptance Criteria
- [ ] La consulta de metadatos de ticket InvGate incluye la propiedad `source`.
- [ ] El Visor de Ticket en vivo muestra el bloque "Origen" con su valor resuelto.
- [ ] Al reiniciar o limpiar el modal, `#tv-source` se resetea a `"-"`.
- [ ] La suite de pruebas E2E `tests/calidad-multicanal-interaction.spec.ts` pasa al 100%.
- [ ] `npm run build` compila limpiamente sin fallos de TypeScript ni SSR manifest.

## Out of Scope
- Persistencia de columna nueva en la tabla de auditorías SQLite.
