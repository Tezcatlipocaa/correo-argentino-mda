# Specification: Auto-detección y Conmutación de Canal (Llamada vs Mail) en Búsqueda Wise CX

## 1. Overview
En el sistema de auditorías de Calidad, las llamadas y los correos de Wise CX comparten el mismo espacio de numeración e identificadores de caso. Actualmente, si el evaluador se encuentra en la pestaña "Llamadas Wise" e ingresa el ID de un correo (o viceversa), la búsqueda intenta parsear el caso con la lógica del canal erróneo.
Con este track, el backend inspecciona el atributo `source_channel` retornado por la API de Wise CX (`email` vs `incoming_call` u otros tipos de llamada telefónica). Al detectar el tipo real, parsea los metadatos correspondientes (grabación y duración para llamadas; tiempo de respuesta calculado para correos) y retorna `detectedChannel` en la respuesta. El frontend del modal de auditoría (`AuditModal.astro`) detecta si el canal real no coincide con el seleccionado actualmente, conmuta automáticamente la pestaña del canal activo (actualizando checklist, etiquetas, reproductor de audio y campos específicos), y notifica al usuario con un mensaje de feedback informativo.

## 2. Functional Requirements
1. **Metadata Fetcher & API (`src/lib/qualityMetadataFetcher.ts` y `/api/calidad/fetch-metadata`)**:
   - Al buscar un caso en Wise CX:
     - Extraer `source_channel` de `caseData` (ej: `"email"`, `"incoming_call"`, etc.).
     - Discernir canal canónico mediante helper `discernWiseChannel(sourceChannel: string): ChannelType`: si `source_channel === "email"`, el canal es `"wise_email"`; si contiene `"call"` o `"telephony"`, es `"wise_call"`.
     - Si el canal solicitado en la búsqueda no coincide con el canal detectado (o si se hace una búsqueda Wise genérica):
       - Parsear el caso con el extractor correspondiente al canal detectado (`parseWiseCallMetadata` o `parseWiseEmailMetadata`).
       - Retornar en `ExtractedQualityMetadata` la propiedad `detectedChannel: ChannelType`.
2. **Frontend del Modal de Auditoría (`AuditModal.astro`)**:
   - Al recibir la respuesta del buscador Wise:
     - Si `data.detectedChannel` viene definido y difiere del canal activo en el formulario (`formChannelType.value`):
       - Conmutar la pestaña activa ejecutando click en `.channel-btn[data-channel="${d.detectedChannel}"]`.
       - Mostrar mensaje en `wiseFeedbackAlert` indicando el cambio automático (ej: `✓ Caso detectado como Mail Wise — canal conmutado automáticamente`).
     - Proceder al llenado de los campos del formulario correspondientes al canal detectado.
3. **Tests Unitarios**:
   - Nuevos tests en `tests/unit/` para verificar el discernimiento de canales según `source_channel` y la asignación de `detectedChannel`.

## 3. Non-Functional Requirements
- Cumplimiento de Testing Policy (TDD: escribir tests antes del código).
- Coherencia visual con Tailwind v4 y DaisyUI v5.
- Cero regresiones en auditorías ya existentes o en búsqueda de tickets InvGate.

## 4. Acceptance Criteria
- Al estar en la pestaña "Llamadas Wise" e ingresar el ID de un mail (ej. `533785`, `533959`, `535257`), el modal conmuta automáticamente a "Mails Wise", muestra el campo "Respuesta" con su cálculo correspondiente, y oculta los campos de llamada.
- Al estar en la pestaña "Mails Wise" e ingresar el ID de una llamada (ej. `534787`), el modal conmuta automáticamente a "Llamadas Wise", muestra "Duración", "Tiempo ringueo" y el reproductor de audio si corresponde.
- Al buscar un caso cuyo canal coincide con el seleccionado, funciona normalmente sin cambios de pestaña innecesarios.

## 5. Out of Scope
- Canales que no pertenezcan a Wise CX (`invgate_ticket` se mantiene con su propio buscador).
