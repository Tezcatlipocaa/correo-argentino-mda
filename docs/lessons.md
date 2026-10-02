# Lessons

Este archivo registra errores encontrados durante el desarrollo
y sus soluciones. El agente qa-reviewer lo actualiza despues de
cada tarea donde hubo correcciones reales del usuario.
Se lee al inicio de cada sesion para no repetir los mismos errores.

> Si la tarea fue limpia sin errores, no se agrega nada.
> No inventar entradas vacias — solo registrar lo que realmente ocurrio.

## Registro de errores y soluciones

Cada entrada sigue este formato:

---

### [fecha] — [descripcion breve del patron o error]

**Problema:** [que salio mal o que se aprendio]
**Causa:** [por que ocurrio]
**Solucion:** [como se resolvio]
**Regla:** [la regla general que se extrae para no repetirlo]
**Archivos afectados:** [lista de archivos si aplica]

---

### 2026-05-08 — Corrupcion accidental por sustitucion incorrecta en JSON

**Problema:** Al intentar agregar un enlace al archivo `enlaces_importantes.json`, se introdujeron cadenas incorrectas ("Paquete Argentino") en campos no relacionados, corrompiendo la integridad de otros registros.
**Causa:** El contenido de reemplazo enviado a la herramienta `replace_file_content` contenia datos erroneos (posiblemente por arrastre de contexto o error manual al redactar el bloque).
**Solucion:** Se realizo una lectura inmediata del archivo para identificar el dano y se restauro la estructura original junto con el cambio deseado.
**Regla:** Validar meticulosamente el bloque de `ReplacementContent` antes de ejecutar ediciones, especialmente en archivos de datos (JSON/YAML), para asegurar que no se incluyan sustituciones accidentales fuera del objetivo.
**Archivos afectados:** src/data/enlaces_importantes.json

### 2026-04-13 — Neutral hardcodeado fuera de tokens semanticos

**Problema:** La variante `neutral` en `Button.astro` seguia usando `#F2F2F2` y `text-black`, quedando desalineada con los tokens `neutral`/`neutral-content` definidos en DaisyUI para light/dark.
**Causa:** Implementacion previa del componente con clases hardcodeadas en vez de tokens semanticos.
**Solucion:** Reemplazo minimo de la variante `neutral` para usar `bg-neutral`, `text-neutral-content` y `border-neutral`, incluyendo variantes `outline`, `ghost` y `link` en sintonia semantica.
**Regla:** No hardcodear colores en variantes semanticas; siempre consumir tokens DaisyUI para preservar consistencia entre temas.
**Archivos afectados:** src/components/ui/Button.astro

### 2026-04-17 — Contexto de ruta en Header debe ocultarse completo en mobile

**Problema:** El Header mostraba el icono del contexto de ruta en mobile, incumpliendo el contrato que exige ocultar la zona contextual para priorizar quick actions.
**Causa:** Se oculto solo el texto del contexto (`md:inline`) pero no el bloque completo de contexto.
**Solucion:** Se aplico `hidden md:flex` al contenedor de contexto en el Header para ocultar icono+texto en mobile.
**Regla:** Cuando el contrato pida ocultamiento responsive de una zona, ocultar el bloque semantico completo y no solo parte de su contenido.
**Archivos afectados:** src/layouts/BaseLayout.astro

### 2026-04-18 — Iconos SVG no deben validarse como HTMLElement en microinteracciones

**Problema:** La microinteraccion de copiado no cambiaba de icono (`copy -> check`) aunque el tooltip y el copiado funcionaban.
**Causa:** Los iconos renderizados por `astro-icon` generan nodos SVG, pero la logica los validaba con `instanceof HTMLElement`, bloqueando el toggle de clases.
**Solucion:** Cambiar las validaciones de tipo a `Element` (o `SVGElement`) antes de alternar clases de iconos.
**Regla:** En scripts que manipulan iconos SVG, no asumir `HTMLElement`; validar contra tipos compatibles con SVG para evitar fallos silenciosos de UI.
**Archivos afectados:** src/components/ui/CopyCell.astro

### 2026-04-19 — Evitar warning deprecado por execCommand tipado en scripts Astro

**Problema:** El chequeo de Astro reportaba warning por uso directo de `document.execCommand("copy")` en la pantalla de Enlaces.
**Causa:** TypeScript marca `Document.execCommand` como API deprecada cuando se invoca con el tipo nativo de `document`.
**Solucion:** Mantener fallback legacy de copiado, pero acceder a `execCommand` mediante un wrapper tipado local opcional para evitar el warning sin perder compatibilidad.
**Regla:** Si se necesita fallback legacy, encapsular APIs deprecadas en wrappers tipados locales y priorizar Clipboard API.
**Archivos afectados:** src/pages/enlaces/index.astro

### 2026-04-21 — No truncar colecciones de recursos en UI cuando el modelo es array

**Problema:** La columna de acciones en Contactos Utiles tomaba solo `contact.urls[0]`, dejando URLs adicionales invisibles aun cuando el modelo tipado y los datos incluian multiples entradas.
**Causa:** Implementacion inicial orientada a accion singular de URL en vez de iterar sobre `urls[]`.
**Solucion:** Cambiar el render para mapear todas las URLs de cada contacto y mantener por item las acciones de copiar y abrir, conservando estado vacio cuando `urls[]` esta vacio.
**Regla:** Si el contrato de datos define colecciones (`[]`), la UI debe representarlas completas salvo que exista una regla explicita de truncamiento.
**Archivos afectados:** ---

### 2026-04-29 — Uso de valores arbitrarios de Tailwind degrada la mantenibilidad del diseño

**Problema:** Se detectaron múltiples instancias de tamaños de texto (`text-[10px]`), colores hex (`bg-[#254888]`) y dimensiones (`w-[320px]`) hardcodeadas que rompían la consistencia visual y la compatibilidad con el modo oscuro.
**Causa:** Implementación rápida de componentes sin consultar los tokens predefinidos en `DESIGN.md` o `global.css`.
**Solucion:** Normalización masiva de clases reemplazando valores arbitrarios por tokens semánticos (ej. `text-xs`, `primary`, `secondary`, `w-80`) y variables CSS.
**Regla:** Prohibido el uso de clases arbitrarias `-[...]` para estilos que tengan equivalentes en el sistema de diseño. Priorizar siempre el uso de tokens de DaisyUI y variables definidas en el tema global.
**Archivos afectados:** src/components/UserCard.astro, src/components/cronograma/CronogramaDashboard.astro, src/pages/buscador-usuarios/index.astro, src/pages/directorio-oficinas/index.astro, src/pages/guia-soportes/index.astro, src/layouts/BaseLayout.astro, src/pages/titulos-tickets/_components/Titulos.tsx

---

### 2026-05-11 — Rechazo de push a GitHub por archivos de gran tamaño (>100MB)

**Problema:** El comando `git push` fallaba con error `pre-receive hook declined` debido a archivos ZIP en `public/descargas/aplicativos/` que superaban el límite de 100MB de GitHub.
**Causa:** Inclusión de instaladores de software de gran tamaño (250MB y 150MB) directamente en el repositorio Git sin utilizar almacenamiento de archivos grandes.
**Solución:** Se inicializó Git LFS en el repositorio y se utilizó `git lfs migrate import` para reescribir el historial local de los últimos 5 commits, moviendo los archivos ZIP a seguimiento por LFS. Luego se realizó el push con éxito.
**Regla:** Archivos binarios que superen los 100MB (o carpetas destinadas a descargas pesadas) deben gestionarse con Git LFS desde su inclusión inicial para evitar bloqueos en el push remoto.
**Archivos afectados:** public/descargas/aplicativos/*.zip, .gitattributes

---

### 2026-05-19 — Enlaces rotos (404) al desplegar bajo subdirectorio base /mda/

**Problema:** Al acceder a secciones desde tarjetas de acceso rápido u otras partes de la interfaz, algunos hipervínculos arrojaban error 404.
**Causa:** Los hipervínculos de los componentes de interfaz reutilizables (ej: QuickAccessCard, AnnouncementBanner, CatalogAppCard, CatalogBundleBanner) no incluían de forma dinámica el prefijo de la ruta base del proyecto (`BASE_URL`), lo que rompía la navegación cuando el portal se desplegaba en un subdirectorio (ej. `/mda/`).
**Solución:** Se implementó lógica de resolución de URLs en los componentes UI para que resuelvan dinámicamente el prefijo de ruta basándose en `import.meta.env.BASE_URL`, controlando enlaces externos, esquemas de correo/teléfono y URLs que ya contaban con el prefijo.
**Regla:** Todo componente de UI que renderice enlaces internos debe resolver la URL dinámicamente con `import.meta.env.BASE_URL` para evitar rutas absolutas duras que rompan bajo subdirectorios de despliegue.
**Archivos afectados:** src/components/ui/QuickAccessCard.astro, src/components/ui/AnnouncementBanner.astro, src/pages/catalogo-aplicativos/_components/CatalogAppCard.astro, src/pages/catalogo-aplicativos/_components/CatalogBundleBanner.astro

---

### 2026-06-01 — Estilos scoped de Astro no aplican a componentes hijos ni HTML dinámico

**Problema:** Las clases CSS de chips de color (`office-type-chip-*`) y animaciones de panel de detalle definidas en la página `directorio-oficinas/index.astro` no se aplicaban visualmente, dejando los chips NIS/code sin color representativo por tipo de oficina.
**Causa:** Los estilos estaban dentro de un bloque `<style>` scoped (por defecto en Astro). Los estilos scoped solo aplican a elementos renderizados directamente en la página, no a elementos dentro de componentes hijos (`OfficeRow.astro`) ni a HTML inyectado dinámicamente vía fetch desde la API (`/api/offices`).
**Solución:** Cambiar `<style>` a `<style is:global>` para que las reglas CSS alcancen los elementos renderizados en componentes hijos y en fragmentos HTML insertados por el scroll infinito.
**Regla:** Si una página define estilos que deben aplicar a componentes Astro hijos o a HTML inyectado dinámicamente, usar `<style is:global>`. Los estilos scoped de Astro nunca cruzan la barrera de componente.
**Archivos afectados:** src/pages/directorio-oficinas/index.astro

---

### 2026-06-08 — Pérdida de contexto de ruta en componentes diferidos (server:defer) y falta de prefijo de títulos

**Problema:** Los encabezados de página (`PageHeader`) renderizados dentro de islas diferidas (`server:defer`) mostraban el título genérico "Portal" en lugar del título real del módulo, y los títulos de pestaña del navegador carecían de una estructura prefijada consistente.
**Causa:** Astro realiza peticiones secundarias independientes para renderizar islas diferidas (`server:defer`), lo que altera la propiedad `Astro.url.pathname` del servidor (ej. `/_server-islands/EnlacesContent`), impidiendo que `getSectionTitle` resuelva la sección correspondiente.
**Solución:** Se implementó la utilidad `getResolvedPathname` en `src/lib/navigation.ts` para extraer la URL original a partir de la cabecera `Referer` en las peticiones de server islands, resolviendo correctamente el título en `PageHeader.astro`. Asimismo, se modificó `BaseLayout.astro` para aplicar el prefijo `"Portal MDA | "` de manera centralizada.
**Regla:** En cualquier componente o layout que resuelva información con base en la ruta actual y sea susceptible de ser diferido, se debe resolver la ruta de origen mediante la cabecera `Referer` para conservar la consistencia de UI.
**Archivos afectados:** src/lib/navigation.ts, src/layouts/BaseLayout.astro, src/components/ui/PageHeader.astro

---

### 2026-06-09 — Pérdida de parámetros de búsqueda (searchParams) en componentes diferidos (server:defer)

**Problema:** Los filtros de búsqueda y clasificación en el directorio de oficinas no funcionaban al recargar la página, restableciendo todos los controles a sus valores por defecto.
**Causa:** Astro realiza peticiones independientes al endpoint de islas del servidor (`/_server-islands/...`) para renderizar componentes con la directiva `server:defer`, perdiendo los query parameters originales de la URL de la página.
**Solución:** Se creó e implementó la utilidad `getResolvedSearchParams` en `src/lib/navigation.ts` para extraer los parámetros de búsqueda de la cabecera `Referer` en las solicitudes a islas diferidas, y se la utilizó en `DirectorioContent.astro`.
**Regla:** Todo componente diferido (`server:defer`) que dependa de parámetros de búsqueda (`searchParams`) para filtrar o condicionar su renderizado en servidor debe recuperarlos utilizando la cabecera `Referer` con `getResolvedSearchParams` en lugar de leer directamente `Astro.url.searchParams`.
**Archivos afectados:** src/lib/navigation.ts, src/components/offices/DirectorioContent.astro

---

### 2026-06-17 — Importaciones e import.meta en la parte superior de frontmatters en Layouts de Astro

**Problema:** El empaquetador del servidor (esbuild/vite) de Astro arrojó un error de sintaxis ("Expected identifier but found '/'") al compilar la aplicación tras añadir una importación a mitad del código TypeScript del frontmatter de un layout.
**Causa:** Poner declaraciones de importación (`import`) intercaladas debajo de ejecuciones de lógica o asignaciones de variables locales en el frontmatter de Astro puede confundir al analizador sintáctico del compilador de Astro al transformar archivos `.astro`.
**Solución:** Mover todas las declaraciones `import` estrictamente al bloque superior del frontmatter de la página o layout, y preferir siempre el uso de alias absolutos (`@lib/*`) sobre rutas relativas complejas que salgan del directorio de código fuente para evitar fallos de resolución de módulos.
**Regla:** Mantener de forma rigurosa todas las declaraciones `import` agrupadas en las primeras líneas de los bloques de frontmatter (`---`) en archivos `.astro`.
**Archivos afectados:** src/layouts/BaseLayout.astro

---

### 2026-08-09 — `users.groups` de InvGate devuelve dict (objeto keyed por ID), no array

**Problema:** El endpoint `GET /api/usuarios/invgate-user` devolvía `org.groups: []`, `org.locations: []` y `org.helpdesks: []` vacíos aunque el usuario real tenía grupos/locations asignados en InvGate.
**Causa:** `users.groups` responde un ARRAY de entradas, pero dentro de cada entrada `groups`, `helpdesks` y `locations` llegan como OBJETO/dict keyed por ID (`{ "2604": { id: 2604, name: "TITEC_Telecomunicaciones" } }`), no como array. `toRefs` usa `Array.isArray()` y descarta dicts devolviendo `[]`.
**Solucion:** Verificado en vivo con `users.groups?ids[]=5566` y `users.by?email=...&exact_match=true` (users 5566, 767, 57, 600). `companies` y `*_observed` sí llegan como array (`[]`). **Aplicado:** `toRefs` en `src/pages/api/usuarios/invgate-user.ts` normaliza defensivamente tanto dict (via `Object.values()`) como array antes de mapear a refs `{ id, name }`.
**Regla:** No asumir que las colecciones de refs de InvGate (`groups`, `helpdesks`, `locations`) llegan como array: verificar el shape real y normalizar defensivamente dict y array. `toRefs` ya cubre ambos casos (ver endpoint `invgate-user`). Los endpoints `users.by` documentados como "array" pueden venir como dict keyed por id.
**Archivos afectados:** src/pages/api/usuarios/invgate-user.ts, .agents/skills/invgate-api-requests/endpoints-reference.md

### 2026-08-09 — `users.by?username=` de InvGate requiere email completo (no username bare)

**Problema:** Al buscar con `users.by?username=sdegese&exact_match=true` (username sin dominio) la API responde 200 pero con `data: []`, sin match.
**Causa:** InvGate guarda `username` como email completo (`sdegese@correoargentino.com.ar`), por lo que `username=` solo matchea si se pasa el email completo. Con `email=` o `username=` (email completo) sí matchea.
**Solucion:** Pasar siempre el email completo en la búsqueda por `users.by` (tanto `email=` como `username=`), y hacer doble búsqueda email+username como fallback.
**Regla:** Para `users.by`, buscar con el email completo (`usuario@dominio`); no intentar username bare salvo que se conozca el formato real de `username` en la instancia.
**Archivos afectados:** src/pages/api/usuarios/invgate-user.ts, .agents/skills/invgate-api-requests/endpoints-reference.md

---

### 2026-06-24 — Ausencia de colores en mapa de regiones por valores null en BD

**Problema:** El mapa de regiones y la leyenda lateral en la vista de oficinas se mostraban sin colores asignados (gris por defecto).
**Causa:** La tabla `regions` de la base de datos SQLite no tenía asignado ningún valor en la columna `color` (todos estaban en `null`).
**Solución:** Se implementó y ejecutó un script de actualización que asignó colores hex curados y representativos a las 5 regiones (`CABA`, `SUR`, `PBA-LP`, `NEA`, `NOA`). Adicionalmente, se mejoró `DirectorioContent.astro` agregando un ancho adaptativo al contenedor de controles del mapa, agregando interactividad click-to-zoom en la leyenda del mapa, y validando `map.hasLayer` antes de invocar `bringToFront()`.
**Regla:** Asegurar que los datos estructurados en bases de datos locales que determinan elementos de interfaz (como colores de mapas o leyendas) estén correctamente poblados con tokens consistentes del sistema de diseño.
**Archivos afectados:** database/mda.db, src/components/offices/DirectorioContent.astro

---

### 2026-08-23 ?" Iconos astro-icon desaparecen al clonar/eliminar filas dinamicas

**Problema:** En formularios con filas dinamicas (ej. equipos en OfficeForm), el icono trash desaparecia de todas las filas al eliminar una fila, y los clones del `<template>` salian sin icono.
**Causa:** `astro-icon` en modo default renderiza la PRIMERA aparicion de un icono como `<symbol id="ai:coleccion:nombre">` + `<use href>`, y las siguientes solo como `<use>`. Si el nodo que contiene el `<symbol>` (la primera fila SSR) se elimina del DOM, todos los `<use>` restantes quedan huerfanos y el SVG se ve vacio.
**Solucion:** Agregar `is:inline` a los Icon que viven dentro de filas clonadas/removibles, para que cada instancia embeba el path completo sin depender del symbol compartido.
**Regla:** Todo Icon dentro de un `<template>` clonado por JS o dentro de filas removibles debe usar `is:inline`. Los mesas-de-ayuda/edit.astro ya usaban esta solucion de facto (SVG crudo pegado a mano).
**Archivos afectados:** src/components/admin/OfficeForm.astro

---

### 2026-09-05 — IDs internos de InvGate difieren por instancia (QA ≠ producción) y endpoints paginados

**Problema:** El módulo /automatizaciones (migrado de invgate-automation) traía la constante AUTOMATION_CATEGORY_ID=86 validada en QA; en producción 86 es "Impresoras (GEN) - Configuración" y la hoja real es 3023 ("Automatización de sucursal" bajo TI Tecnologia informatica » Gestión de Servicios » Mesa de Coordinación » Proyectos). Además /categories y /incidents.by.status son paginados (máx 500/page) y el volumen real (2.859 categorías, 78k tickets) rompía la asunción de una sola página y del scan completo por render.
**Causa:** Los IDs internos de InvGate no son estables entre instancias, y los shapes/paginaciones se validaron solo con el volumen chico de QA.
**Solucion:** Resolución dinámica por nombres/rutas (categoría hoja por ruta verbatim de categorías; cola de tickets por helpdesk "Mesa de Coordinación" + nivel en helpdesksandlevels con desambiguación empírica contra la categoría, override INVGATE_AUTOMATION_GROUP_ID/INVGATE_AUTOMATION_CATEGORY_ID). Discovery via /incidents.by.helpdesk del nivel (~30 tickets en producción) + filtro de categoría local + dif de padres desaparecidos (re-chequeo bulk para "Recientes"). Soporte del formato de títulos de producción "Automatización de sucursal B0091" y del formulario inicial en la description del padre (QA lo trae en el primer comentario).
**Regla:** Nunca hardcodear IDs internos de InvGate entre instancias: resolverlos por nombre/ruta verbatim o por vista configurada. Verificar paginación contra el volumen real de producción antes de asumir una sola página. Los títulos de tickets son datos: extender el parser ante formatos nuevos sin romper los anteriores.
**Archivos afectados:** src/lib/workflow/category-resolver.ts, src/lib/workflow/discovery.ts, src/lib/workflow/resolver.ts, src/lib/workflow/branch-title.ts, src/lib/invgate/automation/*, .agents/skills/invgate-api-requests/endpoints-reference.md

---

### 2026-09-05 — View transitions: tema oscuro roto tras swap y morph ausente en contenido de server islands

**Problema:** Con ClientRouter scoped a /automatizaciones: (1) al navegar al detalle el tema pasaba a oscuro (con SO en dark) y el toggle dejaba de funcionar; (2) la view transition solo se veía en el retorno al listado, no en la ida.
**Causa:** (1) El swap de Astro no re-ejecuta scripts inline idénticos y el html nuevo llega sin data-theme — sin el atributo ganaba el `--prefersdark` de daisyUI (preferencia del SO) y el toggle moría: theme-change (scripts/toggle-mode.ts) bindea listeners por-elemento y los module scripts se ejecutan una sola vez por sesión. Además nada escribía localStorage("theme"): la persistencia documentada nunca funcionó. (2) El CSS `view-transition-name` que Astro emite en el head de la página no viaja con el contenido inyectado de una server island: los items tenían el atributo de scope pero 0 reglas de nombre → sin par de morph en la ida.
**Solucion:** (1) applyTheme() + listener astro:after-swap en BaseLayout, y delegación en document que aplica y persiste el tema (data-theme + localStorage) al togglear — reemplaza el rol runtime de theme-change; toggle-mode.ts re-consulta el input vivo para aria-label/checked (observer en documentElement + after-swap). (2) view-transition-name como inline style en items del listado, header del detalle y skeleton del detalle (el inline style viaja siempre con el HTML).
**Regla:** Con ClientRouter: (a) todo estado seteado por script inline en head debe re-aplicarse en astro:after-swap; (b) los module scripts corren una vez por sesión — re-vincular listeners via lifecycle events o usar delegación en document; (c) directivas transition:* dentro de server islands requieren CSS inline (el CSS hoisted al head no alcanza el contenido inyectado).
**Archivos afectados:** src/layouts/BaseLayout.astro, scripts/toggle-mode.ts, src/pages/automatizaciones/_components/AutomationActiveList.astro, src/pages/automatizaciones/_components/AutomatizacionDetalleContent.astro, src/pages/automatizaciones/_components/AutomatizacionDetalleSkeleton.astro

---

### 2026-09-06 — Animación de `<details>` muerta por `display: flex` de DaisyUI `.card`

**Problema:** En /automatizaciones, las cards `<details>` no animaban el expandir/colapsar pese a tener el CSS nativo correcto (`::details-content` con transición de `block-size` + `interpolate-size: allow-keywords`): la altura saltaba de 54px a 171px en un solo frame.
**Causa:** DaisyUI `.card` aplica `display: flex; flex-direction: column` al `<details>`. En Chromium, un `<details>` con `display: flex` deja de interpolar la transición de `::details-content` (el pseudo-elemento pasa de `block-size: 0 / content-visibility: hidden` a `auto / visible` sin transición). Verificado en aislamiento: con `display: block` hay 18 alturas interpoladas; con `flex`, solo 2 (snap).
**Solucion:** Forzar `display: block` scopeado a las cards del listado (`details.group { display: block }` en AutomationActiveList.astro). El layout apilado summary + contenido es idéntico con block. Diagnosticado comparando computed styles de `::details-content` en la app vs variantes de aislamiento (Playwright + muestreo de altura por rAF).
**Regla:** Al animar `<details>` con `::details-content`, forzar `display: block` sobre el elemento si alguna clase (DaisyUI card u otra) le aplica flex/grid. Para diagnosticar animaciones CSS muertas: comparar computed styles del pseudo-elemento dentro de la app contra un HTML de aislamiento con las mismas reglas.
**Archivos afectados:** src/pages/automatizaciones/_components/AutomationActiveList.astro

---

### 2026-09-06 — View transitions sin morph por server islands + datos de solución y ubicación no disponibles en producción

**Problema:** En /automatizaciones/[id] el morph de view transition no arrastraba el contenido real al entrar desde el listado: el capture de la nueva página ocurría con el skeleton (el island `server:defer` resuelve DESPUÉS del capture) y luego el contenido aparecía de golpe. En producción además: (1) el bulk `/incidents?comments=1` OMITE `is_solution` (undefined; validado en vivo, hijos 77765/77775), (2) los formularios de producción NO traen la jerarquía de ubicaciones en el campo Sucursal ni el título (sin "Metro » BA » Merlo »..."), así que región/localidad quedaban null aunque el parser las soporta.
**Causa:** El ClientRouter espera el fetch del documento y captura inmediatamente; los islands se resuelven post-capture. Los shapes de producción difieren de los validados en QA (is_solution solo llega por el endpoint dedicado; la jerarquía vive en el árbol de ubicaciones de InvGate, no en el ticket).
**Solucion:** (1) Página de detalle SIN server:defer: `[id].astro` renderiza todo sincrónico con `await resolveAutomationDetail(id)` → el contenido existe al capture y el morph funciona. Mitigación de latencia: `prefetch: { prefetchAll: false, defaultStrategy: "hover" }` + `data-astro-prefetch="hover"` en "Ver detalle"/"Volver" (navegación medida: 170ms con prefetch caliente). Morph por elementos con nombres únicos por id: `automation-pretty|title|status|started|progress-${id}` (quitar el name del `li` completo, que morpheaba contra el skeleton). (2) Comentario de solución: `GET /incident.comment?request_id=` (ese endpoint SÍ trae is_solution); resolver lo consulta solo para nodos completados. (3) Región/localidad: fallback en cascada jerarquía del formulario → DB de oficinas por branchCode (`getBranchLocation`, offices.locality/county/regionId).
**Ampliación (iteración 2):** `transition:persist` NO es aplicable a server islands: el contenido inyectado no deja wrapper en el DOM (el HTML se inserta plano, sin elemento estable que persistir), así que el morph de vuelta seguía en fade. Solución final: listado TAMBIÉN sincrónico (sin server:defer) → contenido real al capture en ambas direcciones. Para hidratar UI cliente (barra de progreso) tras navegaciones del ClientRouter, usar `document.addEventListener("astro:after-swap", ...)` — el MutationObserver no dispara de forma confiable tras el swap. Progreso instantáneo en revisitas: cache en sessionStorage con TTL (el hydrate consulta cache antes de fetchear; se dispara desde astro:after-swap, que corre dentro del callback de la transición → puede formar par de morph).
**Regla:** Para morphs de view transition con datos dinámicos, el elemento ancla debe existir en el capture: o la página es SSR sincrónica, o el shell renderiza el header sin defer y el body queda diferido. No confiar en shapes de QA para producción: verificar en vivo cada campo (is_solution del bulk, jerarquía en formulario). Para datos derivados de ubicación de sucursal, la DB local de oficinas (código BXXXX) es fuente confiable.
**Archivos afectados:** src/pages/automatizaciones/[id].astro, src/pages/automatizaciones/_components/AutomatizacionDetalleContent.astro, src/pages/automatizaciones/_components/AutomationActiveList.astro, src/pages/automatizaciones/_components/AutomationTimeline.astro, src/pages/automatizaciones/_components/InitialFormDetails.astro, src/components/ui/PageHeader.astro, src/lib/workflow/resolver.ts, src/lib/workflow/branch-location.ts, src/lib/invgate/automation/incidents.ts, src/lib/invgate/automation/types.ts, astro.config.mjs

---

### 2026-09-07 � Matcher de etapas: titulos feos a mano matchean por segmento posterior al " - "

**Problema:** En /automatizaciones/[id] las etapas mostraban FALTANTE falso: tickets creados a mano titulados "AUTOMATICACION DE SUCURSAL B0168<L>\tLIBERTAD - SOLICITUD DE EQUIPAMIENTO" (columna fea de la Mesa) caian en "Sin etapa" porque el stepLabel (texto ANTES del primer " - ") era el segmento feo, no la gestion.

**Causa:** El match solo evaluaba el stepLabel; la gestion real vive en el ULTIMO segmento del titulo ("... - SOLICITUD DE EQUIPAMIENTO"). Ademas, el matching inverso por tokens (nodo subconjunto de la plantilla) matchea titulos genericos de UNA palabra: "Direccion IP - Solicitud - Automatizacion..." matcheaba "Solicitud de equipamiento" con un solo token.

**Solucion:** matchScore evalua TODOS los segmentos del titulo (split " - ") y se queda con el mejor score. El lado inverso (nodo corto, ej "Solicitud Smart Point") exige cobertura total del nodo Y al menos 2 tokens significantes matcheados contra la plantilla; un solo token generico no matchea.

**Regla:** El matching de templates contra titulos de InvGate usa los segmentos del titulo (split " - "), no solo el stepLabel. Match inverso (titulo mas corto que el matchLabel) requiere >= 2 tokens: un token generico ("Solicitud", "Solucion") nunca matchea solo.

**Archivos afectados:** src/lib/workflow/stages.ts, tests/workflow-stages.test.mjs

---

### 2026-09-10 — Workflow AUTSUC nuevo en producción: padres en el helpdesk (no en el nivel), solicitud en hijos "Instalaciones" y renombre de la categoría

**Problema:** El discovery /automatizaciones dejó de traer los tickets padres: (1) falla "No se pudo resolver la categoría", (2) "Datos de solicitud" mostraba el último comentario ("Se reasigna a nueva mesa AUTSUC") en lugar del formulario, (3) no aparecía el último caso real creado con el workflow nuevo (#79867).

**Causa:** El workflow cambió de formato: hoja renombrada a "Automatizar sucursal" (3023) bajo la misma rama Mesa de Coordinación » Proyectos; los padres del workflow nuevo (título "AUTSUC <Sucursal> (B####) <fecha>") se asignan DIRECTO al helpdesk "TI_GSM_MDC AUTSUC" (6409) sin pasar por su nivel (6410); el padre llega con description vacía y 0 comentarios — la solicitud vive en la description de los hijos vinculados "Instalaciones para AUTSUC #<id>". Además la prioridad de fuentes del initialForm (comentario primero) dejaba un comentario de reasignación encima del formulario de la description.

**Solucion:** (a) queue-resolver: sondear el helpdesk Y sus niveles, y devolver todas las colas que contengan la categoría (2026-09 conviven 6409 + 6410); discovery unifica IDs entre colas. (b) category-resolver: primera ruta por el nombre nuevo "Automatizar sucursal" (manteniendo "Automatización de sucursal" como variante) con fallback por nombre regex y desambiguación por unicidad. (c) branch-title: patrones "AUTSUC <nombre> (B####)" y "sucursal B#### - <nombre>"; dedupe del "· <nombre>" cuando el título ya lo menciona (fix "B0168 - Libertad · Libertad"). (d) resolver: description del padre primero, luego comentario, luego fallback a los hijos "Instalaciones para AUTSUC" (nuevo parser instal-form.ts extrae Sucursal/Jefe/fecha programada reutilizando parseSucursalValue). (e) stages: strip de prefijos jerarquizados "1-"/"1.1-" en el matchkey.

**Regla:** Ante cambios de mesa en InvGate: categoría y cola se revalidan por nombre (nunca IDs hardcodeados). Sondear TODAS las colas plausibles (helpdesk + niveles) porque acepta que los padres viven asignados al helpdesk sin nivel. El formulario inicial (solicitud) puede migrar de fuente (comentario → description → hijos vinculados): el parser hace fallback en cascada y nunca lanza.

**Archivos afectados:** src/lib/workflow/queue-resolver.ts, src/lib/workflow/discovery.ts, src/lib/workflow/category-resolver.ts, src/lib/workflow/branch-title.ts, src/lib/workflow/resolver.ts, src/lib/workflow/instalaciones-form.ts, src/lib/workflow/stages.ts

---

### 2026-09-15 — SSR en streaming: la sidebar emitida después del slot falta durante la carga

**Problema:** Al entrar a `/automatizaciones` (especialmente la primera vez, render frío/lento) la barra lateral no se mostraba mientras la página cargaba y aparecía recién al terminar.

**Causa:** En `BaseLayout.astro` la sidebar (`<DrawerContent>`) se renderizaba DESPUÉS de `<main><slot /></main>`. Astro SSR responde en streaming (`transfer-encoding: chunked`): el `<main>` suspende en el frontmatter de la página (`AutomatizacionesContent.astro` espera `discoverAutomations()` + `getIncidentStatuses()` de InvGate), y todo lo que va después del slot —la sidebar— recién se emite al resolver. El navegador ya había pintado head + navbar + `<main>` vacío, así que se veía el shell sin barra lateral.

**Solucion:** Mover `<DrawerContent />` ANTES de `<div class="drawer-content">` en `BaseLayout.astro`, de modo que el shell (toggle + sidebar) se emita antes de cualquier slot que pueda suspenderse. Validado que el layout queda idéntico en ≥1024px y <1024px (daisyUI coloca por grid `grid-column-start` explícito y el `input.drawer-toggle` sigue primero, así que los combinadores `~` se mantienen).

**Regla:** En layouts con SSR streaming, el chrome persistente (sidebar/navbar) debe ir ANTES del `<slot />` en el orden del DOM. Lo que se emite después de un slot con `await` lento no se pinta hasta que ese slot resuelve. Verificar midiendo el orden en el HTML servido (`<aside …drawer-side` antes de `<main>`), no solo el render caliente.

**Archivos afectados:** src/layouts/BaseLayout.astro, tests/automatizaciones-sidebar-shell.spec.ts

---

### 2026-09-15 — Primera carga de /automatizaciones: caches fríos + cadena secuencial de InvGate

**Problema:** La primera carga de `/automatizaciones` tardaba ~6.9 s. El shell ya se pintaba (fix de streaming), pero el contenido esperaba el scan completo. Con cada restart de PM2 los caches en memoria arrancan vacíos y el primer usuario paga todo.

**Causa:** `discoverAutomations()` encadena llamadas secuenciales a InvGate: `resolveAutomationCategoryId` (6 páginas de `/categories` en serie, ~1.9 s) → `resolveAutomationQueueIds` (getHelpdesks + getHelpdesksAndLevels en serie y **5 colas sondeadas en serie**, cada una 2 calls, ~3.5 s) → `incidents.by.helpdesk` → bulk. Además el discovery expiraba duro a los 5 min (el que llegaba justo pagaba ~1 s) y nada sobrevivía a un restart.

**Solucion:** (1) Paralelizar: `/categories` en batches concurrentes de 6, sondeo de colas con `Promise.all`, categoría ∥ (helpdesks + levels), chunks de `/incidents` en batches de 4. Frío 6.9 s → ~2.9 s. (2) Persistir en SQLite (`invgate_cache`) la resolución de categoría/colas, los estados y el snapshot de discovery, con TTL 24 h / 30 min. (3) Stale-while-revalidate en `discoverAutomations` (sirve snapshot y refresca en background, single-flight) y seeding de `seenParentStatuses`/`finalizedSeen` desde el snapshot para no perder "Recientes" tras un restart. (4) Pre-warm: `scripts/warm-automations.ts` corrido desde `auto-deploy.bat` post `pm2 start`. Resultado: proceso nuevo con cache persistido ~4 ms; frío real (cache vacío) ~2.9 s.

**Regla:** En módulos que agregan datos de APIs externas, separar el costo en (a) paralelizar llamadas independientes, (b) persistir las resoluciones estables cross-restart en SQLite, (c) servir stale + refrescar en background, y (d) pre-warm en el deploy. Los caches solo-en-memoria se pierden en cada restart y siempre golpean al primer usuario. El override por env debe aceptar multi-valor cuando la instancia tiene más de una cola.

**Archivos afectados:** src/lib/invgate/automation/categories.ts, src/lib/invgate/automation/incidents.ts, src/lib/invgate/automation/statuses.ts, src/lib/invgate/cache.ts, src/lib/workflow/category-resolver.ts, src/lib/workflow/queue-resolver.ts, src/lib/workflow/discovery.ts, src/db/schema.ts, scripts/warm-automations.ts, scripts/auto-deploy.bat, .env.example, tests/workflow-queue-cache.test.mjs

---

### 2026-09-15 — Cierre local de automatizaciones: caches de detalle/discovery y epoch en segundos

**Problema:** Al cerrar/reabrir un caso localmente, el detalle seguía mostrando "En curso" (sin banner) mientras que el listado ya lo reclasificaba.

**Causa:** El cierre/reopertura se persisten en SQLite y se invalidaba el cache de discovery, pero `resolveAutomationDetail` tiene su propio cache en memoria (TTL 2 min): el reload del detalle servía el resultado viejo con `closure: null`. Además `formatEpochDateTime` espera epoch en **segundos** (como InvGate); guardar `Date.now()` (ms) producía fechas absurdas (año 58676) y rompía el orden de `recentFinalized` (mezcla ms/segundos).

**Solucion:** Exportar `invalidateAutomationDetail(id)` en `resolver.ts` y llamarlo junto a `invalidateDiscoveryCache()` en las actions de cierre y reapertura. Persistir `closedAt` con `Math.floor(Date.now()/1000)` (segundos, consistente con InvGate y con el orden de finalizadas). El cierre automático al 100% se evalúa dentro del pipeline de detalle (oportunista) y limpia auto-cierres si el progreso retrocede.

**Regla:** Cuando una acción cambia estado que alimenta vistas cacheadas, invalidar TODAS las capas de cache afectadas (discovery y detalle), no solo una. Los timestamps de dominio (cierres, snapshots que conviven con datos de InvGate) se guardan en segundos para que `formatEpochDateTime` y los `sort` por fecha funcionen. Un write feature debe invalidar cache en la misma transacción lógica que persiste el cambio.

**Archivos afectados:** src/lib/workflow/closures.ts, src/lib/workflow/discovery.ts, src/lib/workflow/resolver.ts, src/actions/index.ts, src/lib/rbac.ts, src/pages/automatizaciones/_components/AutomatizacionDetalleContent.astro, src/pages/automatizaciones/_components/AutomationList.astro, src/pages/automatizaciones/[id].astro, src/db/schema.ts, tests/workflow-closures.test.mjs

---

### 2026-09-15 — Padres de automatización que desaparecen al reasignarse a otra mesa

**Problema:** Casos recién iniciados aparecían en el portal y dejaban de figurar al completarse el formulario inicial, cuando el workflow reasignaba el padre a otra mesa. Ejemplo real: `#81683/#81679/#81676` (categoría 3023) pasaron del helpdesk AUTSUC (6409/nivel 6410) al nivel 2594 (`TECO_SoporteREDN2`) y desaparecieron.

**Causa:** `discoverAutomations` listaba padres **solo** desde las colas resueltas vía `incidents.by.helpdesk`; al cambiar `assigned_group_id` el padre sale de esas colas. Peor: `reconcileVanishedParents` re-chequeaba un padre desaparecido y, si seguía activo, lo **descartaba** del seguimiento por "dejar de ser ticket de la cola".

**Solucion:** Tracking persistido de padres activos por ID (`automation_tracked_parents`). El scan une IDs de cola ∪ trackeados y fetch en un solo bulk; los activos se recuerdan y los finalizados/ausentes se podan (los finalizados alimentan "Recientes"). Se eliminó el descarte de activos. Backfill por `incidents.by.status` (status 1-4, todas las mesas, 1 call + bulk) filtrado por categoría, en deploy (`warm-automations`) y worker PM2 diario (`reconcile-automation-parents`, 04:00). Verificado: recuperó los 15 padres activos (12 en cola + 3 movidos) y los 3 reaparecieron en el portal.

**Regla:** No asumir que un ticket de un workflow permanece en la cola donde nació: los flujos lo reasignan de mesa. Trackear por identidad (id) persistida y reconciliar periódicamente por categoría (no por cola). Un "barrido por estado + filtro de categoría" sirve para backfill puntual porque `by.status` devuelve todos los IDs activos en una call. Nunca descartar del seguimiento a un ticket activo solo porque salió de la cola.

**Archivos afectados:** src/lib/workflow/tracked-parents.ts, src/lib/workflow/discovery.ts, src/db/schema.ts, scripts/reconcile-automation-parents.ts, scripts/warm-automations.ts, ecosystem.config.cjs, tests/workflow-tracked-parents.test.mjs

---

### 2026-09-26 — Morph de /automatizaciones: el `view-transition-name` inline no está en el código

**Problema:** La entrada del 2026-09-06 documenta como solución final del morph listado↔detalle el uso de `view-transition-name` inline en items del listado y header del detalle. Al analizar el módulo, `grep view-transition-name src` da 0 resultados y el historial git (un único commit del módulo) nunca lo contuvo: la navegación actual usa el fade por defecto del ClientRouter.
**Causa:** El anclaje del morph nunca llegó al código commiteado (posible pérdida al consolidar/refactorizar); el ClientRouter sigue activo solo en `/automatizaciones` (`BaseLayout.astro`).
**Solución:** No se re-implementa por ahora: queda documentado como mejora pendiente, no como bug. Si se retoma, recordar que la card destacada está duplicada en "Todas las automatizaciones" y que los nombres de transición deben ser únicos por página.
**Regla:** Cuando una entrada de lessons describe una solución de UI, verificar con `grep`/selectores que el código la contenga antes de asumirla vigente: las refactorizaciones pueden haberla removido.
**Archivos afectados:** src/layouts/BaseLayout.astro, src/pages/automatizaciones/_components/*.astro, docs/lessons.md

---

### 2026-09-26 — `npm run test:unit` (vitest) no resuelve los alias de tsconfig

**Problema:** `npm run test:unit` falla en la colección de casi todos los `tests/*.test.mjs`: vitest no interpreta los `paths` de `tsconfig.json`, así que los imports `@db/*`, `@lib/*` de los módulos de `src/` rompen (`Cannot find package '@db/index'`). Además, la mayoría de esos `.test.mjs` son scripts standalone con su propio `check()` + `process.exit(1)` (pensados para `node --import tsx tests/foo.test.mjs`), no suites vitest: vitest los marca como "sin tests".
**Causa:** El script `test:unit: vitest run` asume tests en formato vitest con alias configurados, pero el repo usa scripts `tsx` y no hay `vitest.config`.
**Solución:** Para los tests del módulo automatizaciones correr `npx tsx tests/workflow-*.test.mjs` (todos pasan). El nuevo `tests/workflow-timeline-plan.test.mjs` sigue esa misma convención. Queda pendiente (fuera de alcance) reparar `test:unit` o reemplazarlo por un runner de los scripts.
**Regla:** Antes de agregar tests, mirar cómo corren los existentes: en este repo los unit tests de workflow son scripts `tsx`, no vitest.
**Archivos afectados:** package.json, tests/workflow-*.test.mjs

---

### 2026-10-02 - Listado pegado al snapshot persistido y sin paginacion

**Problema:** Un caso cerrado en InvGate no reflejaba "Finalizado" en el portal ni con F5; recien aparecia al abrir el detalle (a veces ~15-20 min despues). Ademas, "Todas las automatizaciones" traia toda la tabla `automation_parents` y filtraba/ordenaba client-side: no escala al crecer el historial.

**Causa:** (1) `resolveAutomationDetail` servia el snapshot persistido y lo marcaba fresco en memoria **sin disparar el refresh en background**, asi que el detalle quedaba pegado hasta que vencia el TTL del persistido (15 min). (2) El listado leia la DB, que solo actualiza el scan de discovery (cache 5 min / SWR hasta 30 min) y no habia revalidacion manual; el fetch de progreso no hacia write-back del estado del padre. (3) `listAutomationParents()` devolvia todas las filas.

**Solucion:** (1) El path persistido dispara siempre `runDetailPipeline` (SWR) y el TTL default del detalle bajo a 5 min. (2) `resolveAutomationProgress` hace write-back de `status_id/updated_at/closed_at` a `automation_parents` (`upsertAutomationParentStatus`). (3) `discoverAutomationsWithMeta` expone `stale`; la vista muestra "Actualizando..." y recarga tras pegarle a `GET /api/automatizaciones/revalidate`, y hay boton "Actualizar" (`?refresh=1`) que fuerza `revalidateAutomations()`. (4) Paginacion server-side (`listAutomationParentsPage` + `listRecentAutomationParents`) con busqueda/filtro en SQL y `Pagination.astro` reutilizado; se elimino `automationListFilterClient.ts`.

**Regla:** En el modulo automatizaciones, la DB de historial es la fuente del listado: cualquier snapshot que se sirva debe poder revalidarse (boton/auto) y toda resolucion que toque un padre debe escribir de vuelta su estado mutable. La busqueda/filtro de un listado paginado va en SQL, nunca client-side sobre la pagina visible.

**Archivos afectados:** src/lib/workflow/resolver.ts, src/lib/workflow/discovery.ts, src/lib/workflow/parent-history.ts, src/lib/invgate/automation/cache-config.ts, src/pages/automatizaciones/_components/AutomatizacionesContent.astro, src/pages/api/automatizaciones/revalidate.ts, src/components/ui/Pagination.astro, src/components/ui/SearchBar.astro, tests/workflow-parent-history.test.mjs

---

### 2026-10-02 - Sucursal y registrador del detalle: un comentario debil bloqueaba el hijo Instalaciones

**Problema:** En B0177 (#81683, Francisco Alvarez) la card "Sucursal" del detalle mostraba "---" mientras que en Tribunales de Banfield (#86762) si aparecia. Inversamente, el "registrado por" aparecia en B0177 pero no en #86762 ni en B0061 (#86717).

**Causa:** (1) `parseInitialForm` devuelve un formulario "debil" (solo `otherFields`) ante cualquier linea "label: valor", y el primer comentario de #81683 era un aviso de Multitoma ("Se vincula tarea ... : #85967"). Ese resultado no-null bloqueaba el fallback `if (parsedForm === null)` al hijo "Instalaciones para AUTSUC", que es donde vive la sucursal real. (2) `initialForm.authorName` solo se resolvia cuando el form venia del primer comentario (`formSource === parentFormComment`); los forms tomados de la description del hijo quedaban sin autor.

**Solucion:** `chooseInitialForm` (`src/lib/workflow/initial-source.ts`) elige la fuente con la sucursal como senal autoritativa: description sustantiva > comentario sustantivo > hijo Instalaciones si aun no hay sucursal. El registrador cae al `creator_id` del ticket padre cuando el form no vino de un comentario. Se agrego `branchName` al detalle como fallback de presentacion en la card Sucursal. La key persistida del detalle pasa a `automation.detail.v2.` para ignorar snapshots viejos.

**Regla:** No asumir que "hay campos parseados" equivale a "hay formulario": validar sustancia (sucursal/jefe/rango IP/fecha) antes de descartar fuentes alternativas. Y todo dato que se muestra en el detalle debe poder resolverse para cualquier origen del form, no solo para el comentario.

**Archivos afectados:** src/lib/workflow/initial-source.ts, src/lib/workflow/resolver.ts, src/pages/automatizaciones/_components/InitialFormDetails.astro, src/pages/automatizaciones/_components/AutomatizacionDetalleContent.astro, tests/workflow-initial-source.test.mjs
