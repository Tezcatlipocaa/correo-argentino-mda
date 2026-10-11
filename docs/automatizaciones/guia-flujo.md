# Guía del flujo de Automatización de Sucursales

Documentación funcional del proceso (etapas, subprocesos y puntos de control).
Para el detalle operativo por sector ver
[`instructivo-operativo.md`](./instructivo-operativo.md); para el mapeo con la
API de InvGate ver [`nota-tecnica-api.md`](./nota-tecnica-api.md).

## 1. Objetivo

La automatización de una sucursal existente coordina — mediante InvGate Service
Management — las solicitudes, configuraciones, altas e instalaciones necesarias
para relanzar la sucursal como automatizada.

El proceso parte de una solicitud de la Mesa de Coordinación (MDC), que aporta la
información de la sucursal y el equipamiento requerido. A partir de esa
información, el workflow genera y relaciona los tickets de las áreas
involucradas, controla el avance y habilita la implementación cuando se cumplen
las condiciones.

## 2. Sectores involucrados

MDC, TECO - Instalaciones, Soporte de Red de 2do Nivel, Laboratorio de Ensamble,
Microinformática (incl. EXT MG y Mobile), Soporte Técnico TI, Servicio Técnico
(Field Services), Asistencia Operativa, GDI, Desarrollo Sucursales, Desarrollo On
Base, Administración Track & Trace, Facturación / Costos e Impuestos,
Infraestructura UNIX y Monitoreo / Operaciones TI. La intervención depende de la
etapa y de las tareas requeridas para cada sucursal.

## 3. Disparador y datos iniciales

El proceso comienza cuando MDC carga y confirma el formulario inicial. La
información inicial contempla:

- Sucursal / ubicación · nombre amigable · NIS · fecha de apertura.
- Jefe de Sucursal · Jefe Zonal.

Con esos datos el workflow genera el identificador del proyecto, actualiza el
ticket principal, incorpora al Jefe de Sucursal como observador y notifica el
inicio.

### Relevamiento previo

Antes o durante la carga, MDC define el equipamiento y las tareas requeridas:
equipamiento existente y a incorporar, cantidades finales y a enviar, necesidades
de conectividad y alimentación, layouts, y responsables/usuarios. El detalle se
completa en el **Plan de Equipamiento**.

## 4. Etapas del proyecto

### 1er Etapa: Lanzamiento y habilitación

- **Solicitud de equipamiento:** servidor, HandHeld, terminales/puestos,
  impresoras y otros dispositivos. El workflow genera tickets específicos
  (servidor, HH, otro hardware) y los vincula a la solicitud general.
- **Relevamiento de conexiones (TECO):** bocas de red, tomas de tensión,
  conectividad e infraestructura física.
- **Preparación y envío de HandHeld:** Micro Mobile; usa sucursal/dirección,
  datos del jefe y código de sucursal.
- **Preparación y despacho del servidor:** imagen Windows 11 MOA, IP provisional,
  configuración remota inicial, hostname e IP definitivos y despacho.
- **Habilitación VDI en rango IPv4:** Soporte de Red N2 habilita el acceso de las
  VDI de GDI al rango de la sucursal.
- **Solicitud de hostnames:** Soporte Técnico TI gestiona hostnames de terminales
  nuevas y existentes (NIS, rango IP, cantidades).

### 2da Etapa: Configuración y registro

- **1era configuración de servidor (Soporte Técnico TI):** configuración remota
  inicial y parámetros definitivos (hostname, IP).
- **Habilitación de servicios M&F (Asistencia Operativa):** seguimiento por
  checklist. Gestiones históricas (SmartPoint/QR, PDV, CAI) migran a tareas
  integradas al flujo.
- **Alta de NIS y parametrizaciones:** alta de NIS, `BR_ADT_BR`, hostname, PDV,
  Track & Trace, cambio a Sucursal Automatizada, alta NIS en OnBase, BITMAPS,
  ECOMTT, ruta BUI, NIS en UNIX y registro del servidor en monitoreo.

### 3er Etapa: Instalación y validación

- **Instalación de equipos (Servicio Técnico):** terminales, impresoras,
  periféricos y verificación de funcionamiento con Mosaic.
- **Configuración del servidor en sitio (Soporte Técnico TI):** requiere NIS en
  `BR_ADT_BR`, CAI, BITMAPS e instalación física.
- **Altas de usuarios (GDI):** usuarios Mosaic y roles.

### 4ta Etapa: Control y Go / No Go

El workflow consulta el estado de los principales tickets y lo presenta en un
tablero de seguimiento (servidor, HandHeld, otro hardware, red y cableado,
servicios M&F, CAI, PDV, carpeta BUI).

- **Primer punto de control:** **Actualizar** o **Avanzar** (genera los
  subprocesos de Desarrollo).
- **Subprocesos:** `DESA Sucursales - Otros Servicios` (CAI, BUI, PDV; adjunta
  BITMAPS) y `DESA On Base - Alta NIS`.
- **Segundo punto de control (Go / No Go):** **Actualizar** o **Avanzar / Go**
  (genera las tareas de implementación).

### 5ta Etapa: Implementación

- Baja del servicio Giros.
- Instalaciones de Servicio Técnico.
- Tickets por dispositivo a Soporte Técnico.
- Configuraciones de Soporte Técnico (depende de Instalaciones).
- Altas de usuarios Mosaic.
- Actualizaciones de sistemas: Central PAQ, SOP Central y ubicación en InvGate
  (reemplazar `GIROS` → `MOSAIC` y `POR FAX` → `MOSAIC`).

### 6ta Etapa: Cierre

- Carga del comentario de solución.
- Publicación en los tickets relacionados (Servicios M&F y Solicitud de
  equipamiento).
- Notificación al Jefe Zonal y seguidores.
- Finalización del workflow (el ticket principal conserva la trazabilidad).

## 5. Modelo general del proceso

```
Solicitud MDC → Lanzamiento y habilitación (equipamiento, red, server, HH,
hostnames, VDI/IP) → Configuración y registro (server, M&F, NIS, sistemas) →
Instalación y validación → Control / Go-No Go → Implementación (bajas, altas,
configuraciones, PAQ, SOP, ubicación) → Cierre
```

## 6. Observaciones y puntos a revisar

1. **Formulario inicial vs. equipamiento:** el inicial contiene identificación,
   responsables, NIS y fecha de apertura; el Plan de Equipamiento va después.
2. **Ejecución en paralelo:** los nodos del workflow crean los tickets
   sucesivamente; las áreas trabajan en paralelo una vez creados.
3. **TECO / relevamiento:** validar si la omisión automática por infraestructura
   suficiente existe fuera del workflow o debe incorporarse.
4. **SmartPoint / QR / PDV / CAI:** actualizar la documentación para marcar las
   gestiones históricas como deprecadas frente al ticket de Servicios M&F.
5. **Plazo de 5 días hábiles:** el workflow no lo implementa como temporizador;
   tratarlo como condición operativa/servicio, salvo automatización externa.
6. **Configuración del servidor:** mantener diferenciadas las configuraciones
   provisional/inicial, definitiva y en sitio.
7. **Acciones que no generan tickets:** distinguir acciones automatizadas por el
   workflow, tickets generados por el workflow y actividades operativas externas.

## 7. Criterio de documentación

Mantener separadas dos capas: la **guía operativa** (qué etapa, qué área, qué se
solicita, qué condición habilita el avance) y la **documentación técnica del
workflow** (nodos, variables, tickets, relaciones, campos, consultas a la API,
fórmulas, condiciones y estados del tablero).
