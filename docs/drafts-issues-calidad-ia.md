# Borradores de issues — calidad IA (no publicables: 403 en POST /issues)

El PAT actual (`Tezcatlipocaa`) no tiene permiso de escritura en ninguno de los dos repos
(`Tezcatlipocaa/correo-argentino-mda` y `ignaciorevainera/correo-argentino-mda`), verificado el 2026-10-17.
Los cuatro borradores están listos para copiar/pegar cuando se restablezca el scope `issues:write`.

Repo destino: `ignaciorevainera/correo-argentino-mda` (upstream). Labels verificadas existentes: `mejora`, `architecture`.

---

## 1. `feat(calidad): registrar el veredicto de la IA y la discrepancia con el humano (ground truth)`

Labels: `mejora`, `architecture`

### Diagnóstico / Problema

El asistente de calidad (`evaluateWithCouncil` / `evaluateWithAi`) propone veredictos y el supervisor los aplica al formulario, pero al persistir la auditoría solo queda el veredicto final tildado por el humano. La sugerencia original de la IA —veredicto, confianza, evidencia citada, modelo evaluador— se descarta por completo.

Sin ese registro es imposible medir la tasa de acuerdo IA-Humano, detectar qué criterios concentran alucinaciones o rechazos recurrentes, ni alimentar `rubricas-calidad.md` con evidencia estadística real, que es lo que exige su propia gobernanza.

### Evidencia / Causa

- `src/components/supervision/calidad/NewAuditForm.astro:3057-3089`: `currentAiResults` vive en el scope del navegador; solo se usa para pre-tildar y para inyectar el resumen en las notas, nunca se manda al servidor.
- `src/db/schema.ts:536-551` (`auditScores`): persiste `score` (boolean) y `comment`; no hay columna para el veredicto de la IA, la confianza ni la evidencia.
- `src/actions/index.ts:250-409`: la acción de alta persiste los scores sin ningún campo de provenance de la IA.
- `src/config/ai/rubricas-calidad.md:15-26`: la plantilla de Ground Truth exige registrar veredicto IA, evidencia citada, razonamiento y Ground Truth humano, y hoy no existe dónde anotarlo.

### Propuesta / Solución

1. Agregar la tabla satélite `quality_ai_verdicts` en `src/db/schema.ts`: `auditId` (FK a `quality_audits.id`, cascade), `parameterCode`, `model`, `cumple` (boolean nullable), `confianza` (real), `evidencia` (text), `razonamiento` (text), `discrepancia` (boolean) e índice por `parameterCode`.
2. Serializar `currentAiResults` en el submit de `NewAuditForm.astro` (`currentAiResults:2739-2866`) y aceptar el payload en la acción de alta.
3. Insertar los veredictos en la misma transacción que los `auditScores`.
4. Calcular `discrepancia` en el servidor comparando el veredicto de la IA contra el score persistido, sin confiar en el cliente.
5. Exponer una vista de solo lectura para supervisores con % de acuerdo global y desglose por criterio.

### Criterios de Aceptación

- [ ] La tabla existe en el esquema y `scripts/align-db-to-schema.mts` corre sin diferencias.
- [ ] Una auditoría con sugerencia de IA guarda un registro por criterio evaluado, con modelo, confianza y evidencia.
- [ ] Una auditoría sin ejecutar el asistente no crea filas en la tabla.
- [ ] `discrepancia` se calcula server-side y coincide con la comparación del veredicto IA contra el score humano.
- [ ] La vista de supervisores muestra % de acuerdo global y desglosado por criterio, excluyendo del denominador las auditorías sin IA.

### Tareas a Realizar

- [ ] Definir `quality_ai_verdicts` en `src/db/schema.ts` con relaciones e índice por `parameterCode`.
- [ ] Agregar el campo opcional (array de veredictos) al schema Zod de la acción de alta en `src/actions/index.ts`.
- [ ] Persistir los veredictos en la misma transacción que `auditScores`.
- [ ] Serializar `currentAiResults` en el submit de `NewAuditForm.astro`.
- [ ] Implementar la agregación de acuerdo global y por criterio.
- [ ] Agregar el bloque de visualización en `/supervision/calidad-operadores`.

### Dependencias

- **Bloqueado por:** ninguno - listo para comenzar.
- **Clasificación:** `[AFK]`

---

## 2. `feat(calidad): devolver al operador un coaching estructurado en vez de un resumen para el supervisor`

Labels: `mejora`, `architecture`

### Diagnóstico / Problema

El asistente de IA concatena un único párrafo de síntesis al inicio del campo Notas de la auditoría. Es un resumen pensado para el supervisor, no una devolución formativa: no distingue fortalezas de oportunidades, no cita la evidencia que las sustenta y no propone un fraseo modelo para el operador.

El feedback constructivo que recibe el operador depende por completo del tiempo y criterio de redacción de cada supervisor, y no queda en ningún campo consultable.

### Evidencia / Causa

- `src/components/supervision/calidad/NewAuditForm.astro:3079-3084`: se inyecta `currentAiResults.resumen` con el prefijo `[Asistente IA - <modelo>]:` dentro del mismo `formNotes` que usa el supervisor. No hay campo separado.
- `src/lib/ai/types.ts` (`AiResponseSchema`): el resumen es una cadena libre; no hay estructura capaz de expresar fortalezas, oportunidades y acción modelo.
- `src/db/schema.ts:486-522` (`quality_audits`): el único campo de texto libre es `notes`, mixto entre notas privadas y devolución al operador.
- `src/lib/qualityAiEvaluator.ts:236`: el prompt le pide al modelo un "resumen ejecutivo (máx 2-3 oraciones)", o sea synthesis, no coaching.

### Propuesta / Solución

1. Agregar al schema de respuesta de la IA un bloque `coaching` con tres campos: `fortalezas` (string[]), `oportunidades` (string[], cada una con la referencia al criterio y su evidencia) y `respuestaModelo` (string, ejemplo de redacción o fraseo alternativo).
2. Pedirlo en el prompt (`qualityAiEvaluator.ts:236-249`) manteniendo `resumen` como síntesis para el supervisor, sin breaking change del schema existente.
3. Agregar el campo `operatorCoaching` a `quality_audits` (o a la tabla satélite de veredictos, si se implementa antes la issue de ground truth), separado de `notes`.
4. Mostrar `operatorCoaching` en un textarea propio, editable por el supervisor antes de guardar, inicializado con la propuesta de la IA.
5. Exponer la devolución en las vistas de consulta/export de auditorías ya existentes.

### Criterios de Aceptación

- [ ] La respuesta del evaluador incluye `coaching` con `fortalezas`, `oportunidades` y `respuestaModelo`; el parseo tolera que `coaching` venga ausente (modelos chicos).
- [ ] `resumen` sigue poblándose y se sigue mostrando al supervisor: no es un breaking change de `AiResponseSchema`.
- [ ] El formulario tiene un campo visible e independiente "Devolución al Operador", editable, que no se solapa con las notas privadas.
- [ ] La devolución se persiste y se muestra en la vista de detalle de una auditoría ya evaluada.
- [ ] El supervisor puede vaciar el campo y guardar igual.

### Tareas a Realizar

- [ ] Extender `AiResponseSchema` en `src/lib/ai/types.ts` con el bloque `coaching` opcional.
- [ ] Actualizar el prompt en `qualityAiEvaluator.ts` y el ejemplo JSON de `:249`.
- [ ] Agregar la columna de devolución al esquema y al mapeo de la acción de alta.
- [ ] Agregar el textarea independiente en `NewAuditForm.astro`, inicializado desde `currentAiResults`.
- [ ] Mostrar la devolución en la vista de detalle de auditoría.

### Dependencias

- **Bloqueado por:** ninguno - se puede implementar de forma independiente.
- **Clasificación:** `[AFK]`

---

## 3. `feat(calidad): pre-auditoria en lote con muestreo inteligente y filtro de casos sugeridos`

Labels: `mejora`, `architecture`

### Diagnóstico / Problema

La evaluación por IA es 100% reactiva: el supervisor busca un caso puntual, abre el modal y ejecuta el análisis (`POST /api/calidad/ai-evaluate` es síncrono y unitario). Eso limita la auditoría a una muestra reducida y elegida al azar, y deja sin cubrir los casos que más la necesitan.

Casos con desvíos graves, maltrato o incumplimiento de protocolo pueden quedar sin auditar hasta que el problema ya se volvió crónico o llegó a una queja.

### Evidencia / Causa

- `src/pages/api/calidad/ai-evaluate.ts:27`: el handler es un endpoint síncrono que atiende un único caso por request; no hay lote ni cola.
- `ecosystem.config.cjs:12-42`: los procesos recurrentes en producción (`mda-ping-cubics`, `sync-users`, `sync-office-links`, `purge-deleted-records`) usan `cron_restart`, pero ninguno cubre calidad.
- `src/lib/qualityAiEvaluator.ts:278,322`: `acquireAiSlot` ya gobierna la concurrencia y las cuotas; existe el mecanismo, no el consumidor masivo.
- `src/lib/autogestion/autoAssignRunner.ts`: patrón ya implementado en el repo de corrida recurrente con lock en memoria, reusable como molde.
- `src/pages/supervision/calidad-operadores`: la bandeja no tiene ningún criterio de prioridad ni filtro por riesgo.

### Propuesta / Solución

1. Crear `scripts/quality-batch-runner.ts` siguiendo el patrón de `autoAssignRunner.ts`: lock en memoria, corrida idempotente y log de resultado.
2. Registrar el runner en `ecosystem.config.cjs` con `cron_restart` diario fuera de la ventana de audits.
3. Seleccionar los casos cerrados en las últimas 24 h (llamadas Wise, mails Wise y tickets InvGate), o una muestra configurable si el volumen no entra en la cuota.
4. Envolver cada evaluación en `acquireAiSlot` y respetar el límite de concurrencia y la cuota diaria de la API.
5. Persistir las banderas de riesgo (score estimado, tono conflictivo, abandono, tiempo de espera anómalo) sin crear la auditoría: son candidatos, no auditorías.
6. Agregar en `/supervision/calidad-operadores` un filtro "Sugeridos por IA para auditar" que enlace directo al caso.

### Criterios de Aceptación

- [ ] El runner se puede ejecutar manualmente y en modo dry-run, e informa cuántos casos tomó, cuántos procesó y cuántos omitió por cuota.
- [ ] Ninguna evaluación se ejecuta sin pasar por `acquireAiSlot`.
- [ ] Una corrida repetida sobre la misma ventana no duplica candidatos.
- [ ] El runner respeta el corte de cuota diaria sin lanzar errores por límite de tasa.
- [ ] Las banderas de riesgo se almacenan aunque el supervisor nunca audite el caso.
- [ ] El filtro "Sugeridos por IA para auditar" muestra los candidatos ordenados por riesgo y abre el caso en el formulario.

### Tareas a Realizar

- [ ] Implementar `scripts/quality-batch-runner.ts` con lock, dry-run y logging.
- [ ] Registrar el proceso en `ecosystem.config.cjs` con su `cron_restart`.
- [ ] Definir el query de selección de casos de las últimas 24 h por canal.
- [ ] Integrar `acquireAiSlot` y el control de cuota diaria.
- [ ] Persistir las banderas de riesgo.
- [ ] Agregar el filtro en la bandeja `/supervision/calidad-operadores`.

### Dependencias

- **Bloqueado por:** ninguno - listo para comenzar.
- **Clasificación:** `[AFK]`

---

## 4. `feat(calidad): habilitar la evaluacion asistida de los criterios reclamo_novedad (llamada y mail)`

Labels: `mejora`, `architecture`

### Diagnóstico / Problema

Los criterios `call_ticket_reclamo_novedad` y `email_mda_reclamo_novedad` están excluidos de forma permanente de la evaluación por IA: forman parte de `NEVER_EVALUATE`.

Estos miden una buena práctica crítica de la Mesa de Ayuda. Cuando un usuario se contacta reiterando un problema previo no resuelto ("es la tercera vez que llamo", "el ticket de la semana pasada sigue sin andar"), el operador debe vincular el caso al ticket preexistente o documentar el antecedente, en lugar de abrir un ticket huérfano que duplica el inventario de incidentes. Al quedar fuera del alcance de la IA, esa detección depende de que el supervisor escuche todo el audio o lea el correo y después revise el historial en InvGate a mano.

### Evidencia / Causa

- `src/lib/qualityAiEvaluator.ts:21`: `NEVER_EVALUATE = new Set(["call_ticket_reclamo_novedad", "email_mda_reclamo_novedad", "email_solicitud"])`.
- `src/lib/qualityAiEvaluator.ts:47`: `if (NEVER_EVALUATE.has(code)) return false;` — el criterio se descarta antes de construir el prompt.
- `src/lib/ai/councilEvaluator.ts:33-63`: `ALPHA_PATTERNS` / `BETA_PATTERNS` no tienen patrón que cubra estos códigos, por eso no están en el reparto del Council.
- `src/db/schema.ts:512`: `isReclamoNovedad` existe como boolean, con default `false` y cálculo manual en `src/actions/index.ts:304-335`.
- `src/lib/qualityExport.ts:168,193,326-335,425-434`: el criterio pesa 0.55 en la sección 2 de la llamada y 1 en la del mail, y se saltea cuando `isReclamoNovedad` es false. Es una porción significativa del score sin asistencia.
- `src/config/ai/rubricas-calidad.md`: no existe ningún bloque `## criterio: call_ticket_reclamo_novedad` ni `## criterio: email_mda_reclamo_novedad`, así que no hay definición canónica que el modelo pueda aplicar.

### Propuesta / Solución

1. Escribir los bloques canónicos `## criterio: call_ticket_reclamo_novedad` y `## criterio: email_mda_reclamo_novedad` en `rubricas-calidad.md`, respetando el orden de claves obligatorio (Nombre, Objetivo, Reglas, Ejemplos, Few-Shot) que exige la gobernanza del archivo.
2. Regla a codificar: si el solicitante menciona una gestión previa y el ticket creado no la referencia ni la justifica, `cumple: false`; si no hubo mención de una gestión previa, `cumple: true`.
3. Quitar ambos códigos de `NEVER_EVALUATE` en `qualityAiEvaluator.ts:21`.
4. Agregar el patrón correspondiente en `ALPHA_PATTERNS` (`councilEvaluator.ts:33`): es un criterio de proceso y trazabilidad del ticket, no de trato ni ortografía.
5. Actualizar `councilEvaluator.test.ts`, que hoy cubre la cobertura de buckets, y validar que los dos códigos no quedan huérfanos (el `throw` de `:85` los detecta en runtime).

### Criterios de Aceptación

- [ ] `rubricas-calidad.md` contiene los dos bloques con la sintaxis exacta `## criterio: <codigo>` y son parseados por `src/lib/ai/rubricsLoader.ts`.
- [ ] Los dos códigos ya no están en `NEVER_EVALUATE`.
- [ ] Ambos quedan asignados a un agente del Council y ningún criterio queda huérfano.
- [ ] Reclamo con mención de gestión previa y ticket huérfano dictamina `cumple: false`; sin mención previa dictamina `cumple: true`.
- [ ] La evidencia citada por el modelo proviene solo de campos exportados del ticket, la transcripción o el hilo de correo, nunca de supuestos.
- [ ] `councilEvaluator.test.ts` cubre los dos códigos en la cobertura de buckets.

### Tareas a Realizar

- [ ] Redactar los dos bloques de rúbrica en `src/config/ai/rubricas-calidad.md`.
- [ ] Remover ambos códigos de `NEVER_EVALUATE` en `src/lib/qualityAiEvaluator.ts:21`.
- [ ] Agregar el patrón en `ALPHA_PATTERNS` en `src/lib/ai/councilEvaluator.ts`.
- [ ] Extender la cobertura de buckets en `src/lib/ai/councilEvaluator.test.ts`.
- [ ] Verificar el parseo de las rúbricas nuevas con `rubricsLoader`.

### Dependencias

- **Bloqueado por:** ninguno - listo para comenzar.
- **Clasificación:** `[AFK]`
