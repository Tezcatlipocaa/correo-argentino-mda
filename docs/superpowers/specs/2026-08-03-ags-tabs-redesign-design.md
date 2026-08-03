# Design Spec: AGS Redesign - Enfoque de Pestañas (Tabs)

**Fecha**: 2026-08-03  
**Módulo**: Asignación de Autogestiones (AGS) (`src/components/supervision/asignacion/AsignacionContent.astro`)

---

## 1. Visión General

Transformar la pantalla de **Asignación de Autogestiones** de una vista mixta (que mezclaba tabla masiva de monitoreo con asignación) a un enfoque orientado a la **tarea del supervisor/dispatcher**, estructurado mediante dos pestañas principales:

1. **Pestaña 1: "Asignación Operativa" (Por defecto)**  
   Centrada 100% en la asignación de tickets en tiempo real y la cola de operadores sin distracciones.
2. **Pestaña 2: "Monitoreo de Operadores"**  
   Dedicada a la auditoría, control de disponibilidad y gestión de excepciones/breaks de los operadores.

---

## 2. Estructura de Interfaz

### Cabecera Global
- Título principal: **Asignación de Autogestiones**
- Pestañas DaisyUI (`tabs tabs-box bg-base-200/50 p-1 rounded-xl`):
  - **Pestaña 1**: `Asignación Operativa` (Icono: `boxicons:user-check`)
  - **Pestaña 2**: `Monitoreo de Operadores` (Icono: `boxicons:group`)

---

### Contenido - Pestaña 1: Asignación Operativa (Vista Principal 100% Ancho)

En esta pestaña, el 100% de la pantalla se dedica al flujo operativo:

1. **Barra Superior de Acción (Hero Card)**:
   - Botón maestro **"Asignar Siguiente"** destacado con el operador sugerido `#1`.
   - Indicador de estado de Lock (quién tiene el control activo).

2. **Grilla Operativa Principal (50% / 50% en Desktop)**:
   - **Panel Izquierdo: "Sin Asignar (Mesa 2510)"**:
     - Listado de tickets pendientes sin asignar.
     - Badge con conteo en tiempo real.
     - Alto cómodo con scroll interno (`max-h-[calc(100vh-280px)]`) y tarjetas con ID en alto contraste.
   - **Panel Derecho: "Próximos en Cola & Historial"**:
     - **Próximos en Cola**: Lista de hasta 10 operadores sugeridos con avatares de iniciales, modalidad y badge del `#1`.
     - **Última Asignación**: Registro de la última asignación realizada hoy.

---

### Contenido - Pestaña 2: Monitoreo de Operadores

En esta pestaña vive la vista analítica y de auditoría:

1. **Tarjetas de KPIs**:
   - Card 1: Disponibilidad Actual (Disponibles vs En Break / Off).
   - Card 2: Fuera de Servicio (Excepcionales vs Breaks).
2. **Barra de Control y Filtros**:
   - Switch *Solo disponibles*.
   - Botones de acción masiva o deshacer.
3. **Tabla de Operadores (DataTable)**:
   - Grilla completa con todos los operadores, estados, modalidad, horario, última asignación y botones de asignación manual / excepciones.

---

## 3. Comportamiento y UX

- **Cambio de Pestaña**: Instantáneo vía CSS/JS (preservando el parámetro `?tab=operadores` en la URL para enlaces directos).
- **Consistencia Visual**:
  - Uso exclusivo de tokens DaisyUI y variables del sistema.
  - Alto contraste en badges (`badge-primary text-primary-content`, `badge-warning text-warning-content`).
  - Animación suave de salida en la cola al asignar.

---

## 4. Archivos Afectados

- **[`src/components/supervision/asignacion/AsignacionContent.astro`](file:///C:/Users/daaltamirano1/Documents/correo-argentino-mda/src/components/supervision/asignacion/AsignacionContent.astro)**: Reestructuración de grilla y pestañas.
