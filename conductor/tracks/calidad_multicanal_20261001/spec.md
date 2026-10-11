# Specification: Sistema de Evaluación de Calidad Multi-Canal (Wise CX & InvGate)

## 1. Overview
Evolución integral del módulo de Calidad de Operadores (`/supervision/calidad-operadores`). Se reemplaza el modelo actual de auditoría única por un sistema estructurado en tres canales operativos:
1. **Llamadas Wise (Telefonía Wise CX)**
2. **Mails Wise (Correos / Tickets Wise CX)**
3. **Autogestiones (Incidentes InvGate Service Desk)**

El sistema introduce **autocompletado de metadatos vía API** al ingresar el ID del caso, una cuota mínima mensual de **12 evaluaciones por operador** (4 de cada canal), parámetros específicos de evaluación por ítem con deducción porcentual por incumplimiento, y una visualización segmentada por canal en el panel de supervisión.

---

## 2. Functional Requirements

### 2.1 Carga Automática de Metadatos vía API
Al ingresar el número o ID del caso en el modal de auditoría, el sistema consultará en tiempo real el backend correspondiente:

- **Llamadas Wise CX:**
  - Endpoint: `/core/v1/cases` (búsqueda por número) + `/core/v1/cases/{id}/activities`.
  - Metadatos extraídos: Operador asignado, Fecha/hora de llamada, Número de Caso Wise, Tiempo de Ringueo (espera en IVR/cola hasta asignación), Duración de la llamada (`call_data.duration`).
- **Mails Wise CX:**
  - Endpoint: `/core/v1/cases/{id}` (o búsqueda por número).
  - Metadatos extraídos: Operador, Fecha de gestión, Creación/Toma (timestamp de creación y primer lectura/asignación), Número de caso Mail Wise.
- **Autogestiones InvGate:**
  - Endpoint: `/api/v1/incident/{id}`.
  - Metadatos extraídos: Operador asignado, Fecha del incidente, Prioridad, Creación/Toma, Número de caso AG, Detección condicional "Es PAS" (según ubicación/mesa de ayuda vinculada).

### 2.2 Matriz y Criterios de Evaluación por Canal

Cada criterio cuenta con un porcentaje de referencia, evaluación **Cumple (Sí / No)**, porcentaje obtenido y campo de observaciones/comentarios. Si un parámetro no cumple, se resta su porcentaje del 100% de la sección.

#### Canal A: Llamadas Wise
- **Sección 1: Items (Gestión de la Llamada / Atención)**
  - Cordialidad y cortesía (3%)
  - Uso del saludo estándar (3%)
  - Demuestra interés en resolver el problema (3%)
  - Sondeo (6%)
  - Escucha en forma activa y atenta (6%)
  - Control de la conversación (3%)
  - Contención en la espera (3%)
  - Se despide cordialmente (3%)
  - Lenguaje apropiado (5%)
  - Cumplimiento de procedimiento (10%)
  - Solicitud (n/a)
- **Sección 2: TICKET (Gestión y Registro en Sistema - Ticket derivado de la llamada)**
  - Origen de la solicitud (6%)
  - Tipo de solicitud (5%)
  - Categorización (10%)
  - Ortografía (8%)
  - Prioridad (6%)
  - Título (7%)
  - Descripción / Evidencia (7%)
  - Exactitud en el ingreso de datos (6%)
  - Reclamo / Novedad (55%)

#### Canal B: Mail Wise
- **Sección 1: Items (Gestión general del correo)**
  - Interpretación de la solicitud (A) (10%)
  - Aplicación de procedimientos (B) (10%)
  - Gestión Outlook/Invgate (C) (10%)
  - Redacción y comunicación (D) (10%)
  - Comunicación y claridad (E) (10%)
  - Resolución brindada (F) (10%)
  - Seguimiento al cliente (G) (20%)
  - Solicitud (n/a)
  - Responde dentro del tiempo establecido 90min (20%)
  - **Selector condicional:** *¿Aplica evaluación MDA?* (Opciones: SÍ / NO, por defecto: NO).
- **Sección 2: Items categoría MDA (Ticket derivado del mail - solo si Aplica = SÍ)**
  - SLA de Resolución (10%)
  - Seguimiento (10%)
  - Categorización final (10%)
  - Origen de la solicitud (7%)
  - Tipo de solicitud (5%)
  - Categorización (10%)
  - Ortografía (10%)
  - Prioridad (10%)
  - Título (8%)
  - Descripción / Evidencia (10%)
  - Exactitud en el ingreso de datos (10%)
  - Reclamo / Novedad (100%)

#### Canal C: Autogestiones (AG)
- **Sección 1: Items (Gestión general del caso)**
  - Corrección del título de la solicitud (A) (10%)
  - Análisis de la solicitud (B) (10%)
  - Sondeo, pruebas realizadas (C) (10%)
  - Cumplimiento del procedimiento (D) (20%)
  - Documentación de la gestión (E) (10%)
  - Corrección de prioridad (10%)
  - Corrección de Tipo de solicitud (10%)
  - Categorización (F) (20%)
  - **Selector condicional:** *¿Queda el caso en MDA?* (Opciones: SÍ / NO, por defecto: SÍ).
- **Sección 2: Items categoría MDA (Aspectos MDA del mismo ticket - solo si Queda en MDA = SÍ)**
  - SLA de Primera respuesta (20%)
  - SLA de Resolución (20%)
  - Seguimiento (20%)
  - Categorización final (20%)
  - Información complementaria (10%)
  - Ortografía (10%)

### 2.3 Reglas de Negocio y Scoring
1. **Puntaje por Evaluación Individual:**
   - Si la Sección 2 aplica: Promedio ponderado de Sección 1 y Sección 2.
   - Si la Sección 2 no aplica: El score de la evaluación equivale al 100% de la Sección 1.
2. **Promedios Mensuales por Canal:**
   - Promedio de Llamadas Wise (media de las 4 evaluaciones del mes).
   - Promedio de Mails Wise (media de las 4 evaluaciones del mes).
   - Promedio de Autogestiones (media de las 4 evaluaciones del mes).
3. **Puntuación Global del Operador:**
   - Promedio de los 3 promedios de canal.
4. **Cuota Mensual Requerida:**
   - 4 Llamadas + 4 Mails + 4 Autogestiones = 12 evaluaciones requeridas por operador/mes.
   - La UI mostrará el progreso de carga (ej. `Llamadas: 4/4`, `Mails: 2/4`, `AGs: 4/4`).

### 2.4 Interfaz de Usuario (UI/UX)
- Separación de auditorías en el detalle del operador mediante pestañas o acordeones: **Llamadas Wise**, **Mails Wise**, **Autogestiones InvGate**.
- Buscador / Autocompletado reactivo en el modal de nueva auditoría al tipear o pegar el ID del caso.
- Tarjetas de estadísticas renovadas que exhiben: Score Global, Score por Canal (Llamadas, Mails, AG), AHT promedio y cumplimiento de cuota mensual.

---

## 3. Data & Storage
- Actualización de esquema en `src/db/schema.ts` para soportar tipo de canal (`channel_type: 'wise_call' | 'wise_email' | 'invgate_ticket'`), metadatos específicos por canal (ring time, durations, PAS flag, creation/assignment timestamps) y estado de aplicación de Sección 2.
- Tabla `audit_scores` vinculada a parámetros tipificados por canal y sección.

---

## 4. Out of Scope
- Modificación masiva de tickets en los sistemas externos (InvGate o Wise CX); la integración es de solo lectura (consulta y extracción de metadatos).
- Evaluaciones automáticas por Inteligencia Artificial (la calificación la realiza el supervisor humano).
