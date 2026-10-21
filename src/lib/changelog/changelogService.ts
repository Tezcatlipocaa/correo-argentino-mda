import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { renderMarkdown } from "../markdown.js";

export type ChangelogSectionKey = "funciones" | "mejoras" | "correcciones" | "otras";

export interface ChangelogSection {
  key: ChangelogSectionKey;
  title: string;
  html: string;
}

export interface ChangelogFrontmatter {
  title: string;
  date: string;
  version?: string;
  draft?: boolean;
  highlights?: string;
  commits?: string[];
}

export interface ChangelogEntry extends ChangelogFrontmatter {
  slug: string;
  content: string;
  html: string;
  sections: ChangelogSection[];
}

const changelogCacheByDir = new Map<string, ChangelogEntry[]>();

/**
 * Resuelve la clave de cache para un directorio incluyendo su mtime.
 * Esto asegura que si se agrega, modifica o elimina un archivo changelog en disco,
 * el cache se invalida automáticamente tanto en desarrollo como en producción.
 */
function getCacheKeyForDir(dir: string): string {
  try {
    const stat = fs.statSync(dir);
    return `${dir}:${stat.mtimeMs}`;
  } catch {
    return dir;
  }
}

/**
 * Normaliza una fecha a formato estándar YYYY-MM-DD.
 */
function normalizeDate(rawDate: unknown): string {
  if (!rawDate) return "1970-01-01";
  const str = String(rawDate).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }
  return str;
}

/**
 * Resuelve el directorio estándar donde residen los changelogs.
 */
export function resolveChangelogDir(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, "../../config/changelog"),
    path.resolve(process.cwd(), "src/config/changelog"),
    path.resolve(process.cwd(), "dist/config/changelog"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), "src/config/changelog");
}

/**
 * Normaliza una lista de commits proveniente de frontmatter YAML.
 */
function normalizeCommits(rawCommits: unknown): string[] {
  if (!rawCommits) return [];
  if (Array.isArray(rawCommits)) {
    return rawCommits.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof rawCommits === "string") {
    return [rawCommits.trim().toLowerCase()].filter(Boolean);
  }
  return [];
}

/**
 * Extrae todos los hashes de commit referenciados en el contenido Markdown.
 */
function extractCommitsFromContent(content: string): string[] {
  const matches = content.matchAll(/\[`?([a-f0-9]{7,40})`?\]/gi);
  const found: string[] = [];
  for (const m of matches) {
    if (m[1]) {
      found.push(m[1].toLowerCase());
    }
  }
  return found;
}

/**
 * Parsea el frontmatter de un documento Markdown delimitado por '---'.
 */
function parseFrontmatterAndContent(fileContent: string): {
  frontmatter: ChangelogFrontmatter;
  content: string;
} {
  const normalized = fileContent.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    return {
      frontmatter: {
        title: "Actualización sin título",
        date: "1970-01-01",
        commits: [],
      },
      content: normalized.trim(),
    };
  }

  try {
    const parsedYaml = YAML.parse(match[1]) || {};
    return {
      frontmatter: {
        title: parsedYaml.title || "Actualización",
        date: normalizeDate(parsedYaml.date),
        version: parsedYaml.version,
        draft: Boolean(parsedYaml.draft),
        highlights: parsedYaml.highlights,
        commits: normalizeCommits(parsedYaml.commits),
      },
      content: match[2].trim(),
    };
  } catch {
    return {
      frontmatter: {
        title: "Actualización",
        date: "1970-01-01",
        commits: [],
      },
      content: match[2].trim(),
    };
  }
}

/**
 * Filtra líneas de commits duplicados dentro del contenido markdown.
 * Solo descarta la línea si el hash detectado:
 * 1) pertenece a entryCommits (exclusivamente frontmatter `commits:`)
 * 2) y YA fue visto en un release previo (seenCommits).
 */
function deduplicateContentLines(
  content: string,
  entryCommits: Set<string>,
  seenCommits: Set<string>,
): string {
  const lines = content.split("\n");
  const filteredLines: string[] = [];

  for (const line of lines) {
    if (seenCommits.size > 0) {
      const commitMatch = line.match(/\[`?([a-f0-9]{7,40})`?\]/i);
      if (commitMatch) {
        const commitId = commitMatch[1].toLowerCase();
        if (entryCommits.has(commitId) && seenCommits.has(commitId)) {
          continue;
        }
      }
    }
    filteredLines.push(line);
  }

  const cleaned = filteredLines.join("\n").trim();
  const withoutHeadings = cleaned
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/\s+/g, "");

  if (withoutHeadings.length === 0) {
    return "";
  }

  return cleaned;
}

/**
 * Determina la clave canónica de una sección a partir de su encabezado.
 */
export function classifySectionHeading(heading: string): { key: ChangelogSectionKey; title: string } {
  const cleanTitle = heading.replace(/^#{1,6}\s*/, "").trim();
  const lower = cleanTitle.toLowerCase();

  // Matcheo ordenado y estricto por regex para evitar colisiones:
  // 1. correcciones (ej: "### 🛠️ Correcciones nuevas")
  if (/correcci[oó]n|correcciones/i.test(lower)) {
    return { key: "correcciones", title: cleanTitle };
  }
  // 2. nuevas funciones / funciones
  if (/nuevas?\s+funciones|funciones/i.test(lower)) {
    return { key: "funciones", title: cleanTitle };
  }
  // 3. mejoras
  if (/mejoras?/i.test(lower)) {
    return { key: "mejoras", title: cleanTitle };
  }

  // 4. Fallback canónico: cualquier otro encabezado clasifica como "otras"
  return { key: "otras", title: cleanTitle };
}

/**
 * Parsea el contenido markdown ya deduplicado en bloques de secciones.
 */
export function parseSectionsFromMarkdown(content: string): ChangelogSection[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const sections: ChangelogSection[] = [];

  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (/^#{2,4}\s+/.test(line)) {
      if (currentHeading || currentLines.some((l) => l.trim().length > 0)) {
        const body = currentLines.join("\n").trim();
        if (body.length > 0) {
          const { key, title } = classifySectionHeading(currentHeading || "General");
          sections.push({
            key,
            title,
            html: renderMarkdown(body),
          });
        }
      }
      currentHeading = line;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentHeading || currentLines.some((l) => l.trim().length > 0)) {
    const body = currentLines.join("\n").trim();
    if (body.length > 0) {
      const { key, title } = classifySectionHeading(currentHeading || "General");
      sections.push({
        key,
        title,
        html: renderMarkdown(body),
      });
    }
  }

  return sections;
}

/**
 * Obtiene todas las entradas del changelog de un directorio dado (o el directorio por defecto),
 * excluyendo borradores (draft: true), ordenadas por fecha descendente y descartando
 * commits repetidos respecto a publicaciones previas (orden cronológico ascendente).
 */
export async function getChangelogEntries(
  customDir?: string,
): Promise<ChangelogEntry[]> {
  const targetDir = customDir || resolveChangelogDir();
  const cacheKey = getCacheKeyForDir(targetDir);

  if (changelogCacheByDir.has(cacheKey)) {
    return changelogCacheByDir.get(cacheKey)!;
  }

  if (!fs.existsSync(targetDir)) {
    changelogCacheByDir.set(cacheKey, []);
    return [];
  }

  let fileNames: string[];
  try {
    fileNames = await fs.promises.readdir(targetDir);
  } catch {
    changelogCacheByDir.set(cacheKey, []);
    return [];
  }

  const mdFiles = fileNames.filter((file) => file.endsWith(".md"));
  const rawEntries: {
    frontmatter: ChangelogFrontmatter;
    content: string;
    slug: string;
  }[] = [];

  for (const fileName of mdFiles) {
    try {
      const fullPath = path.join(targetDir, fileName);
      const raw = await fs.promises.readFile(fullPath, "utf-8");
      const { frontmatter, content } = parseFrontmatterAndContent(raw);

      if (frontmatter.draft) {
        continue;
      }

      const slug = path.basename(fileName, ".md");
      rawEntries.push({
        frontmatter,
        content,
        slug,
      });
    } catch {
      continue;
    }
  }

  // 1. ORDEN ASCENDENTE (de más viejo a más nuevo) para procesar deduplicación cronológica
  rawEntries.sort((a, b) => a.frontmatter.date.localeCompare(b.frontmatter.date));

  const processedAscending: ChangelogEntry[] = [];
  const globalSeenCommits = new Set<string>();

  for (const item of rawEntries) {
    const entryCommits = new Set(item.frontmatter.commits || []);
    const contentCommits = extractCommitsFromContent(item.content);
    const combinedCommits = new Set([
      ...entryCommits,
      ...contentCommits,
    ]);

    const cleanedContent = deduplicateContentLines(
      item.content,
      entryCommits,
      globalSeenCommits,
    );

    const uniqueEntryCommits: string[] = [];
    for (const c of combinedCommits) {
      if (!globalSeenCommits.has(c)) {
        uniqueEntryCommits.push(c);
        globalSeenCommits.add(c);
      }
    }

    if (!cleanedContent.trim()) {
      continue;
    }

    const sections = parseSectionsFromMarkdown(cleanedContent);
    // Si no quedaron secciones sustanciales, descartar
    if (sections.length === 0) {
      continue;
    }

    const html = renderMarkdown(cleanedContent);

    processedAscending.push({
      ...item.frontmatter,
      commits: uniqueEntryCommits,
      slug: item.slug,
      content: cleanedContent,
      html,
      sections,
    });
  }

  // 2. ORDEN DESCENDENTE FINAL para la UI y consumidores (más reciente primero)
  processedAscending.sort((a, b) => b.date.localeCompare(a.date));

  changelogCacheByDir.set(cacheKey, processedAscending);
  return processedAscending;
}

/**
 * Devuelve la fecha ISO (YYYY-MM-DD) del changelog más reciente o null si no hay entradas.
 */
export async function getLatestChangelogDate(
  customDir?: string,
): Promise<string | null> {
  const entries = await getChangelogEntries(customDir);
  if (!entries || entries.length === 0) {
    return null;
  }
  return entries[0].date;
}

/**
 * Limpia el cache en memoria para propósitos de testing o recarga forzada.
 */
export function clearChangelogCache(): void {
  changelogCacheByDir.clear();
}
