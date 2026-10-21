# Guía y Prompt para Gemini Spark: Resumen de Novedades del Portal MDA

Esta guía proporciona el procedimiento estándar y el prompt exacto a utilizar en **Gemini Spark** (en navegador) para que inspeccione directamente el repositorio de GitHub en la web, extraiga únicamente los commits nuevos (sin repetir los ya procesados) y genere la nota de novedades con los hashes/IDs de commit asociados.

---

## 1. Procedimiento de Publicación con Gemini Spark

1. Abre **Gemini Spark** en el navegador.
2. Pega el **Prompt de la Sección 2** en la sesión de Gemini Spark.
   > **Nota:** No hace falta que intervengas: el prompt deriva el punto de corte solo desde los changelogs ya publicados en el repositorio.
3. Gemini Spark ejecutará el flujo de inspección de dos pasos:
   - **Paso A:** Inspeccionará `src/config/changelog/` en GitHub para leer el changelog más reciente y extraer los commits ya publicados.
   - **Paso B:** Ingresará a `https://github.com/ignaciorevainera/correo-argentino-mda/commits/master/` y extraerá únicamente los commits que estén por encima de los ya procesados.
4. Copia el archivo Markdown que genere Gemini Spark y guárdalo en:
   `src/config/changelog/YYYY-MM-DD.md` (reemplazando `YYYY-MM-DD` por la fecha de hoy o del release).
5. Verifica que el archivo generado tenga la lista de IDs de commit en el frontmatter (`commits: [...]`) y que **NO** tenga `draft: true`.
6. Guarda y comitea el nuevo archivo en Git. Si accidentalmente un commit ya estuviera presente en un changelog anterior, el sistema del portal descartará duplicados automáticamente.

> **NOTA OPERATIVA:** Si el repositorio es PRIVADO, la sesión del navegador de Gemini Spark tiene que estar autenticada en GitHub con una cuenta que tenga permisos de lectura sobre el repositorio, o los pasos A3/A4 no le devolverán nada. Verificarlo una vez antes de depender del flujo.

---

## 2. Prompt Estandarizado para Gemini Spark

Copiar y pegar lo siguiente en Gemini Spark:

```markdown
Actúa como Technical Writer y Product Manager del "Portal MDA" (plataforma web interna de soporte y operaciones de Correo Argentino).

INSTRUCCIONES DE NAVEGACIÓN Y EXTRACCIÓN EN DOS PASOS:

PASO A — Determinar commits ya publicados:
1. Abre tu navegador y accede al directorio de changelogs del repositorio:
   https://github.com/ignaciorevainera/correo-argentino-mda/tree/master/src/config/changelog/
2. Ubica el archivo .md más reciente (el que tenga la fecha más alta en el nombre, excluyendo 'example.md').
3. Abre ese archivo y extrae todos los IDs de commit listados en el campo `commits:` del frontmatter YAML, así como cualquier hash [`id`] entre corchetes en las viñetas. Ese es el conjunto de commits ya publicados ("COMMIT_IDS_PUBLICADOS").
4. Si la carpeta no tiene archivos de release previos o solo contiene example.md, COMMIT_IDS_PUBLICADOS queda vacío y se procesarán todos los commits recientes.

PASO B — Recorrer la página de commits:
1. Abre la página de commits de la rama principal:
   https://github.com/ignaciorevainera/correo-argentino-mda/commits/master/
2. Recorre la lista de commits de más reciente a más antiguo.
3. Quédate únicamente con los commits cuyo ID corto (7 caracteres) NO esté en COMMIT_IDS_PUBLICADOS. CORTA y detén la lectura en el primer commit que sí esté publicado.
4. Si por limitaciones de acceso no logras leer el changelog previo en el Paso A (ej. falta de sesión en repo privado), resume los commits visibles de los últimos días y deja que el sistema del portal descarte los duplicados.

REGLAS DE FORMATO Y ESTILO:
1. La salida DEBE ser un archivo Markdown válido con encabezado Frontmatter YAML al inicio.
2. Debe incluir una lista YAML con los identificadores de todos los commits nuevos procesados en el campo `commits`:
   commits:
     - "a1b2c3d"
     - "e4f5a6b"
3. Traduce términos técnicos a lenguaje de negocio comprensible para supervisores y gerentes (ej. "endpoint API" -> "conexión de datos", "fix css overflow" -> "ajuste visual de pantalla", "drizzle schema" -> "base de datos de usuarios").
4. Agrupa los cambios estrictamente en tres categorías si aplican:
   - ### ✨ Nuevas Funciones (cosas nuevas que ahora el usuario puede hacer)
   - ### 🚀 Mejoras (cosas que ahora funcionan más rápido, más fácil o con mejor diseño)
   - ### 🛠️ Correcciones (problemas o errores solucionados)
5. En cada viñeta, añade al final el ID del commit correspondiente entre corchetes, por ejemplo: `[`a1b2c3d`]`.
6. Si un commit es puramente interno de CI/CD, configuración de linter o refactor invisible sin impacto operativo, puedes omitirlo o resumirlo como mantenimiento general.
7. NO utilices clases HTML (class="...") ni etiquetas <iframe> o <script>.
8. Prohibido incluir 'draft: true' a menos que explícitamente se solicite como borrador.

ESTRUCTURA EXACTA DE SALIDA ESPERADA:
---
title: "[Título claro y representativo del release, ej: Actualización Operativa de Octubre]"
date: "YYYY-MM-DD"
version: "[Versión ej: v1.X.0 o dejar vacío]"
highlights: "[Una o dos oraciones con el impacto principal de esta actualización]"
commits:
  - "[id_commit_1]"
  - "[id_commit_2]"
---

### ✨ Nuevas Funciones
- **[Módulo o Área]:** [Descripción clara en lenguaje no técnico] [`[id_commit_1]`]

### 🚀 Mejoras
- **[Módulo o Área]:** [Descripción de la mejora] [`[id_commit_2]`]

### 🛠️ Correcciones
- **[Módulo o Área]:** [Descripción de la solución] [`[id_commit_3]`]
```
