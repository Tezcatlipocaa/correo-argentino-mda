# Estándar de formularios (branch `feat/mesas-de-ayuda-editor-standardization`)

Todo formulario de edición/creación de esta rama debe usar el componente
`src/components/ui/FormShell.astro`. Reglas obligatorias:

1. **Ancho de contenedor**: siempre `PageContainer` con `width="xxl"` (mismo ancho
   para todos los editores). `FormShell` ya lo aplica.
2. **Breadcrumb**: componente daisyUI `breadcrumbs`. Primera miga = link de
   vuelta al listado con ícono **filled** (`boxicons:arrow-left-filled`). Segunda
   miga = título actual (no es link).
3. **Título**: `PageHeader` (`<h1>`). **Subtítulo opcional**: prop `description`
   de `PageHeader` (p. ej. información de lo que se está modificando).
4. **Íconos**: usar siempre la variante **`-filled`** cuando exista
   (`boxicons:building-house-filled`, `boxicons:save-filled`, etc.).
5. **Barra de acciones** (parte de `FormShell`, abajo-derecha, sticky):
   - Botón **Cancelar / Volver**: `ActionCancelButton` (variante `btn-soft`),
     `href` = listado.
   - Botón **Guardar cambios** (o "Crear …"): `ActionConfirmButton`,
     `type="submit"`.
   - Ambos alineados a la derecha (`justify-end`), pegados a la esquina
     inferior derecha (`sticky bottom-4`).

No reinventar breadcrumb, header ni barra de acciones en cada página: usar
`FormShell`.
