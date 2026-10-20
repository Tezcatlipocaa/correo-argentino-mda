# Guía y Prompt para Gemini Spark: Resumen de Novedades del Portal MDA

Esta guía proporciona el procedimiento estándar y el prompt exacto a utilizar en **Gemini Spark** (en navegador) para transformar un listado de commits técnicos de Git / GitHub en una nota de novedades clara, amigable y estructurada para supervisores, coordinadores y gerentes.

---

## 1. Procedimiento de Publicación

1. Obtener la lista de commits del período o release a resumir. Por ejemplo, en terminal:
   ```bash
   git log --oneline --no-merges v1.X.X..HEAD
   # o copiar los commits de GitHub desde el pull request / branch
   ```
2. Abrir **Gemini Spark** en el navegador.
3. Copiar el prompt de la sección 2, reemplazando el bloque final con el listado de commits y la fecha correspondiente.
4. Guardar la respuesta generada en un nuevo archivo dentro de `src/config/changelog/` nombrado con la fecha del release (por ejemplo: `src/config/changelog/YYYY-MM-DD.md`).
5. **Importante:** Asegurarse de que el nuevo archivo **NO** tenga `draft: true` en el frontmatter para que se publique en el portal (`draft: true` solo se usa en `example.md`).
6. Crear el commit y pushear el cambio.

---

## 2. Prompt Estandarizado para Gemini Spark

Copiar y pegar lo siguiente en Gemini Spark:

```markdown
Actúa como Technical Writer y Product Manager del "Portal MDA" (plataforma web de soporte y operaciones de Correo Argentino).

Tu tarea es tomar el siguiente listado de commits técnicos de Git y convertirlos en un resumen amigable, profesional y comprensible para usuarios no técnicos (supervisores de mesa de ayuda, líderes operativos y gerentes).

REGLAS DE FORMATO Y ESTILO:
1. La salida DEBE ser un archivo Markdown válido con encabezado Frontmatter YAML al inicio.
2. No inventes funcionalidades que no figuren en los commits.
3. Traduce términos de programación a lenguaje de negocio (ej. "endpoint API" -> "conexión de datos", "fix css overflow" -> "ajuste visual de pantalla", "drizzle schema" -> "base de datos de usuarios").
4. Agrupa los cambios estrictamente en tres categorías si aplican:
   - ### ✨ Nuevas Funciones (cosas nuevas que ahora el usuario puede hacer)
   - ### 🚀 Mejoras (cosas que ahora funcionan más rápido, más fácil o con mejor diseño)
   - ### 🛠️ Correcciones (problemas o errores solucionados)
5. Si un commit es puramente interno de CI/CD, configuración de linter o refactor invisible sin impacto operativo, puedes omitirlo o resumirlo como mantenimiento general.
6. NO utilices clases HTML (class="...") ni etiquetas <iframe> o <script>.
7. Prohibido incluir 'draft: true' a menos que explícitamente se solicite como borrador.

ESTRUCTURA EXACTA DE SALIDA ESPERADA:
---
title: "[Título claro y representativo del release, ej: Actualización Operativa de Octubre]"
date: "YYYY-MM-DD"
version: "[Versión ej: v1.X.0 o dejar vacío]"
highlights: "[Una o dos oraciones con el impacto principal de esta actualización]"
---

### ✨ Nuevas Funciones
- **[Módulo o Área]:** [Descripción clara en lenguaje no técnico]

### 🚀 Mejoras
- **[Módulo o Área]:** [Descripción de la mejora]

### 🛠️ Correcciones
- **[Módulo o Área]:** [Descripción de la solución]

---
LISTADO DE COMMITS A RESUMIR:
[PEGAR AQUÍ LOS COMMITS]
```
