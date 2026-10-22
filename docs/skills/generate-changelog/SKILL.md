---
name: generate-changelog
description: Genera la nota de novedades del Portal MDA (src/config/changelog/YYYY-MM-DD.md) desde el historial git, clasificando los commits en Nuevas Funciones, Mejoras y Correcciones, sin duplicar commits ya publicados. Usar cuando se pidan "las novedades", "el changelog", "la nota de versión" o "publicar los cambios".
---

# Generate changelog

Generá la nota de novedades del Portal MDA desde el historial real de git.
Un archivo por día real. Nunca inventes commits, fechas ni descripciones.

## Alcance

- Escribís SOLO en `src/config/changelog/YYYY-MM-DD.md`.
- No tocás `src/lib/`, `src/pages/`, `src/components/`, ni releases ya publicados.
- Si un release ya publicado tiene errores, NO lo reescribas: reportalo y pedí autorización.

## Paso 1 — Commits ya publicados (dedup real)

Releé TODOS los `src/config/changelog/*.md` (excluyendo `example.md` y los que tengan `draft: true` o prefijo `_`).
Para cada archivo tomá:
- los hashes del frontmatter `commits:`
- los hashes `[`hash`]` que aparezcan en las viñetas del cuerpo

Normalizalos a 7 caracteres y unioná todo en un único set `PUBLICADOS`. Ese es el único origen de verdad.
NO confíes en el frontmatter del archivo que estás por escribir: puede traer repetidos.

## Paso 2 — Commits candidatos

```bash
git log --no-merges --since="<fecha último release>" --format="%H|%cd|%s" --date=short
```

- `--since` = la fecha del último release YA publicado (inclusive); si no hay releases, `--since` = 4 semanas atrás.
- Si te piden una fecha puntual, usá `--since="<YYYY-MM-DD> 00:00:00" --until="<YYYY-MM-DD> 23:59:59"`.
- Filtrá los hashes que ya estén en `PUBLICADOS`.
- Descartá commits internos sin impacto operativo: `chore`, `test`, `docs`, `ci`, `build`, `merge`, `conductor`, "Notes added", dependencias, refactors invisibles.
- Si después de filtrar no queda ningún commit: NO escribas ningún archivo. Reportá "no hay novedades nuevas" y listo.

## Paso 3 — Agrupar por día real

El `date` de cada archivo es la fecha REAL de commit (`%cd` de git), no la fecha de hoy ni la fecha de autor (`%ad`).
Un archivo por día: si los commits cubren varios días, escribís un archivo por día.
Título: `Actualización Operativa — DD de Mes de AAAA` (mes en español, ej. "19 de Octubre de 2026").

## Paso 4 — Módulo y descripción

El **Módulo** sale de los paths tocados por el commit, nunca inventado:

```bash
git show --name-only --format="" <hash>
```

Traducí el path a un nombre de módulo en lenguaje de negocio (ej. `src/lib/kb/` → "Base de Conocimiento", `src/components/cronograma/` → "Cronograma").
La descripción explica el cambio en lenguaje operativo, sin jerga técnica y sin inventar alcance.
Si el mensaje del commit es ambiguo, describí conservadoramente lo que el mensaje dice.

## Paso 5 — Escribir el archivo

```markdown
---
title: "Actualización Operativa — 19 de Octubre de 2026"
date: "2026-10-19"
version: ""
highlights: "Una o dos oraciones con el impacto principal de esta actualización."
commits:
  - "abc1234"
  - "def5678"
---

### Nuevas Funciones
- **Módulo:** Descripción clara del cambio. [`abc1234`]

### Mejoras
- **Módulo:** Descripción clara de la mejora. [`def5678`]

### Correcciones
- **Módulo:** Descripción clara de la solución. [`f9e9430`]
```

Reglas de formato (obligatorias):
- Frontmatter YAML al inicio, comillas en los valores de texto.
- `commits`: SOLO hashes cortos de 7 caracteres, en comillas, uno por línea.
- Solo las 3 secciones canónicas, y solo si tienen contenido (omití las vacías).
- Viñeta: `- **Módulo:** Descripción. [\`hash\`]`. Un hash por viñeta; si el commit impacta 2 secciones, repetí el hash en ambas.
- **PROHIBIDO**: `[texto](url)` en cualquier parte (ni en el módulo ni en el texto) — sin links a Google, GitHub ni a nada. Sin HTML, sin `class=`, sin `<iframe>`, sin `<script>`, sin emojis en los títulos, sin `draft: true`.
- Sin tablas, sin bloques de código, sin imágenes.

## Paso 6 — Validación obligatoria (antes de commitear)

1. Todo hash listado existe: `git cat-file -t <hash>` devuelve `commit`.
2. Ningún hash del archivo nuevo está en `PUBLICADOS`.
3. Corré `npm run changelog:validate`. Si falla, corregí el archivo y volvé a correrlo.
4. Confirmá que el release nuevo aparece en `getChangelogEntries()` y que no quedó vacío.

Si algo no podés verificar, no lo escribas: reportá el problema.
