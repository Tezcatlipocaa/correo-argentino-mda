# Product Guidelines: Portal MDA

## Brand Identity & Visual Direction
- **Identity:** Aplicación web corporativa interna para Correo Argentino. Estética limpia, utilitaria, minimalista y de lectura rápida, optimizada para la productividad en tiempo real de operadores N1/N2.
- **Paleta Oficial:**
  - `primary`: School Bus Yellow (`#ffc72c` / `hsl(44 100% 59%)`) para CTA principal y foco visual prioritario.
  - `secondary`: Steel Azure (`#254888` / `hsl(219 57% 34%)`) para navegación y acciones secundarias.
  - **Líneas de Negocio Reservadas:** Logística (`#54585a`), Financiero (`#009639`), Postal (`#a4343a`).
  - **Neutros:** Platinum (`#efefef`) para fondos base y Onyx (`#0c0c0c`) para texto de alto contraste.
- **Tema:** Base `light` por defecto con soporte `dark` alternable vía header (`theme-change`). Uso estricto de tokens semánticos de DaisyUI v5 (sin valores hex hardcodeados en plantillas).

## Typography
- **Fuente de Interfaz (Sans):** `Geist Variable` vía Fontsource para todo el contenido visual, títulos y formularios.
- **Fuente Técnica (Mono):** `Geist Mono Variable` para identificadores, DNI, terminales, códigos postales, logs e IP.

## Voice & Tone
- **Idioma:** Español neutro/rioplatense institucional (`es-AR`).
- **Tono:** Claro, técnico, directo y profesional. Sin lenguaje promocional ni superfluo.
- **Mensajería:** Mensajes de estado claros vía sistema de Toasts (`success`, `error`, `warning`, `info`). Mensajes de confirmación explícitos para operaciones destructivas o críticas (bajas, reasignación de mesas, reseteo de claves).

## UX & Component Standards
- **Layout Contract:** `body` con `flex flex-col min-h-screen`, `main` con `flex-1` (respetando `BaseLayout.astro`).
- **Componentes Nativos:** Prioridad absoluta a componentes DaisyUI (`btn`, `card`, `modal`, `badge`, `input`, `select`, `table`).
- **Arquitectura de Vistas:** Astro components (`.astro`) para contenido estático/SSR; islas React (`@astrojs/react`) limitadas a interactividad avanzada (`client:visible` / `client:load`).
- **Formularios Estándar:** Adherencia a `FormShell.astro` (`PageHeader` con título y subtítulo, íconos `-filled`, barra de acciones con Cancelar `variant="error"` y Guardar alineados a la derecha).
- **Iconografía:** `astro-icon` con paquete Boxicons (`@iconify-json/boxicons`) usando tamaño numérico (ej. `size={24}`). Sin emojis como íconos de UI.
