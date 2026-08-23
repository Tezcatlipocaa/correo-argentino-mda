# Estándar de formularios (branch `feat/mesas-de-ayuda-editor-standardization`)

Todo formulario de edición/creación de esta rama debe usar el componente
`src/components/ui/FormShell.astro`. Reglas obligatorias:

1. **Ancho de contenedor**: `PageContainer` con `width="xxl"` para editores
   completos; los formularios chicos (≤4 campos) usan `containerWidth="2xl"`
   (`max-w-2xl`, centrado). `FormShell` ya lo aplica vía prop `containerWidth`.
2. **Sin breadcrumb**: la primera sección del formulario muestra solo el
   `PageHeader` (`<h1>` título + `description` subtítulo), igual que las demás
   secciones de página. No se usa breadcrumb de navegación.
3. **Título y subtítulo**: `PageHeader` con `title` y `description` (p. ej.
   información de lo que se está modificando). El volver al listado se resuelve
   con el botón Cancelar de la barra de acciones (`backHref`).
4. **Íconos**: usar siempre la variante **`-filled`** cuando exista
   (`boxicons:building-house-filled`, `boxicons:save-filled`, etc.). Todo `Icon`
   dentro de un `<template>` clonado por JS o de filas removibles debe llevar
   **`is:inline`** (si no, astro-icon lo renderiza como `<use>` dependiente de
   un `<symbol>` que desaparece al borrar la primera fila).
5. **Barra de acciones** (parte de `FormShell`, al final del formulario, flujo
   normal — no sticky ni flotante):
   - Botón **Cancelar / Volver**: `ActionCancelButton` con `variant="error"`
     (estilo `btn-soft btn-error`), `href` = listado.
   - Botón **Guardar cambios** (o "Crear …"): `ActionConfirmButton`,
     `type="submit"`.
   - Ambos alineados a la derecha (`justify-end`), al pie del formulario.

No reinventar header ni barra de acciones en cada página: usar `FormShell`.
