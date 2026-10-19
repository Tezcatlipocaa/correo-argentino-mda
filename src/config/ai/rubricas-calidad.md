# Rúbricas Oficiales de Evaluación de Calidad — Mesa de Ayuda TI (Portal MDA)

Este documento es la **Fuente Única de Verdad (Single Source of Truth)** para la evaluación asistida por Inteligencia Artificial en las auditorías de calidad de operadores.
Cualquier modelo de lenguaje (Nemotron, DeepSeek, MiMo, etc.) debe ajustarse estrictamente a las definiciones, evidencias requeridas y ejemplos expuestos a continuación.

---

## Protocolo de Mantenimiento y Control de Cambios

Esta sección rige la gobernanza técnica, lingüística y estructural de este archivo. Su cumplimiento es obligatorio para cualquier operador humano o agente de IA que edite las rúbricas, con el fin de prevenir la degradación del prompt (*efecto espagueti*), contradicciones semánticas o sobreajuste (*overfitting*).

### 1. Formato de Solicitud de Modificación (Input de Corrección)
Ninguna regla o ejemplo de este documento puede alterarse de forma improvisada. Toda modificación originada por una discrepancia entre el auditor humano y la IA debe documentarse y validarse previamente bajo la siguiente plantilla estructurada:

```markdown
- **Parámetro afectado (`codigo`):** [Ej: `call_ticket_prioridad` / `ag_sondeo`]
- **Input evaluado (Contexto del caso):** [Resumen anónimo de los metadatos y comentarios del ticket InvGate que dispararon el error]
- **Resultado arrojado por la IA:**
  - Veredicto: [`cumple: true | false | null`] (Confianza: X%)
  - Evidencia citada: "[Cita extraída por el modelo]"
  - Razonamiento IA: "[Explicación errónea o desviada del modelo]"
- **Resultado esperado (Ground Truth Humano):**
  - Veredicto esperado: [`cumple: true | false | null`]
  - Evidencia real determinante: "[Dato concreto del ticket que la IA ignoró o malinterpretó]"
- **Justificación de la discrepancia (Causa Raíz):** [Explicar si el fallo se debió a ambigüedad léxica en la regla actual, omisión de un escenario operativo o falta de contraejemplo Few-Shot]
```

### 2. Condiciones de Validez (Criterios de Aceptación del Cambio)
Un cambio en este documento solo es admisible si supera las siguientes 4 compuertas lógicas:
1. **Generalización vs. Caso Aislado (Anti-Overfitting):** La regla modificada debe resolver un **patrón operativo recurrente** y no un caso anecdótico o excepcional. Se prohíbe mencionar nombres propios de operadores, tickets particulares o fechas específicas dentro de las reglas generales.
2. **Consistencia Ortogonal (No Contradicción):** El ajuste en un criterio no puede invadir ni contradecir el alcance de otro parámetro del mismo canal (ej. no evaluar ortografía ni tiempos de SLA dentro de `descripcion`, ni mezclar `ag_analisis` con `ag_sondeo`).
3. **Preservación de Reglas Deterministas:** Queda estrictamente prohibido agregar en este archivo criterios que el motor del Portal MDA resuelve exclusivamente por código determinista (`*_titulo`, `*_origen`, `*_sla_*`).
4. **Falsabilidad con Evidencia Textual:** Toda regla debe poder verificarse leyendo únicamente los campos exportados del ticket (`Título`, `Descripción`, `Categoría`, `Prioridad`, `Tipo`, `Estado`, `Solicitante`, `Creado por`, `Campos personalizados` y `Línea de Tiempo e Historial de Cambios`), la transcripción telefónica de Wise CX en llamadas, o el hilo de correos electrónicos de Wise CX (`emailThread`) en casos de correo. No se admiten reglas que exijan suponer intenciones no escritas.

### 3. Estándares de Calidad y Estilo del `.md`
Para preservar la eficiencia del *parser* selectivo (`src/lib/ai/rubricsLoader.ts`) y maximizar la atención de los modelos pequeños y medianos, toda edición debe respetar esta gramática:
- **Delimitador Inmutable de Parsing:** Cada criterio debe iniciar obligatoriamente con el encabezado exacto `## criterio: <codigo_exacto>` en minúsculas, precedido y seguido por un separador `---`. **Nunca** utilizar el prefijo `## criterio:` para subtítulos informativos o notas generales.
- **Estructura Canónica de Bloque:** Todo bloque de criterio debe mantener estrictamente el siguiente orden de claves:
  1. `- **Nombre:**` Denominación oficial del parámetro y su canal entre paréntesis.
  2. `- **Objetivo:**` Una sola oración en infinitivo que defina el propósito de negocio del ítem.
  3. `- **Qué buscar en el ticket:**` Instrucción directa que indique exactamente qué campos del contexto comparar.
  4. `- **Regla Cumple (\`cumple: true\`):**` Condiciones afirmativas, taxativas y observables.
  5. `- **Regla No Cumple (\`cumple: false\`):**` Condiciones de rechazo explícitas y desvíos operativos concretos.
  6. `- **Caso Null (\`cumple: null\`):**` (Opcional) Escenario exacto donde la falta de datos impide emitir juicio sin penalizar al operador.
  7. `- **Ejemplo Cumple:**` y `- **Ejemplo No Cumple:**` Pares Few-Shot compuestos por `Evidencia` (máx. 160 caracteres) y `Razonamiento` (máx. 180 caracteres).
- **Tono y Concisión:** Redactar en modo imperativo/descriptivo, lenguaje técnico neutro y sin adjetivos subjetivos ("bueno", "aceptable", "más o menos claro"). Reemplazar expresiones vagas por umbrales concretos (ej. *"menos de 15 palabras sin detalle técnico"* en lugar de *"descripción corta"*).
- **Prohibición de Parches ("Efecto Espagueti"):** Queda prohibido agregar bloques del tipo *"Nota:", "Actualización:", "Ojo:", "Excepción agregada el día X:"* al final de un criterio. Cuando una regla evoluciona, **se reescribe y refina la regla existente** para que lea como una única pieza cohesiva.

### 4. Optimización para Aprendizaje en Contexto (In-Context Learning / Modelos Free)
Dado que los modelos gratuitos de OpenCode no se reentrenan y dependen exclusivamente de este archivo como único contexto en tiempo de ejecución, cada criterio debe maximizar su eficacia *In-Context*:
- **Determinismo Entrada → Salida:** Cada regla debe funcionar como una tabla de decisión sin zonas grises: ante una misma `Evidencia` del ticket, distintos modelos (*Nemotron*, *DeepSeek*, *MiMo*) deben arribar de forma unívoca al mismo valor (`true`, `false` o `null`).
- **Alineación con el Formato de Salida JSON:** Los sub-bloques `Ejemplo Cumple` y `Ejemplo No Cumple` actúan como anclas *Few-Shot* directas. Deben respetar las cotas del schema de respuesta (`evidencia` ≤ 160 caracteres, `razonamiento` ≤ 180 caracteres) para que el modelo imite exactamente esa densidad y longitud al responder.
- **Trazabilidad Causal en los Ejemplos:** Todo `Razonamiento` de ejemplo debe vincular explícitamente el dato citado en `Evidencia` con la condición de la regla aplicada (patrón: *[Dato observado en el ticket] → [Regla de la rúbrica que se cumple o incumple]*).

---

## criterio: call_ticket_tipo
- **Nombre:** Tipo de solicitud (Llamada Wise)
- **Objetivo:** Verificar que el ticket generado refleje adecuadamente si se trata de un Incidente (falla, interrupción o degradación de un servicio) o un Requerimiento/Solicitud de servicio (alta, acceso, cambio, consulta, instalación).
- **Qué buscar en el ticket:** Comparar el campo `type_id` (o tipo asignado) contra la descripción del problema informado por el usuario en la llamada.
- **Regla Cumple (`cumple: true`):**
  - El ticket fue tipificado como Incidente ante una interrupción o rotura de servicio operativo.
  - El ticket fue tipificado como Solicitud/Requerimiento ante un pedido de nuevo servicio, permisos, configuración o provisión estándar.
- **Regla No Cumple (`cumple: false`):**
  - Una falla evidente (ej: "no funciona el sistema de paquetería", "impresora rota", "pantalla azul") fue caratulada como Solicitud.
  - Un pedido estándar (ej: "solicito acceso a carpeta compartida") fue caratulado como Incidente.
- **Caso Null (`cumple: null`):** Si no hay información disponible del tipo (`type_id` no provisto).
- **Ejemplo Cumple:**
  - Evidencia: "type_id: 1; Descripción indica que la PC se reinicia continuamente en boca de atención."
  - Razonamiento: "Correctamente clasificado como Incidente por tratarse de una interrupción de hardware."
- **Ejemplo No Cumple:**
  - Evidencia: "type_id: 2; Descripción indica caída total de enlace en Sucursal Lanús."
  - Razonamiento: "Caratulado erróneamente como Solicitud cuando corresponde a un Incidente crítico."

---

## criterio: call_ticket_categorizacion
- **Nombre:** Categorización (Llamada Wise)
- **Objetivo:** Evaluar que el ticket haya sido clasificado desde su creación en la categoría exacta y en la mesa resolutora correspondiente según el alcance operativo de primer nivel (MDA TI).
- **Qué buscar en el ticket:** Revisar el campo `Categoría`, las `[INTERNO]` y los eventos `[CAMBIO]` en la `Línea de Tiempo e Historial de Cambios`. Verificar si hubo derivaciones erróneas o rechazos desde otros sectores hacia `Solicitudes rechazadas en revisión`.
- **Regla Cumple (`cumple: true`):**
  - La categoría inicial y final es específica (nivel hoja), corresponde al sistema afectado y fue asignada al grupo resolutor correcto sin rechazos por mala derivación.
- **Regla No Cumple (`cumple: false`):**
  - Se utilizó "Sin categoría" o una categoría comodín/genérica.
  - El historial muestra que el operador de MDA derivó/categorizó el ticket hacia otro sector (ej: Soporte Técnico TI) para una tarea que correspondía resolver en MDA, provocando que dicho sector lo devuelva a `Solicitudes rechazadas en revisión` (evidenciado en `[CAMBIO]` de categoría/mesa y `[INTERNO]` de rechazo).
- **Ejemplo Cumple:**
  - Evidencia: "Categoría: Sistemas Centrales > Track & Trace > Consulta sin rechazos en el historial."
  - Razonamiento: "Categoría de nivel hoja adecuada al reclamo sin desvíos ni devoluciones de otros sectores."
- **Ejemplo No Cumple:**
  - Evidencia: "[INTERNO] Soporte TI no desbloquea usuario de Netterm. Corresponde a MDA / [CAMBIO] categoría a Solicitudes rechazadas en revisión."
  - Razonamiento: "El operador categorizó y derivó erróneamente a Soporte TI una gestión propia de MDA, generando el rechazo del ticket."

---

## criterio: call_ticket_prioridad
- **Nombre:** Prioridad (Llamada Wise)
- **Objetivo:** Asegurar que la urgencia e impacto asignados al ticket se correspondan con el alcance de la falla.
- **Qué buscar en el ticket:** Comparar el campo `Prioridad` con el impacto reportado (usuario individual vs sucursal completa vs planta operativa).
- **Regla Cumple (`cumple: true`):**
  - Falla individual con puesto alternativo: Baja / Media.
  - Falla que detiene la operación de una sucursal, planta o servicio crítico masivo: Alta / Urgente.
- **Regla No Cumple (`cumple: false`):**
  - Asignar "Urgente" a un pedido cosmético o sin impacto operativo de un solo usuario.
  - Dejar en "Baja" o "Media" una caída total de sucursal donde no se puede atender al público.
- **Ejemplo Cumple:**
  - Evidencia: "Prioridad: Media; afecta a 1 puesto de ventanilla con puestos alternativos disponibles."
  - Razonamiento: "Prioridad adecuada al impacto acotado del problema."
- **Ejemplo No Cumple:**
  - Evidencia: "Prioridad: Baja; toda la Sucursal Pilar sin conexión para despacho."
  - Razonamiento: "Prioridad subestimada: la caída de enlace de sucursal exige nivel Alto o Urgente."

---

## criterio: call_ticket_descripcion
- **Nombre:** Descripción / Evidencia (Llamada Wise)
- **Objetivo:** Verificar que el cuerpo del ticket contenga los datos técnicos y operativos necesarios para comprender la falla o continuar la gestión.
- **Qué buscar en el ticket:** Revisar el texto de `Descripción`: debe responder con claridad qué ocurre, a quién le ocurre, en qué equipo/sucursal y qué mensaje de error exacto aparece.
- **Regla Cumple (`cumple: true`):**
  - Contiene información completa: descripción del síntoma, mensaje de error (si aplica), equipo/IP o sucursal identificada y pruebas iniciales.
- **Regla No Cumple (`cumple: false`):**
  - Descripción telegráfica o insuficiente (ej: "No anda", "Llamó Juan", "Error en PC").
  - Menos de 15 palabras sin detalles técnicos o sin explicar el contexto del incidente.
- **Ejemplo Cumple:**
  - Evidencia: "Descripción detalla usuario solicitante, boca 4 de Suc. Morón, mensaje 'Error 503 Service Unavailable' en sistema SGP y reinicio previo realizado."
  - Razonamiento: "Aporta contexto preciso, ubicación de la falla y diagnóstico preliminar."
- **Ejemplo No Cumple:**
  - Evidencia: "Descripción: 'sistema no abre comunicarse urgente'"
  - Razonamiento: "Descripción deficiente: omite sistema específico, usuario, mensaje de error y pruebas ejecutadas."

---

## criterio: call_ticket_exactitud_datos
- **Nombre:** Exactitud en el ingreso de datos (Llamada Wise)
- **Objetivo:** Constatar que todos los campos del ticket (solicitante, ubicación, equipo y campos personalizados como contacto telefónico) sean verídicos, completos y consistentes entre sí.
- **Qué buscar en el ticket:** Cotejar `Solicitante`, `Descripción`, `Campos personalizados (API custom_fields)` y eventos `[CAMBIO]` donde se agreguen datos como `Contacto telefónico`.
- **Regla Cumple (`cumple: true`):**
  - Solicitante real identificado y datos de contacto válidos y consistentes tanto en la plantilla de descripción como en los campos personalizados del ticket.
- **Regla No Cumple (`cumple: false`):**
  - Se completó un campo obligatorio o personalizado con datos ficticios/relleno para sortear la validación (ej: cargar `Contacto telefónico 11111`, `0000`, `123456` en `custom_fields` o en el historial de cambios, aun cuando en la descripción figure otro número).
  - Se asignó el ticket a un usuario genérico o con ubicación contradictoria.
- **Ejemplo Cumple:**
  - Evidencia: "Solicitante Laura Castillo; Número de contacto 0348154539791 consistente en descripción y campos personalizados."
  - Razonamiento: "Identificación unívoca del solicitante y teléfono real asentado sin datos ficticios."
- **Ejemplo No Cumple:**
  - Evidencia: "Campos personalizados: campo_22945: '11111' / [CAMBIO] agregó Contacto telefónico 11111."
  - Razonamiento: "El operador ingresó un número ficticio ('11111') en el campo de contacto telefónico en lugar del teléfono real del usuario."

---

## criterio: call_ticket_ortografia
- **Nombre:** Ortografía (Llamada Wise)
- **Objetivo:** Evaluar la corrección ortográfica, acentuación y gramática en los textos redactados por el operador evaluado dentro del ticket.
- **Qué buscar en el ticket:** Revisar `Título`, `Descripción`, `[COMENTARIO]` y `[SOLUCIÓN]` escritos por el `Operador` (o `Creado por` si es el mismo operador). Ignorar siglas técnicas (`Netterm`, `HOST`, `AD`, `VPN`, `NIS`, `SDWAN`), nombres de equipos (`b0044w103`), usuarios (`aa90020b`), salidas de consola (`ping`, `ipconfig`) y textos escritos por terceros o por el cliente.
- **Regla Cumple (`cumple: true`):**
  - La redacción del operador respeta las reglas de ortografía, tildes y gramática del español, sin erratas ni omisiones de acentuación.
- **Regla No Cumple (`cumple: false`):**
  - Existen palabras sin tilde obligatoria (ej: `unicamente`, `conexion`, `solucion`, `numero`, `tambien`), errores gramaticales (ej: escribir `"por que"` separado en lugar de la conjunción causal `"porque"`), errores de tipeo o puntuación pegada a las palabras.
- **Ejemplo Cumple:**
  - Evidencia: "Descripción y solución redactadas con tildes correctas ('Dirección', 'Número', 'únicamente') y puntuación adecuada."
  - Razonamiento: "El texto producido por el operador no presenta faltas ortográficas ni de acentuación."
- **Ejemplo No Cumple:**
  - Evidencia: "Descripción: 'por que le figura...' / [SOLUCIÓN]: 'ya que, unicamente hay exceso de usuarios.'"
  - Razonamiento: "Presenta errores ortográficos en textos del operador: uso incorrecto de 'por que' (causal 'porque') y omisión de tilde en 'únicamente'."

---

## criterio: email_mda_tipo
- **Nombre:** Tipo de solicitud (Mail Wise)
- **Objetivo:** Validar que el ticket refleje adecuadamente si el requerimiento recibido por correo es un Incidente o una Solicitud de servicio.
- **Qué buscar en el ticket:** Comparar el campo `type_id` del ticket contra el contenido y la intención del correo electrónico remitido por el usuario.
- **Regla Cumple (`cumple: true`):**
  - Se tipifica como Incidente ante interrupciones, caídas de enlace, errores de software o degradación de servicios informáticos.
  - Se tipifica como Solicitud de servicio ante pedidos de cuentas, reseteos de clave, permisos, instalaciones o consultas generales.
- **Regla No Cumple (`cumple: false`):**
  - Una falla operativa evidente (ej: correo reportando que no funciona el sistema de paquetería) fue clasificada como Solicitud.
  - Un pedido estándar (ej: solicitud de alta de cuenta o acceso a buzón) fue clasificado como Incidente.
- **Caso Null (`cumple: null`):** Si el campo `type_id` no está definido en el ticket.
- **Ejemplo Cumple:**
  - Evidencia: "type_id: 1; Correo del remitente indica que el servicio Track & Trace arrojó error 500 y no permite despachar."
  - Razonamiento: "Tipificado correctamente como Incidente al tratarse de una interrupción operativa del sistema."
- **Ejemplo No Cumple:**
  - Evidencia: "type_id: 2; Correo solicita 'Urgente: no podemos facturar por falla de red en la sucursal'."
  - Razonamiento: "Caratulado erróneamente como Solicitud cuando corresponde a un Incidente por falla de conectividad."

---

## criterio: email_mda_categorizacion
- **Nombre:** Categorización inicial en MDA (Mail Wise)
- **Objetivo:** Verificar que el ticket derivado del correo ingrese con la categoría correcta al sistema sin rechazos por mala asignación.
- **Qué buscar en el ticket:** Revisar `Categoría`, `[CAMBIO]` de categoría/mesa y notas `[INTERNO]` en la línea de tiempo.
- **Regla Cumple (`cumple: true`):**
  - La categoría asignada es de nivel hoja y pertinente al sistema afectado sin devoluciones desde otras mesas resolutoras.
- **Regla No Cumple (`cumple: false`):**
  - Se asignó 'Sin categoría' o una categoría comodín genérica.
  - El ticket fue derivado erróneamente a otro sector que lo devolvió a `Solicitudes rechazadas en revisión`.
- **Ejemplo Cumple:**
  - Evidencia: "Categoría asignada: Sistemas Centrales > Track & Trace > Consulta sin rechazos ni devoluciones registradas."
  - Razonamiento: "Categorización específica y adecuada a la solicitud por correo sin desvíos de derivación."
- **Ejemplo No Cumple:**
  - Evidencia: "[INTERNO] Soporte TI devuelve caso a MDA: 'No corresponde a esta mesa' / [CAMBIO] a Solicitudes rechazadas en revisión."
  - Razonamiento: "Categorización inicial incorrecta que derivó el ticket a un sector impropio motivando su rechazo."

---

## criterio: email_mda_categorizacion_final
- **Nombre:** Categorización final (Mail Wise)
- **Objetivo:** Verificar que al resolver el caso, la categoría final refleje la causa raíz o la solución efectiva provista.
- **Qué buscar en el ticket:** Contrastar el campo `Categoría` de la API y el último `[CAMBIO]` de categoría en la línea de tiempo contra la `[SOLUCIÓN]` aplicada.
- **Regla Cumple (`cumple: true`):**
  - Si la solución difirió del reporte inicial o el ticket provino de `Solicitudes rechazadas en revisión`, el operador rectificó la categoría final hacia la causa real.
- **Regla No Cumple (`cumple: false`):**
  - El caso se cerró manteniendo una categoría errónea o de rechazo que no guarda relación con la solución brindada.
- **Caso Null (`cumple: null`):** Si el ticket aún se encuentra abierto o en gestión sin solución registrada.
- **Ejemplo Cumple:**
  - Evidencia: "[CAMBIO] Categoría rectificada a Sistemas > Netterm > Claves; [SOLUCIÓN] 'Se procedió al blanqueo de clave de acceso'."
  - Razonamiento: "Categoría final ajustada a la causa raíz real resuelta durante la atención del correo."
- **Ejemplo No Cumple:**
  - Evidencia: "Categoría final: Solicitudes rechazadas en revisión; [SOLUCIÓN] 'Se solucionó problema de impresora de red'."
  - Razonamiento: "Cierre con categoría de rechazo transitoria sin reclasificar a la especialidad correspondiente."

---

## criterio: email_mda_prioridad
- **Nombre:** Prioridad (Mail Wise)
- **Objetivo:** Asegurar que la urgencia e impacto asignados al ticket coincidan con el impacto operativo real indicado en el correo.
- **Qué buscar en el ticket:** Comparar el campo `Prioridad` con el impacto reportado por el remitente en el cuerpo del correo recibido.
- **Regla Cumple (`cumple: true`):**
  - Prioridad asignada proporcional a la afectación (Baja/Media para consultas y trámites individuales; Alta/Urgente ante parálisis de sucursal o planta).
- **Regla No Cumple (`cumple: false`):**
  - Se asignó Urgente o Alta a trámites rutinarios o consultas individuales sin afectación masiva.
  - Se asignó Baja a incidentes de parálisis operativa crítica o afectación de múltiples puestos de atención.
- **Ejemplo Cumple:**
  - Evidencia: "Prioridad: Media; Correo solicita consulta sobre procedimiento de carga de comprobantes en un único puesto."
  - Razonamiento: "Prioridad acorde al impacto individual y no bloqueante reportado en el correo."
- **Ejemplo No Cumple:**
  - Evidencia: "Prioridad: Urgente; Correo solicita consulta de instructivo para solicitud de nuevo tóner de reserva."
  - Razonamiento: "Sobredimensionamiento de prioridad para un trámite rutinario sin afectación de servicio."

---

## criterio: email_mda_descripcion
- **Nombre:** Descripción / Evidencia (Mail Wise)
- **Objetivo:** Asegurar que el ticket contenga el texto del correo o un resumen técnico detallado con referencias, adjuntos y datos relevantes.
- **Qué buscar en el ticket:** Revisar el campo `Descripción` del ticket verificando la claridad y suficiencia de los datos del requerimiento original.
- **Regla Cumple (`cumple: true`):**
  - La descripción reproduce el requerimiento del solicitante con referencias claras, identificadores de envío, módulos afectados o capturas citadas.
- **Regla No Cumple (`cumple: false`):**
  - Descripción vacía, ilegible o que solo consigna 'Ver correo adjunto' sin ningún detalle del problema.
- **Ejemplo Cumple:**
  - Evidencia: "Descripción: 'Usuario solicita desbloqueo de cuenta legajo 84920 en sucursal Quilmes tras 3 intentos fallidos'."
  - Razonamiento: "Descripción completa con usuario, sector y motivo claro de la solicitud."
- **Ejemplo No Cumple:**
  - Evidencia: "Descripción: 'Ver mail'"
  - Razonamiento: "Descripción insuficiente sin detalle técnico ni contexto de la solicitud por correo."

---

## criterio: email_mda_seguimiento
- **Nombre:** Seguimiento al cliente (Mail Wise)
- **Objetivo:** Evaluar que el operador haya mantenido informado al remitente del avance del caso mediante mensajes públicos visibles para el cliente (`[COMENTARIO]` o `[SOLUCIÓN]`).
- **Qué buscar en el ticket:** Revisar los eventos `[COMENTARIO]` y `[SOLUCIÓN]` en la línea de tiempo (recordando que `[INTERNO]` no es visible para el cliente).
- **Regla Cumple (`cumple: true`):** Constan mensajes públicos (`[COMENTARIO]` o `[SOLUCIÓN]`) con información de avance, número de gestión externa o confirmación de solución enviada al usuario.
- **Regla No Cumple (`cumple: false`):** El ticket estuvo abierto días sin ninguna comunicación visible para el cliente, solo tiene notas `[INTERNO]` o se cerró sin notificar la resolución al solicitante.
- **Ejemplo Cumple:**
  - Evidencia: "Línea de tiempo registra [COMENTARIO] informando avance y [SOLUCIÓN] con respuesta final de cierre."
  - Razonamiento: "Se evidencia trazabilidad continua de la atención visible hacia el usuario."
- **Ejemplo No Cumple:**
  - Evidencia: "Solo figura [INTERNO] con prueba técnica; sin ningún [COMENTARIO] ni [SOLUCIÓN] visible para el cliente."
  - Razonamiento: "Cierre o gestión sin constancia de comunicación visible hacia el solicitante."

---

## criterio: email_mda_exactitud_datos
- **Nombre:** Exactitud en el ingreso de datos (Mail Wise)
- **Objetivo:** Constatar la correspondencia entre el remitente del mail, el solicitante cargado en el ticket y la validez de los campos personalizados.
- **Qué buscar en el ticket:** Cotejar `Solicitante`, `Descripción`, `Campos personalizados (API custom_fields)` y eventos `[CAMBIO]` de contacto telefónico.
- **Regla Cumple (`cumple: true`):**
  - Solicitante real coincidente con el remitente y campos personalizados con información válida y consistente.
- **Regla No Cumple (`cumple: false`):**
  - Asignación a usuario genérico o ingreso de datos ficticios en campos obligatorios (ej: teléfono `11111`, `0000`).
- **Ejemplo Cumple:**
  - Evidencia: "Solicitante registrado coincide con firma de correo; teléfono de contacto asentado: 11-4567-8901."
  - Razonamiento: "Datos fidedignos y consistentes entre el correo recibido y el ticket creado."
- **Ejemplo No Cumple:**
  - Evidencia: "Solicitante: 'Usuario Genérico'; campo teléfono completado con '11111111'."
  - Razonamiento: "Carga de datos ficticios en campos obligatorios sorteando la validación del sistema."

---

## criterio: email_mda_ortografia
- **Nombre:** Ortografía (Mail Wise)
- **Objetivo:** Evaluar la corrección ortográfica, acentuación y gramática en los textos redactados por el operador evaluado dentro del ticket.
- **Qué buscar en el ticket:** Revisar `Título`, `[COMENTARIO]` y `[SOLUCIÓN]` escritos por el `Operador` (ignorando el cuerpo original del mail enviado por el cliente, siglas técnicas y comandos).
- **Regla Cumple (`cumple: true`):**
  - La redacción del operador respeta las reglas de ortografía, tildes y gramática del español.
- **Regla No Cumple (`cumple: false`):**
  - Existen palabras sin tilde obligatoria (ej: `unicamente`, `conexion`, `solucion`, `tambien`), errores gramaticales (ej: `"por que"` en vez de `"porque"`) o erratas en los textos del operador.
- **Ejemplo Cumple:**
  - Evidencia: "[SOLUCIÓN] 'Se verificó la conexión de red y se restableció el servicio de impresión'."
  - Razonamiento: "Redacción correcta con tildes y concordancia gramatical adecuada."
- **Ejemplo No Cumple:**
  - Evidencia: "[COMENTARIO] 'La configuracion de la maquina esta lista pero no se si funcionara maniana'."
  - Razonamiento: "Presencia de múltiples faltas de tilde obligatoria en palabras agudas y esdrújulas."

---

## criterio: ag_analisis
- **Nombre:** Análisis de la solicitud (Autogestión)
- **Objetivo:** Verificar que el operador comprendió cabalmente el problema y el contexto ya reportado en la `Descripción` antes de actuar o emitir la `[SOLUCIÓN]`.
- **Qué buscar en el ticket:** Contrastar lo expuesto en la `Descripción` (síntoma y pruebas que el usuario ya realizó) contra los comentarios (`[COMENTARIO]`, `[INTERNO]`), la `[SOLUCIÓN]` brindada y las derivaciones efectuadas.
- **Regla Cumple (`cumple: true`):**
  - La respuesta, diagnóstico o derivación atiende la causa real de lo planteado en la descripción sin contradecir ni ignorar lo que el usuario ya informó.
- **Regla No Cumple (`cumple: false`):**
  - El operador marca como `[SOLUCIÓN]` una respuesta evasiva o genérica que ignora los datos de la descripción (ej: la descripción indica que el usuario ya aguardó más de 1 hora con usuario liberado y persiste el bloqueo, pero en `[SOLUCIÓN]` se le responde simplemente que aguarde y vuelva a probar por exceso de usuarios).
  - Se deriva a un área incorrecta por no haber analizado el alcance del requerimiento.
- **Ejemplo Cumple:**
  - Evidencia: "El operador identificó que el bloqueo correspondía al perfil de compras y destrabó la sesión específica."
  - Razonamiento: "Demuestra comprensión específica de la problemática planteada en la descripción."
- **Ejemplo No Cumple:**
  - Evidencia: "Descripción indica que aguardó más de 1hr y persiste; [SOLUCIÓN] indica 'Debe aguardar y volver a probar por exceso de usuarios'."
  - Razonamiento: "Respuesta genérica que no resuelve: el usuario ya había aguardado más de 1 hora y se le indica esperar de nuevo sin resolver el bloqueo."

---

## criterio: ag_sondeo
- **Nombre:** Sondeo y pruebas realizadas (Autogestión)
- **Objetivo:** Evaluar si el operador realizó indagaciones o pruebas de descarte antes de derivar o escalar.
- **Qué buscar en el ticket:** Revisar `[COMENTARIO]` (preguntas al cliente) e `[INTERNO]` (pruebas técnicas de los agentes como `ping`, verificación de sesión/AD) en la línea de tiempo.
- **Regla Cumple (`cumple: true`):**
  - Se evidencian preguntas de sondeo en `[COMENTARIO]` o pruebas técnicas documentadas en `[INTERNO]` en primer nivel antes de resolver o escalar.
- **Regla No Cumple (`cumple: false`):**
  - El ticket fue derivado de inmediato ("pase ciego") a segundo nivel sin ninguna pregunta ni prueba básica.
- **Caso Null (`cumple: null`):** Cuando la solicitud es un trámite formal que no requiere pruebas técnicas (ej: solicitud de formulario administrativo).
- **Ejemplo Cumple:**
  - Evidencia: "[INTERNO] Se realiza ping a la IP 10.20.4.15 arrojando timeout; se solicita confirmación de encendido por [COMENTARIO]."
  - Razonamiento: "Constancia de sondeo activo y pruebas de conectividad antes de derivar el caso."
- **Ejemplo No Cumple:**
  - Evidencia: "El ticket se derivó a Soporte Redes 2 minutos después de la creación sin preguntas ni notas técnicas en el historial."
  - Razonamiento: "Pase ciego a segundo nivel sin ejecución de pruebas básicas ni indagación con el usuario."

---

## criterio: ag_procedimiento
- **Nombre:** Cumplimiento del procedimiento (Autogestión)
- **Objetivo:** Asegurar que se siguieron los flujos aprobados para el tipo de requerimiento (alcance de primer nivel MDA vs derivación a nivel 2, uso de plantillas y completitud de campos obligatorios sin datos falsos).
- **Qué buscar en el ticket:** Revisar `[INTERNO]`, `[CAMBIO]` de mesa/categoría y `Campos personalizados (API custom_fields)`.
- **Regla Cumple (`cumple: true`):**
  - Se gestionó dentro del alcance de MDA o se derivó al grupo resolutor correcto sin rechazos y completando datos reales.
- **Regla No Cumple (`cumple: false`):**
  - El ticket fue derivado a otro sector (ej: Soporte TI Nivel 1) para una tarea que correspondía a MDA, siendo devuelto a `Solicitudes rechazadas en revisión`.
  - Se ingresaron datos falsos para saltar validaciones del flujo (ej: `Contacto telefónico 11111`).
- **Ejemplo Cumple:**
  - Evidencia: "Gestión de consulta Netterm resuelta directamente en MDA TI Nivel 1 con pruebas de red documentadas."
  - Razonamiento: "Se respetó el alcance resolutor de primer nivel sin derivaciones indebidas."
- **Ejemplo No Cumple:**
  - Evidencia: "[INTERNO] Soporte TI no desbloquea usuario de Netterm. Corresponde a MDA / [CAMBIO] a Solicitudes rechazadas."
  - Razonamiento: "Incumplimiento de procedimiento al derivar a Soporte TI una gestión propia de MDA y cargar teléfono ficticio 11111."

---

## criterio: ag_documentacion
- **Nombre:** Documentación de la gestión (Autogestión)
- **Objetivo:** Constatar que en el historial del ticket quede registro legible de las pruebas internas y de la solución brindada.
- **Qué buscar en el ticket:** Revisar `[INTERNO]` (donde los agentes dejan constancia de pruebas técnicas que el cliente no ve) y `[COMENTARIO]` / `[SOLUCIÓN]` (visibles para el cliente).
- **Regla Cumple (`cumple: true`):**
  - Cada acción técnica relevante (ping, reseteo, verificación de servidor) está asentada en `[INTERNO]` y la resolución está explicada en `[SOLUCIÓN]`.
- **Regla No Cumple (`cumple: false`):**
  - El ticket pasa a Solucionado sin documentar en `[INTERNO]` ni en `[SOLUCIÓN]` las acciones técnicas ejecutadas.
- **Ejemplo Cumple:**
  - Evidencia: "[INTERNO] 'Prueba en servidor ok, servicio reiniciado'; [SOLUCIÓN] 'Se reconfiguró el acceso del usuario'."
  - Razonamiento: "Documentación técnica detallada en notas internas y explicación clara al usuario en solución."
- **Ejemplo No Cumple:**
  - Evidencia: "Ticket cerrado con [SOLUCIÓN] 'Listo' y sin ninguna entrada registrada en [INTERNO]."
  - Razonamiento: "Falta de documentación técnica de las acciones tomadas para resolver la incidencia."

---

## criterio: ag_correccion_prioridad
- **Nombre:** Corrección de prioridad (Autogestión)
- **Objetivo:** Rectificar la prioridad fijada por el usuario en autogestión ajustándola al impacto operativo real del requerimiento.
- **Qué buscar en el ticket:** Revisar el campo `Prioridad` inicial ingresado por el usuario y los eventos `[CAMBIO]` de prioridad en el historial.
- **Regla Cumple (`cumple: true`):**
  - La prioridad fue ajustada al impacto real (o se mantuvo si el usuario la fijó correctamente acorde a las políticas del servicio).
- **Regla No Cumple (`cumple: false`):**
  - Se mantuvo una prioridad 'Urgente' fijada por el usuario para un pedido rutinario o individual sin justificación operativa.
- **Ejemplo Cumple:**
  - Evidencia: "[CAMBIO] Prioridad modificada de Urgente a Baja para solicitud de consulta sobre formulario web."
  - Razonamiento: "Prioridad rectificada correctamente adecuándola al impacto real no crítico de la solicitud."
- **Ejemplo No Cumple:**
  - Evidencia: "Prioridad: Urgente conservada para solicitud de cambio de cartucho en impresora individual."
  - Razonamiento: "Se mantuvo prioridad Urgente desproporcionada para un pedido sin impacto generalizado."

---

## criterio: ag_correccion_tipo
- **Nombre:** Corrección de tipo de solicitud (Autogestión)
- **Objetivo:** Verificar que el tipo de ticket (`Incidente` vs `Pedido de servicio`) sea coherente o haya sido rectificado por el operador si estaba mal clasificado.
- **Qué buscar en el ticket:** Revisar `Tipo (type_id)` y los eventos `[CAMBIO]` de tipo en la línea de tiempo.
- **Regla Cumple (`cumple: true`):**
  - El tipo es coherente con la solicitud o el operador de MDA lo rectificó en el historial (ej: `cambió el tipo de Pedido de servicio a Incidente`).
- **Regla No Cumple (`cumple: false`):**
  - Permaneció un tipo erróneo sin ser corregido durante el ciclo de vida del ticket.
- **Ejemplo Cumple:**
  - Evidencia: "[CAMBIO] Tipo rectificado de Pedido de servicio a Incidente tras constatar caída de servicio en sucursal."
  - Razonamiento: "Corrección oportuna del tipo de ticket adecuándolo a una falla operativa real."
- **Ejemplo No Cumple:**
  - Evidencia: "El ticket permaneció tipificado como Pedido de servicio pese a reportar pantalla azul y parálisis del puesto."
  - Razonamiento: "Omisión de rectificación de tipo de solicitud ante un incidente manifiesto de hardware."

---

## criterio: ag_categorizacion
- **Nombre:** Categorización (Autogestión)
- **Objetivo:** Validar que la categorización inicial o asignada por el operador no incurra en derivaciones erróneas ni rechazos de otros sectores.
- **Qué buscar en el ticket:** Revisar `Categoría`, `[INTERNO]` y `[CAMBIO]` de categoría en el historial.
- **Regla Cumple (`cumple: true`):**
  - Categoría de nivel hoja adecuada a la problemática sin caídas en `Solicitudes rechazadas en revisión` por error del operador de MDA.
- **Regla No Cumple (`cumple: false`):**
  - Categoría genérica, errónea o que provocó el rechazo de otro sector (`Solicitudes rechazadas en revisión`) por mala asignación inicial.
- **Ejemplo Cumple:**
  - Evidencia: "Categoría: Sistemas > SAP > Accesos; caso derivado y atendido directamente por el equipo resolutor."
  - Razonamiento: "Categorización precisa acorde a la problemática sin generar rechazos ni reasignaciones."
- **Ejemplo No Cumple:**
  - Evidencia: "Categoría: Sin Categoría; caso asignado a Soporte Redes que lo devolvió a Solicitudes rechazadas en revisión."
  - Razonamiento: "Mala categorización inicial que derivó en rechazo por parte del sector resolutor."

---

## criterio: ag_mda_seguimiento
- **Nombre:** Seguimiento en MDA (Autogestión)
- **Objetivo:** Mantener informado al usuario mediante mensajes visibles para el cliente (`[COMENTARIO]` o `[SOLUCIÓN]`, considerando que `[INTERNO]` no es visible para el solicitante).
- **Qué buscar en el ticket:** Revisar los eventos `[COMENTARIO]` y `[SOLUCIÓN]` en la línea de tiempo del ticket.
- **Regla Cumple (`cumple: true`):**
  - Existe al menos un `[COMENTARIO]` o `[SOLUCIÓN]` dirigido al solicitante informando el estado o la resolución del caso.
- **Regla No Cumple (`cumple: false`):**
  - Ticket estancado sin aviso público al solicitante o con actividad únicamente en notas `[INTERNO]` que el cliente no puede ver.
- **Ejemplo Cumple:**
  - Evidencia: "[COMENTARIO] 'Su solicitud fue recibida y se encuentra en análisis por el equipo de sistemas'."
  - Razonamiento: "Comunicación oportuna y visible que mantiene informado al usuario del estado de su gestión."
- **Ejemplo No Cumple:**
  - Evidencia: "El ticket permaneció abierto durante 48 horas registrando solo notas en [INTERNO] sin comunicación al usuario."
  - Razonamiento: "Falta de seguimiento visible para el solicitante durante la permanencia del caso en la mesa."

---

## criterio: ag_mda_categorizacion_final
- **Nombre:** Categorización final en MDA (Autogestión)
- **Objetivo:** Asegurar que la categoría de cierre represente la resolución técnica alcanzada, contrastando el dato de la API con el último cambio en el historial.
- **Qué buscar en el ticket:** Comparar `Categoría` (API), el último `[CAMBIO]` de categoría en el historial y la `[SOLUCIÓN]` brindada.
- **Regla Cumple (`cumple: true`):**
  - Coherencia entre la categoría final rectificada y la solución técnica asentada en el cierre.
- **Regla No Cumple (`cumple: false`):**
  - El ticket se cerró manteniendo una categoría de rechazo o una categoría que contradice la solución técnica aplicada.
- **Ejemplo Cumple:**
  - Evidencia: "Categoría final: Hardware > Impresoras > Configuración; [SOLUCIÓN] 'Se reconfiguró puerto de red de impresora'."
  - Razonamiento: "Categorización final en concordancia directa con la solución técnica aplicada."
- **Ejemplo No Cumple:**
  - Evidencia: "Categoría final: Solicitudes rechazadas en revisión; [SOLUCIÓN] 'Se procedió al desbloqueo del usuario'."
  - Razonamiento: "Cierre del caso con categoría provisoria de rechazo sin recategorizar según la solución definitiva."

---

## criterio: ag_mda_info_complementaria
- **Nombre:** Información complementaria (Autogestión)
- **Objetivo:** Verificar la presencia de datos auxiliares que faciliten auditorías futuras (número de serie del equipo, MAC address, NIS de sucursal, número de formulario SAP).
- **Qué buscar en el ticket:** Revisar `Descripción`, `[INTERNO]` y `Campos personalizados` buscando identificadores unívocos del bien o trámite.
- **Regla Cumple (`cumple: true`):**
  - Constan identificadores técnicos unívocos del activo o trámite gestionado (ej: número de serie, MAC address, IP, NIS o legajo).
- **Regla No Cumple (`cumple: false`):**
  - Se gestionó una intervención de hardware, red o sistema sin asentar identificadores unívocos requeridos para auditoría.
- **Caso Null (`cumple: null`):** Casos donde la gestión no involucre activos físicos ni trámites con código externo.
- **Ejemplo Cumple:**
  - Evidencia: "[INTERNO] Se reemplaza mouse defectuoso en terminal B044W102, NIS 1842, Serie SN-948102."
  - Razonamiento: "Registro exhaustivo de identificadores del equipo y ubicación para trazabilidad de inventario."
- **Ejemplo No Cumple:**
  - Evidencia: "[SOLUCIÓN] 'Se cambió la PC por una nueva que funcionaba bien' sin serie, nombre de equipo ni NIS."
  - Razonamiento: "Omisión de datos identificatorios indispensables en gestión de activos físicos."

---

## criterio: ag_mda_ortografia
- **Nombre:** Ortografía (Autogestión)
- **Objetivo:** Evaluar la corrección ortográfica, acentuación y gramática en los textos redactados por el operador evaluado dentro del ticket.
- **Qué buscar en el ticket:** Revisar `Título` (si fue editado/creado por el operador), `Descripción` (si el ticket lo creó el operador), `[COMENTARIO]` y `[SOLUCIÓN]` escritos por el `Operador`. Ignorar textos escritos por el cliente o por otros agentes, siglas técnicas (`Netterm`, `HOST`, `AD`, `VPN`), nombres de equipos (`b0044w103`), usuarios (`aa90020b`) y salidas de consola (`ping`, `ipconfig`).
- **Regla Cumple (`cumple: true`):**
  - Los textos redactados por el operador evaluado respetan la ortografía, acentuación y gramática del español.
- **Regla No Cumple (`cumple: false`):**
  - Existen palabras sin tilde obligatoria (ej: `unicamente`, `conexion`, `solucion`, `tambien`), errores gramaticales (ej: escribir `"por que"` separado en lugar de la conjunción causal `"porque"`) o erratas de tipeo en las intervenciones del operador.
- **Ejemplo Cumple:**
  - Evidencia: "Solución y comentarios del operador redactados con acentuación y gramática correctas."
  - Razonamiento: "No se observan faltas de ortografía ni omisión de tildes en las respuestas del operador."
- **Ejemplo No Cumple:**
  - Evidencia: "Descripción: 'por que le figura...' / [SOLUCIÓN]: 'ya que, unicamente hay exceso de usuarios.'"
  - Razonamiento: "Faltas ortográficas en textos del operador: uso de 'por que' en lugar de 'porque' y falta de tilde en 'únicamente'."

---

## criterio: call_saludo_estandar
- **Nombre:** Uso del saludo estándar (Llamada Wise)
- **Objetivo:** Verificar que el operador inicie la llamada con la fórmula protocolar de apertura institucional identificando la empresa y su nombre.
- **Qué buscar en el ticket:** Revisar los primeros turnos de habla del operador en la transcripción de la llamada.
- **Regla Cumple (`cumple: true`):**
  - El operador saluda mencionando "Correo Argentino" (o "Mesa de Ayuda") y se identifica con su nombre o apellido.
- **Regla No Cumple (`cumple: false`):**
  - El operador atiende diciendo únicamente "Hola", "¿Quién habla?", "Sí, decime" o no menciona la empresa ni su nombre.
- **Caso Null (`cumple: null`):** Transcripción cortada al inicio o audio que comienza luego de iniciada la conversación.
- **Ejemplo Cumple:**
  - Evidencia: "Operador: 'Buenos días, Mesa de Ayuda de Correo Argentino, habla Martín, ¿en qué puedo ayudarte?'"
  - Razonamiento: "Cumple con el saludo estándar institucional identificando empresa y nombre del operador."
- **Ejemplo No Cumple:**
  - Evidencia: "Operador: 'Hola, sí, ¿quién es?'"
  - Razonamiento: "No utiliza la fórmula institucional ni menciona Correo Argentino ni su nombre."

---

## criterio: call_cordialidad
- **Nombre:** Cordialidad y cortesía (Llamada Wise)
- **Objetivo:** Evaluar el trato respetuoso, empático y profesional brindado al usuario a lo largo de toda la comunicación.
- **Qué buscar en el ticket:** Revisar las intervenciones y respuestas del operador en la transcripción de la llamada.
- **Regla Cumple (`cumple: true`):**
  - Mantiene un trato educado, utiliza fórmulas de cortesía ("por favor", "gracias") y responde con paciencia.
- **Regla No Cumple (`cumple: false`):**
  - Manifiesta tono cortante, desgano, ironía, agresividad verbal o descalifica al usuario.
- **Ejemplo Cumple:**
  - Evidencia: "Operador: 'Muchas gracias por aguardar, por favor intente ingresar nuevamente cuando le indique.'"
  - Razonamiento: "Mantiene un trato respetuoso y cortés durante toda la gestión telefónica."
- **Ejemplo No Cumple:**
  - Evidencia: "Operador: 'Bueno pero si no me decís qué pantalla tenés no soy adivino.'"
  - Razonamiento: "Falta de cordialidad y tono descalificatorio hacia el solicitante."

---

## criterio: call_interes_resolver
- **Nombre:** Demuestra interés en resolver el problema (Llamada Wise)
- **Objetivo:** Constatar la predisposición activa y compromiso del operador para buscar una solución a la necesidad del usuario.
- **Qué buscar en el ticket:** Evaluar si el operador indaga activamente, propone alternativas o busca destrabar el incidente frente a dificultades.
- **Regla Cumple (`cumple: true`):**
  - El operador se involucra activamente en el problema, valida opciones y busca vías de solución concretas.
- **Regla No Cumple (`cumple: false`):**
  - Muestra desinterés evidente, intenta sacarse el llamado de encima rápidamente o deriva sin intentar comprender el problema.
- **Ejemplo Cumple:**
  - Evidencia: "Operador: 'Entiendo que urge la sucursal, vamos a probar reiniciar el servicio juntos para que no quede parada.'"
  - Razonamiento: "Demuestra compromiso y predisposición orientada a resolver la urgencia operativa."
- **Ejemplo No Cumple:**
  - Evidencia: "Operador: 'Eso no es de acá, cortá y mandá un mail.'"
  - Razonamiento: "Actitud evasiva y desinterés en brindar asistencia o guiar al usuario."

---

## criterio: call_sondeo
- **Nombre:** Sondeo (Llamada Wise)
- **Objetivo:** Verificar que el operador realice preguntas abiertas y precisas para relevar la falla antes de emitir un diagnóstico.
- **Qué buscar en el ticket:** Revisar las preguntas formuladas por el operador en la transcripción de la llamada.
- **Regla Cumple (`cumple: true`):**
  - Pregunta datos clave: sistema afectado, mensaje de error exacto, usuario/equipo involucrado y pruebas previas realizadas.
- **Regla No Cumple (`cumple: false`):**
  - Asume la falla sin preguntar detalles esenciales, o deriva sin haber indagado qué ocurre.
- **Caso Null (`cumple: null`):** Pedidos directos y unívocos donde no se requieren preguntas adicionales de descarte.
- **Ejemplo Cumple:**
  - Evidencia: "Operador: '¿Qué número de error te figura en pantalla y desde qué equipo estás intentando entrar?'"
  - Razonamiento: "Realiza sondeo estructurado para determinar el origen del incidente."
- **Ejemplo No Cumple:**
  - Evidencia: "Usuario: 'No anda el sistema.' Operador: 'Bueno, te abro el reclamo y después lo ven.'"
  - Razonamiento: "Omite sondeo básico: no indaga qué sistema ni qué síntoma presenta."

---

## criterio: call_escucha_activa
- **Nombre:** Escucha en forma activa y atenta (Llamada Wise)
- **Objetivo:** Evaluar la atención brindada al relato del usuario evitando interrupciones innecesarias y confirmando lo comprendido.
- **Qué buscar en el ticket:** Revisar si el operador interrumpe mientras el usuario expone o si reitera preguntas sobre datos que el usuario ya acaba de explicar.
- **Regla Cumple (`cumple: true`):**
  - Deja hablar al usuario sin pisarlo, parafrasea o confirma la información y toma nota de los detalles expuestos.
- **Regla No Cumple (`cumple: false`):**
  - Interrumpe reiteradamente al usuario mientras explica o le pide repetir información que acaba de brindar hace instantes.
- **Ejemplo Cumple:**
  - Evidencia: "Operador: 'Perfecto, entonces confirmame: ¿la terminal afectada es la de ventanilla 2 de Morón?'"
  - Razonamiento: "Valida la información escuchada atentamente sin pisar el relato del cliente."
- **Ejemplo No Cumple:**
  - Evidencia: "El usuario comienza a explicar la falla y el operador lo interrumpe tres veces consecutivas con respuestas apresuradas."
  - Razonamiento: "Falta de escucha activa por interrumpir reiteradamente al interlocutor."

---

## criterio: call_control_conversacion
- **Nombre:** Control de la conversación (Llamada Wise)
- **Objetivo:** Guiar el diálogo con seguridad manteniendo el foco técnico y la eficiencia sin extender la llamada innecesariamente.
- **Qué buscar en el ticket:** Revisar si el operador mantiene el hilo de la gestión ante desvíos o quejas recurrentes del solicitante.
- **Regla Cumple (`cumple: true`):**
  - Conduce la llamada con firmeza y amabilidad hacia la resolución técnica, evitando dispersiones.
- **Regla No Cumple (`cumple: false`):**
  - Pierde el manejo de la conversación, permite discusiones improductivas prolongadas o desvíos ajenos al servicio.
- **Ejemplo Cumple:**
  - Evidencia: "Operador: 'Comprendo la molestia, vamos a focalizarnos en recuperar la conexión del puesto así podés atender.'"
  - Razonamiento: "Retoma el control de la conversación con enfoque resolutivo ante la catarsis del usuario."
- **Ejemplo No Cumple:**
  - Evidencia: "El operador se enreda en una discusión de 5 minutos sobre políticas de la empresa sin avanzar en la prueba."
  - Razonamiento: "Pérdida de control del llamado al involucrarse en debates improductivos."

---

## criterio: call_contencion_espera
- **Nombre:** Contención en la espera (Llamada Wise)
- **Objetivo:** Asegurar que los tiempos de silencio o retención (hold/mute) sean informados con anticipación y retomados con cortesía.
- **Qué buscar en el ticket:** Identificar si en la transcripción el operador avisa antes de guardar silencio prolongado y retoma agradeciendo la espera.
- **Regla Cumple (`cumple: true`):**
  - Avisa al usuario que lo pondrá en espera o verificará datos, y al retomar agradece el tiempo de espera.
- **Regla No Cumple (`cumple: false`):**
  - Guarda silencios extensos sin aviso previo ("silencio muerto") o retoma la comunicación abruptamente sin agradecer.
- **Caso Null (`cumple: null`):** Llamadas fluidas y continuas sin pausas de espera.
- **Ejemplo Cumple:**
  - Evidencia: "Operador: 'Aguardame un minuto en línea que consulto el estado del enlace... Gracias por la espera.'"
  - Razonamiento: "Avisa con anticipación antes de pausar y agradece la espera al retomar la comunicación."
- **Ejemplo No Cumple:**
  - Evidencia: "Silencio total de más de 2 minutos sin aviso previo del operador, retomando directamente con '¿Hola?'"
  - Razonamiento: "No aplica contención: deja al usuario en espera prolongada sin advertirle ni agradecer."

---

## criterio: call_despedida_cordial
- **Nombre:** Se despide cordialmente (Llamada Wise)
- **Objetivo:** Concluir la llamada de manera protocolar, confirmando si quedan dudas pendientes y brindando saludo final.
- **Qué buscar en el ticket:** Revisar el cierre de la conversación en los turnos finales de la transcripción.
- **Regla Cumple (`cumple: true`):**
  - Consulta si puede ayudar en algo más, brinda el número de ticket generado y se despide cordialmente.
- **Regla No Cumple (`cumple: false`):**
  - Corta abruptamente sin despedirse, no ofrece asistencia adicional o finaliza la llamada de forma descortés.
- **Ejemplo Cumple:**
  - Evidencia: "Operador: 'El ticket generado es el #90812. ¿Tenés alguna otra consulta? Que tengas buen día.'"
  - Razonamiento: "Cierre protocolar completo informando número de gestión, consulta de cierre y saludo cordial."
- **Ejemplo No Cumple:**
  - Evidencia: "Operador: 'Listo, ya está. Chau.' y cuelga la llamada."
  - Razonamiento: "Despedida seca y apresurada sin consultar si precisa algo más ni brindar número de ticket."

---

## criterio: call_lenguaje_apropiado
- **Nombre:** Lenguaje apropiado (Llamada Wise)
- **Objetivo:** Emplear vocabulario técnico accesible, formal y correcto, evitando lunfardo, modismos callejeros o tecnicismos incomprensibles.
- **Qué buscar en el ticket:** Analizar los modismos y términos empleados por el operador en la transcripción.
- **Regla Cumple (`cumple: true`):**
  - Vocabulario claro, neutral y respetuoso adaptado al nivel de comprensión del usuario.
- **Regla No Cumple (`cumple: false`):**
  - Uso de lunfardo, jerga informal inapropiada ("che", "loco", "flaco", "bajón") o lenguaje excesivamente críptico sin explicar.
- **Ejemplo Cumple:**
  - Evidencia: "Operador: 'Vamos a reiniciar el equipo de comunicaciones para restablecer los servicios de la oficina.'"
  - Razonamiento: "Lenguaje formal, profesional y claro para el interlocutor."
- **Ejemplo No Cumple:**
  - Evidencia: "Operador: 'Che flaco, fijate si no se te desconectó el coso ese de atrás.'"
  - Razonamiento: "Uso de vocabulario inapropiado y excesivamente informal para atención corporativa."

---

## criterio: call_procedimiento
- **Nombre:** Cumplimiento de procedimiento (Llamada Wise)
- **Objetivo:** Validar que se sigan los flujos aprobados para la atención telefónica (verificación de identidad, apertura de ticket en línea y pruebas estándar).
- **Qué buscar en el ticket:** Cotejar la interacción de la llamada con la apertura simultánea del ticket y la ejecución de los pasos reglamentarios del servicio.
- **Regla Cumple (`cumple: true`):**
  - Realiza los pasos previstos: valida solicitante, ejecuta pruebas de protocolo y genera o asocia el ticket correspondiente.
- **Regla No Cumple (`cumple: false`):**
  - Incumple el procedimiento operativo (ej: atiende sin generar ticket, pide contraseñas del usuario o deriva saltando el protocolo).
- **Ejemplo Cumple:**
  - Evidencia: "Operador valida legajo y nombre del solicitante, prueba conectividad y genera ticket en tiempo real."
  - Razonamiento: "Alineación completa a los protocolos de atención telefónica de la Mesa de Ayuda."
- **Ejemplo No Cumple:**
  - Evidencia: "Operador le solicita al usuario que le dicte su contraseña de correo para probar el acceso."
  - Razonamiento: "Violación grave de seguridad y de procedimiento al solicitar credenciales privadas."

---

## criterio: email_interpretacion
- **Nombre:** Interpretación de la necesidad (Wise CX Mail)
- **Objetivo:** Comprender con precisión la consulta o problema planteado por el usuario en el correo.
- **Qué buscar en el ticket:** Comparar la solicitud del usuario en el hilo de correo (`emailThread`) con la respuesta provista por el operador.
- **Regla Cumple (`cumple: true`):** El operador identifica correctamente el problema planteado por el solicitante y responde de manera atingente al motivo real del contacto.
- **Regla No Cumple (`cumple: false`):** El operador responde algo no solicitado, ignora la consulta principal del usuario o malinterpreta el motivo del correo.
- **Ejemplo Cumple:**
  - Evidencia: "Usuario consulta estado de envío de tarjeta y operador detalla tracking y fecha estimada de entrega."
  - Razonamiento: "El operador comprendió exactamente la consulta del usuario y respondió al respecto."
- **Ejemplo No Cumple:**
  - Evidencia: "Usuario reporta error al ingresar al sistema y operador responde con horarios de atención de sucursal."
  - Razonamiento: "El operador respondió sobre un tema ajeno al problema técnico reportado."

---

## criterio: email_redaccion
- **Nombre:** Redacción y estilo (Wise CX Mail)
- **Objetivo:** Redactar la respuesta con corrección sintáctica, ortográfica, gramatical y tono profesional.
- **Qué buscar en el ticket:** Revisar el texto de la respuesta del operador en el hilo de correo (`emailThread`).
- **Regla Cumple (`cumple: true`):** La respuesta respeta reglas ortográficas y de puntuación, manteniendo un tono formal, respetuoso y profesional en todo el texto.
- **Regla No Cumple (`cumple: false`):** La respuesta contiene errores ortográficos graves reiterados, puntuación deficiente que dificulta la lectura, o lenguaje informal/inadecuado.
- **Ejemplo Cumple:**
  - Evidencia: "Estimado, buenas tardes. Le informamos que el trámite fue gestionado bajo el número de requerimiento 12345. Saludos cordiales."
  - Razonamiento: "Texto correctamente puntuado, formal y sin faltas ortográficas."
- **Ejemplo No Cumple:**
  - Evidencia: "hola ya te lo vi fijate si podes entrar ahora"
  - Razonamiento: "Falta de mayúsculas, tildes, signos de puntuación y uso de tono informal inapropiado."

---

## criterio: email_claridad
- **Nombre:** Claridad y completitud (Wise CX Mail)
- **Objetivo:** Comunicar la información de forma comprensible, ordenada y autosuficiente para el usuario.
- **Qué buscar en el ticket:** Analizar si las instrucciones, explicaciones y pasos brindados en la respuesta son autosuficientes y entendibles.
- **Regla Cumple (`cumple: true`):** La explicación es directa, lógica y contiene todos los datos o pasos necesarios para que el usuario actúe o comprenda el estado sin ambigüedad.
- **Regla No Cumple (`cumple: false`):** La respuesta es ambigua, confusa, incompleta o deja al usuario sin saber qué hacer o cuál es el estado final de su trámite.
- **Ejemplo Cumple:**
  - Evidencia: "Para reestablecer su clave, ingrese a la opción 'Olvidé mi clave' en el portal, complete su DNI y siga el enlace enviado a su casilla."
  - Razonamiento: "Instrucciones paso a paso, precisas y completas."
- **Ejemplo No Cumple:**
  - Evidencia: "Ya se gestionó, aguarde."
  - Razonamiento: "No indica plazos, canales de seguimiento ni qué trámite se gestionó."

---

## criterio: email_resolucion
- **Nombre:** Resolución de la consulta (Wise CX Mail)
- **Objetivo:** Brindar solución efectiva al pedido o canalizarlo adecuadamente según el procedimiento.
- **Qué buscar en el ticket:** Verificar si el operador resolvió de fondo la consulta o derivó formalmente con constancia de ticket o requerimiento.
- **Regla Cumple (`cumple: true`):** La respuesta resuelve el requerimiento del usuario o proporciona la gestión/derivación correspondiente conforme a los procesos vigentes.
- **Regla No Cumple (`cumple: false`):** La respuesta no resuelve la consulta, omite brindar solución o cierra el caso sin haber ejecutado la gestión solicitada.
- **Ejemplo Cumple:**
  - Evidencia: "Se procedió a la activación de la cuenta y se verificó el acceso exitoso en la plataforma."
  - Razonamiento: "El operador brindó y confirmó la solución efectiva del requerimiento."
- **Ejemplo No Cumple:**
  - Evidencia: "No podemos hacer nada con este caso, comuníquese telefónicamente."
  - Razonamiento: "El operador rechaza la solicitud sin gestionar ni brindar la solución esperada."


