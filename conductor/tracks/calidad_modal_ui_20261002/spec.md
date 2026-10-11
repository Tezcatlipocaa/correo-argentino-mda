# Especificación de Track: Reformulación y Modernización UI/UX del Modal de Auditoría de Calidad

## 1. Resumen y Contexto
El modal de auditoría de calidad (`src/components/supervision/calidad/AuditModal.astro`) concentra múltiples flujos críticos: selección de canal (Wise Llamada, Wise Mail, Autogestión InvGate), búsqueda de casos/tickets mediante APIs externas, visualización de metadatos en vivo, carga de datos básicos, cálculo de score en tiempo real y checklists de evaluación con observaciones.

El diseño actual presenta problemas de jerarquía visual, hacinamiento en los formularios, redundancia en las barras de búsqueda y estilos desbalanceados. Este track refactoriza la UI/UX completa del modal respetando el sistema de diseño del proyecto (DaisyUI v5, Tailwind CSS v4, Geist Variable, iconos Boxicons numéricos y tokens semánticos).

## 2. Requerimientos Funcionales y de UI

### 2.1 Encabezado del Modal
- **Alineación y Jerarquía:** Alinear perfectamente el título ("AUDITORÍA DE CALIDAD" / "EDITAR AUDITORÍA DE CALIDAD") con los botones superiores de canal.
- **Unificación de Botones de Canal:** Unificar los selectores de canal (`Llamada Wise`, `Mail Wise`, `Autogestión`) bajo un contenedor segmentado `join` o botones neutros/ghost limpios que no compitan visualmente con los botones de acción primarios del modal (Guardar/Cancelar).

### 2.2 Barra de Búsqueda Unificada & Metadatos
- **Barra de Búsqueda Única:** Reemplazar las dos barras independientes por una barra unificada con switch/selector de modo integrado (`Wise CX` / `InvGate`) que actualice dinámicamente placeholder, icono y botón de acción.
- **Botón Compacto:** Botón de búsqueda compacto con icono vectorial (`astro-icon`), sin saturar con colores estridentes.
- **Feedback Sutil:** Reemplazar alertas de texto estáticas por toasts no invasivos y badges visuales discretos de confirmación.
- **Cuadrícula de Datos Básicos:** Reorganizar los campos (`Nro Caso`, `Nro Ticket`, `Duración`, `Fecha`, `Tiempo Ringueo`, `Creación`, `Toma`, `PAS`) en una cuadrícula responsiva de 3 columnas armónica y con espaciado consistente.

### 2.3 Visor de Ticket / Caso en Vivo
- **Tipografía y Jerarquía:** Moderar el tamaño de fuente del título del ticket en InvGate; utilizar negrita únicamente como énfasis y alinear perfectamente los tags de estado/validación.
- **Tarjetas de Metadatos:** Presentar Categoría, Prioridad, Estado y Solicitante en cards con bordes limpios, fondo `bg-base-200/40` y valores en `font-mono`.

### 2.4 Bloque de Score Calculado
- **Jerarquía de Puntaje:** El puntaje `TOTAL FINAL 100%` debe ser el elemento más prominente y grande (`text-3xl` o `text-4xl` font-black), con color semántico dinámico.
- **Puntajes Parciales:** Los puntajes de Sección 1 y Sección 2 deben ser claramente secundarios con divisores discretos.

### 2.5 Criterios de Evaluación (Sección 1)
- **Espaciado y Holgura:** Incrementar padding y gaps entre cada ítem de evaluación.
- **Campos de Observaciones:** Espaciado generoso entre el checkbox/etiqueta y el input de comentario opcional.
- **Scrollbars Sutiles:** Estilizar las barras de desplazamiento para que no generen ruido visual.

### 2.6 Gestión de Ticket y Estado Vacío (Sección 2)
- **Estado Vacío Elegante:** Cuando el toggle `¿Se generó ticket?` esté inactivo, renderizar una tarjeta con icono ilustrativo suave, badge explicativo y mensaje centrado, en lugar de un texto plano o caja vacía.

### 2.7 Recomendaciones Generales & Microinteracciones
- **Espaciado Rítmico:** Seguir la escala de 4/8px de Tailwind/DaisyUI.
- **Microinteracciones:** Transiciones fluidas en hover/focus (150-200ms).
- **Semántica:** Utilizar exclusivamente tokens de color DaisyUI (`primary`, `secondary`, `neutral`, `base-100/200/300`, `success`, `error`, `warning`).

## 3. Criterios de Aceptación
1. El modal renderiza sin desbordes horizontales ni solapamientos en resoluciones desktop y laptop (1024px+).
2. El selector de canal y la barra unificada con switch funcionan en todos los flujos interactivos (Wise Call, Wise Email, Autogestión) sin romper la integración existente con las APIs de Wise e InvGate.
3. El cálculo de puntajes en tiempo real se mantiene 100% exacto y se refleja con la nueva jerarquía tipográfica.
4. El toggle condicional de ticket muestra el nuevo estado vacío elegante al desactivarse.
5. Pasa el build de producción de Astro SSR (`npm run build`).
