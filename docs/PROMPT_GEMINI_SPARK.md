# Guía y Prompt para Gemini Spark: Resumen de Novedades del Portal MDA

Esta guía proporciona el procedimiento estándar y el prompt exacto a utilizar en **Gemini Spark** (en navegador) para que inspeccione directamente el repositorio de GitHub en la web, extraiga únicamente los commits nuevos (sin repetir los ya procesados) y genere la nota de novedades con los hashes/IDs de commit asociados.

---

## 1. Procedimiento de Publicación con Gemini Spark

1. Abre **Gemini Spark** en el navegador.
2. Pega el **Prompt de la Sección 2** en la sesión de Gemini Spark.
   > **Nota:** Puedes modificar los parámetros iniciales en la cabecera del prompt si deseas filtrar por una fecha específica o un commit particular:
   > - `FECHA_PERSONALIZADA: false` (o `YYYY-MM-DD` para procesar únicamente ese día)
   > - `COMMIT_ESPECIFICO: false` (o `"hash_o_id"` para generar el changelog de un único cambio puntual)
3. Gemini Spark ejecutará el flujo de inspección de dos pasos:
   - **Paso A:** Inspeccionará `src/config/changelog/` en GitHub para leer el changelog más reciente, su fecha (`YYYY-MM-DD`) y extraer los commits ya publicados.
   - **Paso B:** Ingresará a `https://github.com/ignaciorevainera/correo-argentino-mda/commits/master/`. En GitHub los commits ya vienen visualmente agrupados por fecha ("Commits on Oct 21, 2026", "Commits on Oct 20, 2026", etc.).
     - Si `FECHA_PERSONALIZADA` o `COMMIT_ESPECIFICO` están activos, se enfoca únicamente en ese alcance.
     - Si ambos están en `false`, solo toma commits posteriores a la fecha del último release.
4. Si hay novedades nuevas, copia el archivo Markdown que genere Gemini Spark y guárdalo en:
   `src/config/changelog/YYYY-MM-DD.md` (con la fecha real del día de los commits o la fecha personalizada indicada).
5. Verifica que el archivo generado tenga la lista de IDs de commit en el frontmatter (`commits: [...]`) y que **NO** tenga `draft: true`.
6. Guarda y comitea el nuevo archivo en Git. Si accidentalmente un commit ya estuviera presente en un changelog anterior, el sistema del portal descartará duplicados automáticamente.

> **NOTA OPERATIVA:** Si el repositorio es PRIVADO, la sesión del navegador de Gemini Spark tiene que estar autenticada en GitHub con una cuenta que tenga permisos de lectura sobre el repositorio, o los pasos A3/A4 no le devolverán nada. Verificarlo una vez antes de depender del flujo.

---

## 2. Prompt Estandarizado para Gemini Spark

Copiar y pegar lo siguiente en Gemini Spark:

```markdown
Actúa como Technical Writer y Product Manager del "Portal MDA" (plataforma web interna de soporte y operaciones de Correo Argentino).

PARÁMETROS DE CONFIGURACIÓN (modificar solo si se desea un análisis puntual):
- FECHA_PERSONALIZADA: false  <!-- cambiar a "YYYY-MM-DD" para procesar solo los commits de ese día específico -->
- COMMIT_ESPECIFICO: false    <!-- cambiar al hash/ID corto del commit (ej: "a1b2c3d") para generar un release de ese único commit -->

INSTRUCCIONES DE NAVEGACIÓN Y EXTRACCIÓN EN DOS PASOS:

PASO A — Determinar fecha y commits ya publicados:
1. Abre tu navegador y accede al directorio de changelogs del repositorio:
   https://github.com/ignaciorevainera/correo-argentino-mda/tree/master/src/config/changelog/
2. Ubica el archivo .md más reciente (el que tenga la fecha más alta en el nombre, excluyendo 'example.md'). Anota esa fecha como "FECHA_ULTIMO_RELEASE" (ej: 2026-10-20).
3. Abre ese archivo y extrae todos los IDs de commit listados en el campo `commits:` del frontmatter YAML, así como cualquier hash [`id`] entre corchetes en las viñetas. Ese es el conjunto de commits ya publicados ("COMMIT_IDS_PUBLICADOS").
4. Si la carpeta no tiene archivos de release previos o solo contiene example.md, COMMIT_IDS_PUBLICADOS queda vacío y FECHA_ULTIMO_RELEASE no aplica restricción.

PASO B — Recorrer la página de commits usando la separación por fecha de GitHub:
1. Abre la página de commits de la rama principal:
   https://github.com/ignaciorevainera/correo-argentino-mda/commits/master/
2. En la interfaz de GitHub, los commits están claramente agrupados y separados por encabezados de fecha (por ejemplo: "Commits on Oct 21, 2026", "Commits on Oct 20, 2026", etc.). USA ESTA SEPARACIÓN COMO GUÍA ESTRICTA.

3. EVALUACIÓN DE PARÁMETROS Y ALCANCE:
   - Si COMMIT_ESPECIFICO no es false: busca exclusivamente ese commit, extrae su mensaje/cambios y omite cualquier otro commit.
   - Si FECHA_PERSONALIZADA no es false: busca en GitHub únicamente el bloque de fecha correspondiente a FECHA_PERSONALIZADA y procesa solo los commits de ese día que no figuren en COMMIT_IDS_PUBLICADOS. Si no hay commits ese día, responde que no hay commits para esa fecha.
   - Si ambos son false (modo automático por defecto):
     - SOLO procesa commits de bloques de fecha POSTERIORES a FECHA_ULTIMO_RELEASE.
     - CRÍTICO: NUNCA tomes commits de fechas anteriores a FECHA_ULTIMO_RELEASE ni los agrupes bajo una fecha distinta.
     - Si no hay commits nuevos para el día de hoy o posteriores a FECHA_ULTIMO_RELEASE, responde: "No se encontraron commits nuevos posteriores al último changelog publicado (FECHA_ULTIMO_RELEASE). No hay novedades para generar."

4. Para los commits válidos encontrados: quédate únicamente con aquellos cuyo ID corto (7 caracteres) NO figure en COMMIT_IDS_PUBLICADOS.
5. La fecha del changelog (`date: YYYY-MM-DD` y el nombre del archivo) DEBE ser la fecha personalizada si fue indicada, o la fecha real del bloque de commits en GitHub (nunca una fecha inventada).

REGLAS DE FORMATO Y ESTILO:
1. La salida DEBE ser un archivo Markdown válido con encabezado Frontmatter YAML al inicio.
2. Debe incluir una lista YAML con los identificadores de todos los commits nuevos procesados en el campo `commits`:
   commits:
     - "a1b2c3d"
     - "e4f5a6b"
3. Traduce términos técnicos a lenguaje de negocio comprensible para supervisores y gerentes (ej. "endpoint API" -> "conexión de datos", "fix css overflow" -> "ajuste visual de pantalla", "drizzle schema" -> "base de datos de usuarios").
4. Agrupa los cambios estrictamente en tres categorías si aplican (SIN usar emojis en los títulos):
   - ### Nuevas Funciones (cosas nuevas que ahora el usuario puede hacer)
   - ### Mejoras (cosas que ahora funcionan más rápido, más fácil o con mejor diseño)
   - ### Correcciones (problemas o errores solucionados)
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

### Nuevas Funciones
- **[Módulo o Área]:** [Descripción clara en lenguaje no técnico] [`[id_commit_1]`]

### Mejoras
- **[Módulo o Área]:** [Descripción de la mejora] [`[id_commit_2]`]

### Correcciones
- **[Módulo o Área]:** [Descripción de la solución] [`[id_commit_3]`]
```
