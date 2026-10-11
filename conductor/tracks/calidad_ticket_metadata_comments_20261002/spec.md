# Specification: Bug Fixes — Tickets InvGate (Caracteres y Metadatos) y Comentarios de Parámetros de Calidad

## 1. Overview
Corrige tres anomalías en el módulo de Supervisión de Calidad e integración con InvGate:
1. Caracteres residuales por codificación HTML hexadecimal (ej: `&#xED;`, `&#xE9;`, `&#xF3;`) en la descripción del ticket.
2. Metadatos de ticket InvGate nulos o erróneos (estado, prioridad, cliente y categoría) causados por mapeo incorrecto de IDs (`status_id`, `priority_id`, `category_id`, `user_id`).
3. Campos de observación por parámetro de tamaño reducido (`input-xs`) y aparente pérdida tras guardar (no se visualizaban en la tarjeta de auditoría ni se recargaban en modo edición).

## 2. Functional Requirements

### FR-1: Decodificador Universal de Entidades HTML (`cleanHtmlText`)
- Soporte para decodificar entidades hexadecimales (`&#x[0-9a-fA-F]+;`) y decimales (`&#[0-9]+;`).
- Decodificación completa de tildes, eñes y caracteres especiales en descripciones y visor de tickets.
- Mantener preservación de saltos de línea y sanitización básica de etiquetas HTML.

### FR-2: Resolución Completa de Metadatos de Ticket InvGate (`qualityMetadataFetcher`)
- Mapear `status_id` usando el diccionario canónico de estados de InvGate (Nuevo, Abierto, Pendiente, En espera, Solucionado, Cerrado, Rechazado, Cancelado).
- Mapear `priority_id` (1: Baja, 2: Media, 3: Alta, 4: Urgente).
- Resolver el nombre completo del cliente/creador a través de `user?id=${incident.user_id}` (o `creator_id`).
- Resolver el operador asignado si existe `assigned_id` mediante llamada o referencia de usuario.
- Resolver el nombre de la categoría a través de `category_id` (consultando o mapeando desde la API de InvGate).
- Proporcionar fallbacks robustos en caso de indisponibilidad de la API de InvGate o datos no definidos.

### FR-3: Estilo, Visibilidad y Persistencia de Comentarios por Parámetro
- Rediseñar el input de comentario a `input-sm text-xs` con padding cómodo y bordes consistentes con DaisyUI.
- Asegurar que `scoresToInsert` guarde el comentario y que `CalidadContent.astro` incluya el campo `comment` en el payload de llamadas.
- Mostrar el comentario ingresado debajo de cada parámetro en la tarjeta de detalle de la auditoría cuando exista.
- Precargar los comentarios en los campos correspondientes al abrir el modal en modo edición (`_comment`).
- Limpiar los campos de comentario al crear una nueva auditoría.

## 3. Non-Functional Requirements
- **Performance:** Minimizar llamadas redundantes y procesar resoluciones de usuario y categoría eficientemente.
- **Seguridad:** Sanitizar contra XSS al inyectar textos de comentarios y descripciones decodificadas.

## 4. Acceptance Criteria
- [ ] La descripción del ticket muestra tildes y símbolos limpios sin rastros de entidades como `&#x...;`.
- [ ] El Visor de Ticket muestra Título, Categoría, Prioridad, Estado y Cliente reales obtenidos de InvGate.
- [ ] La celda de comentario por parámetro tiene tamaño legible (`input-sm`).
- [ ] Al guardar una auditoría con comentarios, estos se muestran en la tarjeta de auditoría y se precargan al editar.

## 5. Out of Scope
- Modificación en el cálculo global del score de calidad.
- Modificación estructural de la tabla de base de datos (la columna `comment` en `auditScores` ya existe).
