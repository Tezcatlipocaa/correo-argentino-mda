# Specification: Unificación de Búsqueda API en Campos de Atención y Enlace Directo InvGate

## Overview
Unificar la experiencia de búsqueda en el Modal de Auditoría de Calidad (`AuditModal.astro`). Se elimina la tarjeta redundante superior `unified-search-card` y se integran las acciones de búsqueda por API directamente en los inputs de "Datos de la atención":
- **Nro Caso / Llamada:** acción de búsqueda API Wise CX integrada con soporte de tecla `Enter`.
- **Nro Ticket InvGate:** acción de búsqueda API InvGate integrada con soporte de tecla `Enter`, más botón de enlace directo externo a la URL del ticket en InvGate.

## Functional Requirements
1. **Eliminación de `unified-search-card`:**
   - Remover el bloque contenedor con tabs Wise CX / InvGate y sus inputs duplicados (`wise-search-id`, `invgate-search-id`, `tab-search-wise`, `tab-search-invgate`).
2. **Campos enriquecidos en Datos de la Atención:**
   - `form-call-id` (Nro Caso / Llamada):
     - Input agrupado (`join` / flex) con botón de búsqueda (ícono lupa, color violeta).
     - Tecla `Enter` ejecuta búsqueda en API Wise (`/api/calidad/fetch-metadata?channel=...&id=...&source=wise`).
     - Prevenir submit accidental del formulario con `Enter`.
     - Indicador spinner durante la carga.
   - `form-ticket-id` (Nro Ticket InvGate):
     - Input agrupado con botón de búsqueda (ícono lupa, color secondary).
     - Botón de enlace externo (ícono `boxicons:link-external`, abre en nueva pestaña) que navega a la URL derivada de InvGate.
     - El botón de enlace externo se habilita/deshabilita dinámicamente según haya o no un ID numérico ingresado.
     - Tecla `Enter` ejecuta búsqueda en API InvGate (`/api/calidad/fetch-metadata?channel=invgate_ticket&id=...&source=invgate`).
     - Prevenir submit accidental del formulario con `Enter`.
     - Indicador spinner durante la carga.
3. **Feedback y Alertas:**
   - Mensajes de feedback (éxito, error, advertencia) mostrados en contenedores compactos y limpios dentro o debajo de la sección de datos básicos.
4. **Preservación de Lógica y Paneles:**
   - Mantener auto-detección de canal (llamada vs mail para Wise).
   - Mantener autollenado de fecha, tiempos (duración, ringueo, creación, toma), checkbox PAS y vinculación cruzada.
   - Mantener integración con reproductor de audio Wise y Live Ticket Viewer de InvGate.

## Acceptance Criteria
- No existe el bloque duplicado `unified-search-card`.
- Presionar `Enter` o clickear la lupa en "Nro Caso / Llamada" consulta la API de Wise CX y llena los campos correspondientes.
- Presionar `Enter` o clickear la lupa en "Nro Ticket InvGate" consulta la API de InvGate y llena los campos correspondientes.
- Con un número de ticket InvGate ingresado, el botón de enlace directo abre la URL correcta de InvGate en nueva pestaña.
- Todas las validaciones y cálculos de scores continúan funcionando.
