# Auditoría UX/UI — Portal MDA

Relevamiento de calidad visual y de interacción sobre el Portal MDA, con foco
en "elementos rotos" (restos de migraciones, dependencias muertas, fallbacks
faltantes) y en la deuda de sistema de diseño (elevación, redundancia,
accesibilidad).

- **Fecha:** 2026-09-29
- **Alcance:** rutas de operación, supervisión, recursos y administración
  (14 rutas verificadas en navegador).
- **Método:** inspección de markup renderizado en el dev server
  (`http://localhost:4321`), conteos DOM por ruta, grep sobre `src/`, y
  verificación por ruta (status 200 + h1 + 0 clases muertas + 0 404).

---

## Resumen ejecutivo

Se encontraron y corrigieron cuatro clases de defecto real (sección 1). Quedan
tres frentes de deuda de sistema de diseño que **no** son bugs pero degradan la
consistencia: elevación por sombras sin escala (sección 2), redundancia
estructural e interacción duplicada (sección 3) y accesibilidad (sección 4).

| Sección | Tema | Estado |
| ------- | ---- | ------ |
| 1 | Elementos rotos (clases muertas v4, íconos 404, h1 faltante, TDZ) | **Corregido** |
| 2 | Sombras y elevación sin escala | Pendiente (deuda) |
| 3 | Redundancia estructural / interacción duplicada | Pendiente (deuda) |
| 4 | Accesibilidad (ids duplicados, saltos de heading, inputs sin nombre, touch targets) | Pendiente (deuda) |

---

## Sección 1 — Elementos rotos (corregido)

### 1.1 Clases muertas de DaisyUI v4

El proyecto migró a DaisyUI v5 pero quedaron clases de v4 que ya no generan
estilos: `input-bordered`, `select-bordered`, `textarea-bordered`,
`form-control`, `card-compact`, `tabs-boxed`.

- **Riesgo:** no se ven mal, pero dan falsa señal de estructura y rompen hooks.
- **Fix:** eliminadas en **18 archivos** (29 tokens). Verificado con grep
  `(?<![\w-])class(?<![\w-])` → 0 ocurrencias de las 6 clases en `src/`.
- **Efecto colateral detectado y corregido:** en
  `src/components/supervision/calidad/CalidadContent.astro` el JS usaba una de
  esas clases como ancla (`closest`). Se reemplazó por un atributo
  `data-field` explícito (L1191 markup, L1782 selector).

### 1.2 Íconos rotos (404 en `/api/icons/`)

Los renderers de íconos emitían `<img>` aunque el archivo no existiera en el
directorio de almacenamiento externo, generando 404 y huecos visuales.

- **Fix:** helper SSR `iconExists(iconPath)` en `src/lib/storage.ts`
  (path.basename + guarda `..`, `fs.existsSync`, fail-safe `false`), aplicado
  en **7 renderers**. Donde no hay ícono se muestra el placeholder SVG.
- **Verificación:** `/recursos/aplicativos` renderiza 11 tarjetas con **0
  `<img>` de ícono y 0 404** (antes 11× 404).
- **Regla derivada:** el fallback es de servidor, no `onerror` inline (prohibido
  por el sanitizador de la KB y por CSP).

### 1.3 `/supervision/cronograma` sin `h1`

La página tenía `h1 = 0` (violación de estructura de documento).

- **Fix:** se agregó `<PageHeader class="shrink-0" description="..." />` en
  `src/pages/supervision/cronograma/index.astro` como primer hijo de
  `PageContainer`. Verificado: exactamente 1 `h1` ("Cronograma").
- **Nota:** `class="shrink-0"` es necesario porque `main` es `flex flex-col`.

### 1.4 Regresión de runtime (TDZ) introducida durante el fix de íconos

`/admin/recursos/enlace/create` devolvía **500** por un `ReferenceError`
(`iconExists(link.iconPath)` declarado antes de `let link`). El build y
`verify-build.mjs` **no lo detectan** (es error de ejecución SSR).

- **Fix:** se movió la derivación debajo del bloque POST.
- **Lección:** ver `docs/lessons.md` (2026-09-29, TDZ). Toda ruta modificada
  debe entrar en un smoke test de rutas.

### Verificación de la sección 1

Se agregó `tests/ui/elementos-rotos-regression.spec.ts` (Playwright, 17 tests):
sobre 14 rutas valida `200`, 1 `h1`, 0 elementos con las 6 clases muertas; más
3 casos dirigidos (h1 de cronograma, 0 404 de íconos en aplicativos, y el
guard del TDZ). **Resultado: 17/17 en verde.**

---

## Sección 2 — Sombras y elevación (deuda)

**No existe una escala de elevación.** Hay solo 3 tokens de sombra, y dos de
ellos son semánticos, no de profundidad (`src/styles/global.css:196-198`):

```css
--shadow-glow-success: 0 0 8px rgba(6, 132, 68, 0.4);
--shadow-glow-warning: 0 0 8px rgba(226, 173, 31, 0.4);
--shadow-table-edge:   4px 0 10px -5px rgba(0, 0, 0, 0.05);
```

Hallazgos medidos:

- **20 usos de `shadow-[...]` arbitrario** en `src/` (valores ad-hoc, varios con
  rgba hardcodeado). El sistema de diseño prohíbe hex/rgba hardcodeado; la
  sombra por utilidad arbitraria esquiva esa regla.
- **~20 declaraciones crudas de `box-shadow:`** en bloques `<style>` (no
  pasan por tokens).
- El mismo rol (modal / dropdown / popover) usa **6 valores distintos**, así que
  dos superficies del mismo tipo no se ven iguales.
- **`shadow-sm` se usa como sombra por defecto** (167 usos en `src/`). En
  `/supervision/cronograma` la regla `monthly-cell-button`
  (`src/components/cronograma/lib/monthly-view.ts`) aplica `shadow-sm` a las
  celdas del mes: **~999 celdas sombreadas** en una sola vista. Es ruido visual
  y costo de pintado.

**Dirección sugerida:** definir 3-4 tokens de elevación en `global.css`
(p.ej. `--shadow-raised`, `--shadow-overlay`, `--shadow-modal`) y reemplazar
los arbitrarios/crudos. Bajar `shadow-sm` de las celdas del cronograma a un
borde o nada.

---

## Sección 3 — Redundancia estructural e interacción duplicada (deuda)

- **`/titulos` — 1028 botones sin nombre accesible.** `TitleCard.tsx` renderiza
  3 botones por tarjeta (favorito L49, copiar L62, abrir L69) sin
  `aria-label`. Además el `<h3>` es clickeable (`onClick={() => onCopy(...)}`,
  L35-40) y **duplica** la acción del botón copiar: dos affordances para lo
  mismo, una sin semántica de control.
- **1542 pares `article > article`** en `/titulos` (anidamiento semántico
  redundante).
- **1028 pares `label > button`** en `/titulos` (un `label` envolviendo un
  control distinto del que etiqueta).
- Cero duplicaciones de contenedores tipo `card > card` en el resto del sitio, y
  cero scroll horizontal en las 14 rutas verificadas: la redundancia se
  concentra en `/titulos`.

> **Alcance diferido — React (decisión 2026-09-29).** Toda la sección 3 vive en
> componentes **React** (`.tsx`) bajo `/titulos/`. Por la decisión de no
> intervenir React en esta tanda de trabajo, la sección 3 queda **100% diferida**.
> La superficie React completa del repo son 7 archivos, todos de `/titulos`:
> `src/pages/titulos/_components/{TitleCard,TitleCardSkeleton,TitleConfirmModal,TitleDrawer,TitleModal,TitlesContainer}.tsx`
> y `src/hooks/useTitlesHook.tsx`. Ningún otro hallazgo de esta auditoría toca
> `.tsx`.
>
> Consecuencias operativas:
>
> - La cobertura de tests de la fase 2 (jerarquía de encabezados, objetivos
>   táctiles) **excluye `/titulos`**, porque sus defectos se originan en React.
> - El **Task 1** del plan `docs/superpowers/plans/2026-09-29-fase2-inconsistencias-ui.md`
>   (reescritura de `TitleCard`) queda fuera de alcance hasta que se autorice
>   trabajo sobre React. El resto de ese plan (secciones 2 y 4 sin React) sigue
>   vigente.
> - Los encabezados y objetivos táctiles del **resto** de las rutas sí se
>   corrigen en la fase 2A, más la nota compartida `aboutProjectModal` (emisor
>   global del salto `h2 → h4`).

**Dirección sugerida:** en `TitleCard`, quitar el `onClick` del `<h3>`
(dejar la acción solo en el botón), nombrar los 3 botones con `aria-label`, y
revisar el anidamiento de `article`.

---

## Sección 4 — Accesibilidad (deuda)

- **`id` duplicados de Iconify** (mismo `id` en varios `<svg>` del documento):
  presentes en `/oficinas` (7), `/admin/usuarios` (6), `/buscador-usuarios` (6),
  `/mesas-de-ayuda` (4), `/inventario-terminales` (4). Los `id` de SVG deben ser
  únicos o eliminarse.
- **Saltos de jerarquía de headings:** `2 → 4` en casi todas las rutas, y
  `1 → 3` / `1 → 4` en varias. No hay h2/h3 intermedios donde el diseño sí los
  insinúa.
- **Inputs de credenciales sin nombre accesible:** `/recursos` (4) y
  `/recursos/aplicativos` (8). Necesitan `label`/`aria-label`.
- **Touch targets < 32px:** `/oficinas` (105), `/supervision/cronograma` (48),
  `/titulos` (11), y otros. Por debajo del mínimo recomendado (~44px) para
  interacción táctil.

**Contrapunto:** no hay scroll horizontal en ninguna ruta, no hay `card > card`,
y no hay `id` duplicados fuera de los SVG de íconos. La base de layout es sana;
la deuda es de detalle semántico.

---

## Riesgos latentes (fuera del alcance de esta auditoría)

- **13 tests de aserciones estáticas (`.test.mjs`) fallando de antes — RESUELTO
  en la fase 2C (2026-09-29).** La suite quedó en **20/20 verde**. Disposición por
  causa raíz:
  - `duplicate-groups`, `tt-groups`, `terminal-snapshot`: importaban `vitest` pero
    eran `.test.mjs` → movidos a `tests/unit/*.test.ts` (ahora corren en `vitest`).
  - `app-file-upload`: importaba `@lib/storage` (alias TS) irresoluble en Node →
    convertido a `tests/unit/app-file-upload.test.ts`.
  - `font-pipeline`: change-detector sobre el CSS minificado y sobre un layout de
    build viejo (`dist/_astro`, `dist/index.html`) inexistente en SSR → **retirado**
    (el contrato lo cubre `tests/font-loading.test.mjs`).
  - `locationMatcher`: importaba `.js` en vez de `.ts` + expectativas stale
    (el matcher filtra a hojas con NIS) → reparado.
  - `multi-select-field`, `tag-input-field`, `page-container`, `form-legend`:
    aserciones obsoletas/contradictorias (exigían la clase muerta
    `input-bordered`) → realineadas con el contrato actual; se quitaron los
    bloques change-detector de "rutas/archivos migrados".
  - `filter-inventory`, `filter-offices`, `model-dependent-dropdown`: scripts
    Playwright crudos sin sesión y con rutas viejas → autenticados con un helper
    nuevo (`tests/helpers/session.mjs`) y retargeteados.
- **Archivos sueltos sin trackear** en la raíz: los `tmp-*.cjs` y los parches
  `opencode-*.patch`/`.ps1` ya no están. `test_signature_success.png` (artefacto de
  `tests/signature-generator.test.mjs`) se borró y se agregó a `.gitignore`.
  `tests/kb-categorias-fk.spec.ts` está **trackeado** (no es basura). Quedan 4
  capturas huérfanas sin atribuir ni referencias — `shot-informe-full.png`,
  `shot-informe.png`, `shot-s2.png`, `shot-s2b.png` — pendientes de decisión del
  usuario.

---

## Aprendizajes sobre la UX/UI del sitio

Lo que el relevamiento revela sobre cómo está construida la interfaz:

1. **La migración v4→v5 de DaisyUI fue de clases, no de criterio.** Sobrevivieron
   clases muertas que ya no hacían nada, lo que significa que no hubo una
   verificación visual por ruta al migrar. Un smoke test por ruta es barato y
   habría detectado las 4 clases de defecto de la sección 1.

2. **El sistema de color está tokenizado, pero el de elevación no.** Los colores
   respetan tokens DaisyUI; las sombras son ad-hoc. El diseño "se ve" coherente
   porque el color hace el trabajo pesado, pero el orden de profundidad
   (qué superficie está encima de cuál) es accidental, no declarado. Esto
   explica por qué modales del mismo tipo no coinciden.

3. **Los componentes de lista no están diseñados para la densidad del dato.**
   `/titulos` renderiza 1028 tarjetas: a esa escala, decisiones por tarjeta
   (3 botones sin nombre, `onClick` en el `<h3>`, `article` anidado) se
   amplifican hasta dominar la accesibilidad de la página entera. Los defectos
   de a11y del sitio son, en gran medida, defectos de densidad.

4. **La accesibilidad no falla en lo grande, falla en lo repetido.** Un solo
   `h1` faltante, un `id` de SVG duplicado o un botón sin `aria-label` no se
   nota; repetidos 1000 veces por una decisión de componente, sí. La corrección
   más rentable es arreglar el componente, no la página.

5. **El servidor y el build no son una red de seguridad para la UI.** El `h1`
   faltante, el TDZ y los 404 de íconos pasaron el build en verde. Sin una
   verificación por ruta (status + estructura + consola), los defectos de UI se
   descubren en producción. `tests/ui/elementos-rotos-regression.spec.ts` es la
   red que faltaba.

---

## Evidencia reproducible

- **Spec de regresión:** `npx playwright test tests/ui/elementos-rotos-regression.spec.ts`
  → **17 passed**. Requiere dev server en `http://localhost:4321`.
- **Reporte HTML + traces:** `npx playwright show-report`; traces en
  `test-results/ui-elementos-rotos-regress-*/trace.zip`.
- **Lecciones operativas:** `docs/lessons.md` (entradas 2026-09-29).
