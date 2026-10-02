# Specification: Corrección de Copiado de Imágenes en Cronograma (Grupos y Horas Extras)

## 1. Overview
En el módulo de Cronograma (`/supervision/cronograma`), los botones "Copiar Tabla" de la sección de rotación de sábados y de horas extras generaban imágenes en blanco en el portapapeles o archivo descargado. Además, los elementos objetivo capturados no se correspondían con lo requerido operativamente:
1. La captura de rotación de grupos debe abarcar la tarjeta completa de sábados (`<!-- Saturday Rotation Timeline Card -->` / `#saturday-rotation-card`) incluyendo título, fecha, grupo activo y grilla de horarios, ocultando los controles de acción (`.no-export`).
2. La captura de horas extras debe abarcar la lista compacta de turnos guardados (`<!-- Columna 2+3: Lista compacta -->`) en lugar del lienzo de línea de tiempo horizontal.
3. La causa raíz de la imagen en blanco proviene del contenedor host (`position: fixed; left: -99999px`) en `src/components/cronograma/lib/exporters.ts`, el cual al ser serializado a SVG `foreignObject` por `html-to-image` desplaza todo el contenido 99.999 píxeles hacia la izquierda fuera del viewport del canvas.

## 2. Functional Requirements
- **FR-1: Corrección de captura en `exportAsClipboardImage` (`src/components/cronograma/lib/exporters.ts`):** Reemplazar el desplazamiento extremo (`left: -99999px`) por un posicionamiento offscreen seguro (`top: 0; left: 0; z-index: -9999; opacity: 0; pointer-events: none;`) de modo que las coordenadas locales dentro del clon coincidan exactamente con el canvas de `html-to-image`.
- **FR-2: Captura integral de la Card de Rotación de Sábados:**
  - Actualizar `handleCopyRotationImage` en `src/components/cronograma/lib/dashboard-client.ts` para que `targetEl` sea estrictamente `#saturday-rotation-card`.
  - Asegurar que los botones interactivos marcados con `.no-export` permanezcan ocultos en la imagen resultante y que el ancho (`width`) y padding permitan visualizar con nitidez el título, grupo activo, fecha y la tabla de rotación.
- **FR-3: Captura de la Lista Compacta de Turnos Guardados en Horas Extras:**
  - Asignar un identificador claro (ej. `id="overtime-compact-list-card"`) al contenedor de la Columna 2+3 en `src/components/cronograma/CronogramaDashboard.astro`.
  - Actualizar `handleCopyOvertimeImage` en `src/components/cronograma/lib/dashboard-client.ts` para apuntar a `#overtime-compact-list-card` en lugar de `#overtime-timeline-wrapper`.
  - Ajustar las dimensiones de exportación (`width` y padding) acordes al tamaño compacto de la lista de turnos.
- **FR-4: Preservación de feedback y fallback:** Mantener los estados de botón (spinner mientras procesa, feedback de éxito `¡Copiado!` y toast) así como la descarga directa como fallback si la API de Clipboard no está disponible.

## 3. Non-Functional Requirements
- **NFR-1 (Sin mutación del DOM vivo):** La clonación y aplicación de estilos de exportación debe ocurrir exclusivamente en el DOM clonado sin parpadeos en los componentes visibles.
- **NFR-2 (Compatibilidad de tokens y temas):** La captura debe respetar el fondo `var(--color-base-100)` y tipografía Geist corporativa.
- **NFR-3 (Calidad de exportación):** `pixelRatio: 3` para nitidez al pegar en Teams / WhatsApp / correos.

## 4. Acceptance Criteria
- [ ] Al presionar "Copiar Tabla" en la rotación de sábados, se copia al portapapeles una imagen renderizada que incluye el encabezado de la card (`Horarios de Guardia – Sábados 7 a 13`), badge de grupo activo, fecha y la grilla de horarios.
- [ ] Los botones con clase `.no-export` no aparecen en la imagen de la rotación de sábados.
- [ ] Al presionar "Copiar Tabla" en horas extras, se copia al portapapeles una imagen renderizada de la lista compacta de "Turnos Guardados" (Columna 2+3).
- [ ] Ninguna de las capturas arroja una imagen en blanco o transparente.
- [ ] Los tests E2E de Playwright validan la no emisión de imágenes en blanco y el correcto target de ambos botones.

## 5. Out of Scope
- Modificaciones en la exportación mensual a Excel o PNG server-side (`/api/cronograma/export.png`).
- Modificaciones en la base de datos o lógica de turnos.
