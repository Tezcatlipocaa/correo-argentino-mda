# Specification: Modal de Calidad — Lógica Reclamo/Novedad, Tildar/Destildar Masivo y Exportación Excel/CSV

## 1. Overview
Este track implementa tres mejoras clave en el sistema de auditorías de calidad de atención (Llamadas Wise CX, Mails Wise CX y Autogestiones InvGate) en el Portal MDA:
1. **Lógica de "Reclamo / Novedad" en Sección de Ticket**: Adaptar el comportamiento para replicar la regla del sistema original en Excel: cuando la atención corresponde a un reclamo o novedad por un ticket preexistente (sin generación de ticket nuevo), la sección de gestión del ticket se aprueba con el 100% de su puntaje asignado (55/55 puntos en llamadas, 100% en mails/mda) sin penalizaciones ni evaluación individual de ítems. Si se generó un ticket nuevo, se evalúan los ítems individuales con sus ponderaciones habituales.
2. **Acciones Rápidas de Selección ("Tildar / Destildar Todos")**: Botones ergonómicos y compactos en la cabecera de cada bloque de evaluación para marcar o desmarcar todos los parámetros con un solo clic y recálculo reactivo en tiempo real.
3. **Revisión de Exportación CSV y Exportación Directa a Excel (.xlsx)**: Modernización y enriquecimiento de las columnas exportadas a CSV y creación de un botón directo de descarga en formato nativo Microsoft Excel (`.xlsx`) con estructura tabular clara y ordenada.

---

## 2. Functional Requirements

### 2.1 Selector de Modalidad de Ticket ("Ticket Nuevo" vs "Reclamo / Novedad")
- **Selector claro en la sección de Ticket**:
  - Reemplazar el toggle genérico `¿Se generó ticket?` por un selector de opciones directas:
    - **Ticket nuevo generado**: Modo normal. Permite auditar y tildar/destildar los parámetros individuales de gestión del ticket (origen, tipo, categorización, ortografía, prioridad, título, descripción, exactitud). Cada parámetro no tildado deduce su ponderación.
    - **Reclamo / Novedad existente**: Modo reclamo/consulta previa. Otorga automáticamente el 100% a la sección de ticket (55 puntos en Wise Call, o 100% en Wise Email MDA). Bloquea u oculta la lista de parámetros individuales para evitar confusión y deducciones indebidas.
- **Cálculo en Tiempo Real (`recalculateScores`)**:
  - Si el modo es "Reclamo / Novedad", `s2Score` es 100% (y en llamadas suma 55 puntos directos a la puntuación total: `total = s1Raw + 55`).
  - Si el modo es "Ticket nuevo generado", `s2Score` se calcula por deducciones de los parámetros no marcados (`55 - s2Deductions` en llamadas).
- **Persistencia y Edición**:
  - Al guardar la auditoría, persistir el modo seleccionado (ej. en metadatos o campo de auditoría).
  - Al abrir una auditoría existente para edición o visualización, restaurar el modo correcto y las puntuaciones exactas.

### 2.2 Botones de Acción Masiva ("Marcar Todos" / "Desmarcar Todos")
- En cada bloque de evaluación (Canal Llamadas S1 y S2, Canal Mails S1 y S2, Autogestiones S1):
  - Añadir botones o controles de acción rápida: "Marcar todos" y "Desmarcar todos".
  - Al hacer clic, actualizar el estado `checked` de todos los checkboxes del bloque respectivo.
  - Disparar de forma inmediata la actualización de puntuaciones (`recalculateScores()`) y badges de preview.
  - Asegurar accesibilidad (labels, títulos informativos, tamaño apto para interacción ágil).

### 2.3 Exportación a CSV y Excel (.xlsx)
- **Revisión del Dataset y CSV**:
  - Auditar las columnas generadas en `btn-export-csv` de `CalidadContent.astro`.
  - Asegurar que incluya: ID Auditoría, Fecha/Hora, Mes, Operador, Nombre de Operador, Auditor/Supervisor, Canal, Identificador de Llamada/Ticket, Tiempo de Respuesta (si aplica), Score Sección 1, Score Sección 2, Score Total, Estado de Ticket (Nuevo vs Reclamo/Novedad), Observaciones Generales y Detalle de Faltas/Penalizaciones.
  - Formato UTF-8 con BOM para correcta apertura en Excel en español (delimitador punto y coma `;`).
- **Exportación Nativa a Excel (`.xlsx`)**:
  - Incorporar botón "Exportar Excel (.xlsx)" en la barra de herramientas del reporte de operador.
  - Generar un libro Excel real (`.xlsx`) con encabezados con estilo/formato, anchos de columna automáticos y tipos de datos numéricos correctos (para que los scores permitan fórmulas y promedios inmediatos en Excel).

---

## 3. Non-Functional Requirements
- **Diseño y Ergonomía**: Seguir las pautas de `docs/DESIGN.md`, utilizando tokens DaisyUI v5 y Tailwind v4 sin colores hardcodeados.
- **Performance**: La exportación no debe congelar el hilo principal ni provocar cuellos de botella en el navegador.
- **Trazabilidad y Calidad**: Tests unitarios que certifiquen el algoritmo de cálculo con Reclamo/Novedad y la consistencia de exportación.

---

## 4. Acceptance Criteria
- [ ] En una auditoría de Llamada Wise, al seleccionar "Reclamo / Novedad", el puntaje de la sección de ticket es automáticamente 100% (55 puntos) y el puntaje total refleja `s1Raw + 55`.
- [ ] Al seleccionar "Ticket nuevo", los 8 parámetros de ticket vuelven a evaluarse uno a uno deduciendo puntos según corresponda.
- [ ] En todos los canales (Llamadas, Mails, Autogestiones), los botones de "Marcar todos" y "Desmarcar todos" tildan y destildan instantáneamente los checkboxes del bloque y recalculan el puntaje en tiempo real.
- [ ] El botón "Exportar CSV" genera un archivo con las columnas revisadas, completas y legibles.
- [ ] El nuevo botón "Exportar Excel (.xlsx)" descarga un archivo `.xlsx` válido que abre directamente en Microsoft Excel con todas las columnas y formatos correctos.
- [ ] Las auditorías guardadas en modo "Reclamo / Novedad" se recargan fielmente al editarlas o revisarlas.

---

## 5. Out of Scope
- Modificación de la ponderación porcentual base de los ítems de calidad en la base de datos (se mantiene la estructura actual de 45% / 55% para llamadas).
- Modificaciones a los canales de auditoría fuera de Calidad de Operadores.
