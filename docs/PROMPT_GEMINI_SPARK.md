# Guía y Prompt para Gemini Spark: Resumen de Novedades del Portal MDA

Esta guía proporciona el procedimiento estándar y el prompt exacto a utilizar en **Gemini Spark** (en navegador) para que inspeccione directamente el repositorio de GitHub en la web, extraiga únicamente los commits nuevos (sin repetir los ya procesados) y genere la nota de novedades con los hashes/IDs de commit asociados.

---

## 1. Procedimiento de Publicación con Gemini Spark

1. Abre **Gemini Spark** en el navegador.
2. Asegúrate de tener a mano el ID (SHA corto o completo) del último commit procesado en el changelog anterior (o deja que Gemini Spark revise los archivos existentes en el historial si tiene contexto del chat).
3. Pega el **Prompt de la Sección 2** en la sesión de Gemini Spark.
4. Gemini Spark accederá mediante su navegador a:
   `https://github.com/ignaciorevainera/correo-argentino-mda/commits/master/`
5. Gemini Spark leerá la lista de commits, deteniéndose en el último commit ya conocido o filtrando los repetidos.
6. Copia el archivo Markdown que genere Gemini Spark y guárdalo en:
   `src/config/changelog/YYYY-MM-DD.md` (reemplazando `YYYY-MM-DD` por la fecha de hoy o del release).
7. Verifica que el archivo generado tenga la lista de IDs de commit en el frontmatter (`commits: [...]`) y que **NO** tenga `draft: true`.
8. Guarda y comitea el nuevo archivo en Git. Si accidentalmente un commit ya estaba presente en un changelog anterior, el sistema del portal descartará duplicados automáticamente.

---

## 2. Prompt Estandarizado para Gemini Spark

Copiar y pegar lo siguiente en Gemini Spark:

```markdown
Actúa como Technical Writer y Product Manager del "Portal MDA" (plataforma web interna de soporte y operaciones de Correo Argentino).

INSTRUCCIÓN DE NAVEGACIÓN Y EXTRACCIÓN:
1. Abre tu navegador y accede a la página de commits del repositorio:
   https://github.com/ignaciorevainera/correo-argentino-mda/commits/master/
2. Revisa los commits más recientes en la rama 'master'.
3. CRÍTICO (EVITAR REPETIDOS): Si te indico un commit de corte previo (o revisando la última publicación), procesa ÚNICAMENTE los commits que estén por encima de dicho commit. Si no se indica corte, toma únicamente los commits de los últimos días/semana.
4. Para cada commit considerado, anota su ID / Hash corto (7 caracteres, ej. "a1b2c3d").

REGLAS DE FORMATO Y ESTILO:
1. La salida DEBE ser un archivo Markdown válido con encabezado Frontmatter YAML al inicio.
2. Debe incluir una lista YAML con los identificadores de todos los commits procesados en el campo `commits`:
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

---
(Nota: Si necesitas que me detenga en un commit anterior específico, dime el ID del último commit ya resumido).
```
