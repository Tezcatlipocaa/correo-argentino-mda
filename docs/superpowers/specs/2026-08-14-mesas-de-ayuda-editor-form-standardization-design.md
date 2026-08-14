# Editor de Mesa de Ayuda — Estandarización de Formularios y Correcciones (Design)

**Fecha:** 2026-08-14
**Archivos afectados:**
- `src/pages/mesas-de-ayuda/edit.astro`
- `src/components/ui/forms/MultiSelectField.astro` (nuevo)
- `src/components/ui/forms/TagInputField.astro` (nuevo)
- `src/components/soportes/HelpdeskCard.astro`
- `src/components/soportes/SoportesPublicContent.astro`
- `src/db/schema.ts` + `drizzle/`

## Objetivo

Componentizar y estandarizar el formulario de edición de mesas de ayuda (InvGate). En el camino se corrigen tres errores puntuales del formulario y su comportamiento:

1. **Categorías de derivación** se editan hoy como textarea de IDs crudos (`[5, 12, 23]`); deben editarse con nombres, desde un multi-select alimentado por InvGate.
2. **Tópicos** se editan hoy como textarea JSON manual; deben editarse como tags de texto libre (escribir + Enter aplica un tag).
3. **Contactos** no sirven: se eliminan por completo (campo, columna, display).

El cambio establece el patrón base de "componentizar formularios con dimensiones/estilos consistentes" que luego se replicará en los demás formularios (oficinas, etc.): reutilizar primitivas existentes (`FormField`, `SelectField`, `FormTextarea`, `SectionCard`) con sizing uniforme `input-sm` y grid consistente, añadiendo solo las primitivas nuevas que falten.

## Componentes nuevos

### `MultiSelectField.astro`

Primitiva reutilizable de multi-select con búsqueda, en vanilla JS (mismo patrón de `OfficeForm`).

- Props: `id`, `name`, `label`, `options: {value,label}[]`, `selected: string[]`, `helpText?`, `required?`, `size?`.
- Render: `fieldset.fieldset` + `FormLegend` (consistente con `SelectField`), lista de chips de valores seleccionados, input de búsqueda, dropdown de opciones filtrables.
- Salida: un `<input type="hidden" name={name}>` por valor seleccionado → compatible con `formData.getAll(name)`.
- Comportamiento: click en opción la agrega (chip); `×` en chip la quita; búsqueda filtra por `label`.
- Sin dependencias nuevas; estilos con tokens DaisyUI.

### `TagInputField.astro`

Primitiva reutilizable de tags de texto libre (también vanilla JS).

- Props: `id`, `name`, `label`, `tags: string[]`, `placeholder?`, `helpText?`, `required?`.
- Render: `fieldset.fieldset` + `FormLegend`, chips de tags existentes, input de texto libre.
- Enter agrega tag (trim + uppercase, consistente con `initTextFormatting` del formulario de oficinas); `×` o backspace quita tag; se ignora tag vacío/duplicado.
- Salida: un `<input type="hidden" name={name}>` por tag → `formData.getAll(name)`.

## Editor (`mesas-de-ayuda/edit.astro`)

### Frontmatter (server)

- Obtener categorías de InvGate: `invgateGet("categories")` → mapear a `options` `{value: String(id), label: name}`. Agrupar opcionalmente por `parent_id` (optgroup) si el árbol lo amerita; si `parent_id` no está presente en la respuesta, listado plano. Si no existe un tipo `InvgateCategory` en `src/types/invgate.ts`, agregarlo (`{id, name, parent_id?}`).
- Parsear valores guardados del registro existente:
  - `categories`: JSON array de IDs → `selected` (strings).
  - `topics`: JSON array de strings → `tags`.

### Formulario

- Reemplazar textarea `categories` → `MultiSelectField` (opciones de InvGate, `selected` de DB).
- Reemplazar textarea `topics` → `TagInputField` (`tags` de DB).
- Mantener `notes` como `FormTextarea`.
- Eliminar bloque `contacts` (textarea).
- Reorganizar el cuerpo del form en `SectionCard` con grid consistente de 2 columnas (`grid-cols-1 md:grid-cols-2`), mismo sizing `input-sm` en inputs, coherente con el resto del portal.

### POST

- `categories`: `data.getAll("categories")` → array de strings → validar números → guardar como JSON de IDs (formato actual sin cambios).
- `topics`: `data.getAll("topics")` → array de strings → guardar como JSON de strings.
- `notes`: sin cambios.
- Eliminar `contacts` del `insert`/`update` de `supportGuides`.
- Mantener el resto de lógica (vinculación de mesas SM, auditoría, redirect con toast).

## Card modal (`HelpdeskCard.astro` + `SoportesPublicContent.astro`)

- `SoportesPublicContent.astro`: una sola llamada a `invgateGet("categories")`; construir `Map<number, string>` (`id → name`) y pasarlo a `HelpdeskCard` como prop.
- `HelpdeskCard.astro`: en la sección "Categorías de derivación", renderizar el nombre (`map.get(cid)`) en vez de `ID: {cid}`. Si un ID no tiene nombre, fallback a `ID: {cid}`.
- Eliminar el bloque de "Contactos" del modal (y su uso en `searchableText`).

## Schema

- Eliminar columna `contacts` de `supportGuides` en `src/db/schema.ts`.
- Actualizar snapshots Drizzle (generados) y correr `npm run db:push`.
- Migración SQLite idempotente: `ALTER TABLE support_guides DROP COLUMN contacts;` (SQLite soporta `DROP COLUMN` en versiones recientes; si falla, recrear tabla según patrón Drizzle).

## Flujo de datos

```
GET edit.astro
  ├─ invgateGet("categories") ──► options (id+name)
  ├─ supportGuides.findMany(invgate_id) ──► selected/tags
  └─ render: MultiSelectField (categories) + TagInputField (topics) + notes

POST edit.astro
  ├─ getAll("categories") ──► number[] ──► JSON string ──► supportGuides.categories
  ├─ getAll("topics") ──► string[] ──► JSON string ──► supportGuides.topics
  └─ (sin contacts)

GET mesas-de-ayuda (SoportesPublicContent, server:defer)
  └─ invgateGet("categories") ──► Map<id,name> ──► HelpdeskCard ──► badge nombre
```

## Manejo de errores

- Falla de InvGate en el editor (categorías): degradar a un campo de texto plano (valor actual crudo) + toast de advertencia; el guardado sigue funcionando.
- Falla de InvGate en el listado (card modal): mostrar fallback `ID: {cid}` sin romper el render.
- `TagInputField`: ignora tags vacíos o duplicados (case-insensitive).
- `MultiSelectField`: selección vacía permitida (campos opcionales).

## Edge cases

| Caso | Resultado |
|------|-----------|
| Categoría guardada cuyo ID ya no existe en InvGate | `Map` sin entrada → fallback `ID: {cid}` |
| Tópico guardado con formato no-JSON (legacy) | Parseo defensivo: si falla, `tags = []` |
| Registro sin `invgate_id` vinculado (nuevo) | `selected`/`tags` vacíos; guardado normal |
| InvGate devuelve categorías sin `parent_id` | Listado plano, sin optgroup |

## Alcance (fuera de scope)

- NO se toca el formulario de oficinas en este spec (sub-proyecto separado).
- NO se cambia la estructura de la tabla `supportGuides` salvo la columna `contacts`.
- NO se reemplaza la vinculación/desvinculación de mesas SM existente.
- NO se agregan dependencias nuevas.

## Testeo

- Build: `npm run build`.
- `npm run db:push` para aplicar el drop de columna.
- E2E Playwright (nuevo spec en `tests/`): abrir editor, verificar multi-select de categorías con nombres, guardar, verificar IDs persistidos; verificar tag input (Enter agrega, guardar persiste); verificar ausencia de campo contactos.
- Manual: abrir `mesas-de-ayuda/edit?invgate_id=...`, confirmar categorías con nombre, tópicos como tags, sin contactos; verificar el modal de la card muestra nombres de categoría.
