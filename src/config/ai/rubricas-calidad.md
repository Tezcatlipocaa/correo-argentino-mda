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
3. **Preservación de Reglas Deterministas:** Queda estrictamente prohibido agregar en este archivo criterios que el motor del Portal MDA ya resuelve por código determinista (`*_titulo`, `*_origen`, `*_ortografia`, `*_sla_*`).
4. **Falsabilidad con Evidencia Textual:** Toda regla debe poder verificarse leyendo únicamente los campos exportados del ticket (`Título`, `Descripción`, `Categoría`, `Prioridad`, `Tipo`, `Estado`, `Solicitante`, `Creado por` y `Comentarios`). No se admiten reglas que exijan suponer intenciones no escritas.

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
- **Objetivo:** Evaluar que el ticket haya sido clasificado en el árbol taxonómico de categorías que corresponda con exactitud al servicio o sistema afectado.
- **Qué buscar en el ticket:** Revisar el campo `Categoría`. Debe ser específica (categoría de último nivel / hoja) y coincidir con la tecnología tratada.
- **Regla Cumple (`cumple: true`):**
  - La categoría es específica y coherente con el aplicativo, equipo o servicio reportado (ej: `Hardware > Impresoras > Láser`, `Aplicativos > SIR > Error de login`).
- **Regla No Cumple (`cumple: false`):**
  - Se utilizó "Sin categoría" o una categoría comodín / genérica (ej: "Otros", "General", "Sistemas").
  - La categoría asignada pertenece a un sistema completamente ajeno al problema (ej: categorizar un problema de correo Outlook bajo `Telefonía > Internos`).
- **Ejemplo Cumple:**
  - Evidencia: "Categoría: Sistemas Centrales > Track & Trace > Consulta"
  - Razonamiento: "Categoría de nivel hoja adecuada al reclamo de trazabilidad de piezas."
- **Ejemplo No Cumple:**
  - Evidencia: "Categoría: Sin categoría"
  - Razonamiento: "El ticket no posee categoría asignada o se dejó una genérica sin tipificar."

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
- **Objetivo:** Constatar que los campos de datos (solicitante, ubicación, teléfono, equipo, sector) sean consistentes y verídicos.
- **Qué buscar en el ticket:** Cotejar datos del solicitante (`customer`), teléfono de contacto en la descripción o comentarios, y coherencia de ubicación.
- **Regla Cumple (`cumple: true`):**
  - Datos de contacto presentes y coherentes con el usuario que llamó.
- **Regla No Cumple (`cumple: false`):**
  - Se asignó el ticket a un usuario genérico ("Usuario Prueba", "Mesa") existiendo el legajo del solicitante real.
  - Datos contradictorios (ej: indica sucursal Córdoba pero el usuario y teléfono corresponden a planta Monte Grande).
- **Ejemplo Cumple:**
  - Evidencia: "Solicitante registrado Juan Pérez (@jperez) con teléfono de línea interna 2234 y sucursal verificada."
  - Razonamiento: "Identificación unívoca del solicitante y datos de contacto consistentes."
- **Ejemplo No Cumple:**
  - Evidencia: "Solicitante: 'Administrador'; Descripción menciona que llamó María López de Rosario."
  - Razonamiento: "No se imputó el ticket al usuario real que originó el requerimiento."

---

## criterio: email_mda_tipo
- **Nombre:** Tipo de solicitud (Mail Wise)
- **Objetivo:** Mismo criterio técnico que en llamadas: validar clasificación entre Incidente y Solicitud según el texto del correo recibido.
- **Regla Cumple:** Clasificación correcta según sea incidente operativo o requerimiento administrativo.
- **Regla No Cumple:** Inversión de tipo (Incidente como Solicitud o viceversa).

---

## criterio: email_mda_categorizacion
- **Nombre:** Categorización inicial en MDA (Mail Wise)
- **Objetivo:** Verificar que el ticket derivado del correo ingrese con la categoría correcta al sistema.
- **Regla Cumple:** Categoría específica y pertinente al tema del correo.
- **Regla No Cumple:** "Sin categoría" o categoría fuera de contexto.

---

## criterio: email_mda_categorizacion_final
- **Nombre:** Categorización final (Mail Wise)
- **Objetivo:** Verificar que al resolver el caso, la categoría final refleje la causa raíz o la solución efectiva provista.
- **Regla Cumple:** Si la solución difirió del reporte inicial, se corrigió la categoría a la causa real (ej: se reportó problema de red pero fue error de usuario).
- **Regla No Cumple:** El caso se cerró con una categoría errónea que no guarda relación con la solución brindada en los comentarios.
- **Caso Null:** Si el ticket aún se encuentra abierto o pendiente de derivación.

---

## criterio: email_mda_prioridad
- **Nombre:** Prioridad (Mail Wise)
- **Objetivo:** Calibrar la prioridad del correo según la urgencia e impacto declarados por el remitente y las políticas de servicio.
- **Regla Cumple:** Prioridad proporcional a la afectación operativa.
- **Regla No Cumple:** Calificar como Urgente correos de trámites rutinarios o como Baja problemas de parálisis operativa.

---

## criterio: email_mda_descripcion
- **Nombre:** Descripción / Evidencia (Mail Wise)
- **Objetivo:** Asegurar que el ticket contenga el texto del correo o un resumen detallado con los adjuntos y datos relevantes.
- **Regla Cumple:** Copia del requerimiento del cliente con referencias claras, identificadores de envío o capturas mencionadas.
- **Regla No Cumple:** Descripción vacía o que solo dice "Ver correo adjunto" sin ningún texto explicativo.

---

## criterio: email_mda_seguimiento
- **Nombre:** Seguimiento al cliente (Mail Wise)
- **Objetivo:** Evaluar que el operador haya mantenido informado al remitente del avance del caso mediante comentarios o respuestas formales.
- **Regla Cumple:** Constan comentarios con información de avance, número de gestión externa o confirmación de solución enviada al usuario.
- **Regla No Cumple:** El ticket estuvo abierto días sin ninguna comunicación o se cerró sin notificar la resolución al solicitante.
- **Ejemplo Cumple:**
  - Evidencia: "Comentarios registran 2 contactos informando estado de gestión y respuesta final de cierre."
  - Razonamiento: "Se evidencia trazabilidad continua de la atención hacia el usuario."
- **Ejemplo No Cumple:**
  - Evidencia: "Comentarios: sin comentarios registrados por el operador antes del cierre."
  - Razonamiento: "Cierre abrupto sin constancia de comunicación ni seguimiento al solicitante."

---

## criterio: email_mda_exactitud_datos
- **Nombre:** Exactitud en el ingreso de datos (Mail Wise)
- **Objetivo:** Mismo criterio que en llamadas: correspondencia entre el remitente del mail y el usuario cargado en el ticket.

---

## criterio: ag_analisis
- **Nombre:** Análisis de la solicitud (Autogestión)
- **Objetivo:** Verificar que el operador comprendió cabalmente el requerimiento cargado por el usuario en el portal antes de actuar.
- **Qué buscar en el ticket:** Revisar los comentarios del operador y la acción tomada: si derivó correctamente o brindó la respuesta exacta a lo pedido.
- **Regla Cumple (`cumple: true`):**
  - La respuesta o derivación responde puntualmente a lo que el usuario requirió, sin desvíos.
- **Regla No Cumple (`cumple: false`):**
  - El operador responde con una plantilla genérica que no resuelve lo planteado en la solicitud.
  - Se deriva a un área incorrecta por no haber leído el contenido de la solicitud.
- **Ejemplo Cumple:**
  - Evidencia: "El operador identificó que el bloqueo correspondía al perfil de compras y no al usuario de red general."
  - Razonamiento: "Demuestra comprensión específica de la problemática planteada."
- **Ejemplo No Cumple:**
  - Evidencia: "Operador solicita datos que ya estaban expresamente detallados en la descripción inicial."
  - Razonamiento: "Falta de análisis de la información aportada por el solicitante."

---

## criterio: ag_sondeo
- **Nombre:** Sondeo y pruebas realizadas (Autogestión)
- **Objetivo:** Evaluar si el operador realizó indagaciones o pruebas de descarte antes de derivar o escalar.
- **Qué buscar en el ticket:** Comentarios donde se soliciten capturas, se pruebe conectividad o se verifiquen configuraciones previas.
- **Regla Cumple (`cumple: true`):**
  - Se evidencian preguntas de sondeo o intentos de resolución remota en primer nivel.
- **Regla No Cumple (`cumple: false`):**
  - El ticket fue derivado de inmediato ("pase ciego") a segundo nivel sin ninguna pregunta ni prueba básica.
- **Caso Null (`cumple: null`):** Cuando la solicitud es un trámite formal que no requiere pruebas técnicas (ej: solicitud de formulario administrativo).

---

## criterio: ag_procedimiento
- **Nombre:** Cumplimiento del procedimiento (Autogestión)
- **Objetivo:** Asegurar que se siguieron los flujos aprobados para el tipo de requerimiento (solicitud de autorizaciones, uso de plantillas, derivaciones a grupos resolutores).
- **Regla Cumple (`cumple: true`):**
  - Se adjuntó la conformidad del superior si correspondía, se utilizó la plantilla oficial o se derivó al grupo correcto.
- **Regla No Cumple (`cumple: false`):**
  - Se otorgó un permiso sensible sin la aprobación requerida o se incumplió el flujo de derivación establecido.

---

## criterio: ag_documentacion
- **Nombre:** Documentación de la gestión (Autogestión)
- **Objetivo:** Constatar que en el historial del ticket quede registro legible de cada paso técnico realizado.
- **Regla Cumple (`cumple: true`):**
  - Cada acción relevante (llamado al usuario, reseteo, cambio de clave, reenvío de correo) está asentada en un comentario público o privado.
- **Regla No Cumple (`cumple: false`):**
  - El ticket pasa de Nuevo a Solucionado sin ningún comentario que explique cómo se resolvió.

---

## criterio: ag_correccion_prioridad
- **Nombre:** Corrección de prioridad (Autogestión)
- **Objetivo:** En autogestión el usuario suele elegir su propia prioridad (a menudo 'Urgente'). El operador debe ajustarla al criterio técnico real.
- **Regla Cumple (`cumple: true`):**
  - La prioridad fue ajustada al impacto real (o se mantuvo si el usuario la fijó correctamente).
- **Regla No Cumple (`cumple: false`):**
  - Se mantuvo una prioridad 'Urgente' fijada por el usuario para un pedido menor sin justificación operativa.

---

## criterio: ag_correccion_tipo
- **Nombre:** Corrección de tipo de solicitud (Autogestión)
- **Objetivo:** Mismo principio: el usuario puede seleccionar 'Incidente' para pedir un mouse. El operador debe rectificarlo.
- **Regla Cumple (`cumple: true`):**
  - El tipo quedó correctamente tipificado tras la intervención del operador.
- **Regla No Cumple (`cumple: false`):**
  - Permaneció un tipo erróneo sin ser corregido durante el ciclo de vida del ticket.

---

## criterio: ag_categorizacion
- **Nombre:** Categorización (Autogestión)
- **Objetivo:** Rectificación y validación de la categoría asignada al ticket en el portal de autogestión.
- **Regla Cumple:** Categoría de nivel hoja adecuada a la problemática.
- **Regla No Cumple:** Categoría genérica, errónea o desactualizada.

---

## criterio: ag_mda_seguimiento
- **Nombre:** Seguimiento en MDA (Autogestión)
- **Objetivo:** Mantener la cadencia de actualización al usuario sobre los tiempos estimados de resolución o respuesta de áreas terceras.
- **Regla Cumple:** Comentarios periódicos informando al usuario el estado de su trámite.
- **Regla No Cumple:** Ticket estancado sin aviso al solicitante.

---

## criterio: ag_mda_categorizacion_final
- **Nombre:** Categorización final en MDA (Autogestión)
- **Objetivo:** Asegurar que la categoría de cierre represente la resolución técnica alcanzada.
- **Regla Cumple:** Coherencia entre categoría final y solución asentada.
- **Regla No Cumple:** Discrepancia entre la causa real identificada y la categoría con la que se cerró el caso.

---

## criterio: ag_mda_info_complementaria
- **Nombre:** Información complementaria (Autogestión)
- **Objetivo:** Verificar la presencia de datos auxiliares que faciliten auditorías futuras (número de serie del equipo, MAC address, NIS de sucursal, número de formulario SAP).
- **Regla Cumple (`cumple: true`):**
  - Constan identificadores técnicos unívocos del activo o trámite gestionado.
- **Regla No Cumple (`cumple: false`):**
  - Se gestionó un reemplazo o configuración de equipo sin asentar el número de serie ni NIS de la oficina.
- **Caso Null (`cumple: null`):** Casos donde la gestión no involucre activos físicos ni trámites con código externo.
