import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { renderMarkdown } from "../markdown.js";

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
}

const changelogCacheByDir = new Map<string, ChangelogEntry[]>();

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
 * 1) pertenece a entryCommits (commits declarados o descubiertos de esta entrada)
 * 2) y YA fue visto en un release previo (seenCommits).
 */
function deduplicateContentLines(
  content: string,
  entryCommits: Set<string>,
  seenCommits: Set<string>,
): string {
  if (seenCommits.size === 0) return content;

  const lines = content.split("\n");
  const filteredLines: string[] = [];

  for (const line of lines) {
    // Detectar si la viñeta referencia un commit [id] o [`id`]
    const commitMatch = line.match(/\[`?([a-f0-9]{7,40})`?\]/i);
    if (commitMatch) {
      const commitId = commitMatch[1].toLowerCase();
      // Solo descartar si el commit pertenece a esta entrada y ya fue publicado en una release previa
      if (entryCommits.has(commitId) && seenCommits.has(commitId)) {
        continue;
      }
    }
    filteredLines.push(line);
  }

  // Si tras descartar viñetas solo quedan encabezados vacíos o líneas en blanco, limpiar
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
 * Obtiene todas las entradas del changelog de un directorio dado (o el directorio por defecto),
 * excluyendo borradores (draft: true), ordenadas por fecha descendente y descartando
 * commits repetidos respecto a publicaciones previas (orden cronológico ascendente).
 */
export async function getChangelogEntries(
  customDir?: string,
): Promise<ChangelogEntry[]> {
  const targetDir = customDir || resolveChangelogDir();

  if (changelogCacheByDir.has(targetDir)) {
    return changelogCacheByDir.get(targetDir)!;
  }

  if (!fs.existsSync(targetDir)) {
    changelogCacheByDir.set(targetDir, []);
    return [];
  }

  let fileNames: string[];
  try {
    fileNames = await fs.promises.readdir(targetDir);
  } catch {
    changelogCacheByDir.set(targetDir, []);
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
    // Sembrar commits conocidos tanto de frontmatter como del contenido
    const contentCommits = extractCommitsFromContent(item.content);
    const combinedCommits = new Set([
      ...(item.frontmatter.commits || []),
      ...contentCommits,
    ]);

    // Filtrar líneas de contenido si contienen commits que YA fueron publicados previamente
    const cleanedContent = deduplicateContentLines(
      item.content,
      combinedCommits,
      globalSeenCommits,
    );

    // Calcular commits únicos para esta entrada que aún no se habían publicado
    const uniqueEntryCommits: string[] = [];
    for (const c of combinedCommits) {
      if (!globalSeenCommits.has(c)) {
        uniqueEntryCommits.push(c);
        globalSeenCommits.add(c);
      }
    }

    // Regla: si tras la deduplicación no queda contenido sustancial, descartar la release vacía
    if (!cleanedContent.trim()) {
      continue;
    }

    const html = renderMarkdown(cleanedContent);

    processedAscending.push({
      ...item.frontmatter,
      commits: uniqueEntryCommits,
      slug: item.slug,
      content: cleanedContent,
      html,
    });
  }

  // 2. ORDEN DESCENDENTE FINAL para la UI y consumidores (más reciente primero)
  processedAscending.sort((a, b) => b.date.localeCompare(a.date));

  changelogCacheByDir.set(targetDir, processedAscending);
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
