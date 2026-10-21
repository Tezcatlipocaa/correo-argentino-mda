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
    return rawCommits.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof rawCommits === "string") {
    return [rawCommits.trim()].filter(Boolean);
  }
  return [];
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
        date: String(parsedYaml.date || "1970-01-01"),
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
 * Filtra líneas de commits duplicados dentro del contenido markdown si dichos
 * IDs ya fueron procesados en un changelog más reciente.
 */
function deduplicateContentLines(content: string, seenCommits: Set<string>): string {
  if (seenCommits.size === 0) return content;

  const lines = content.split("\n");
  const filteredLines: string[] = [];

  for (const line of lines) {
    // Detectar si la viñeta referencia un commit [id] o [`id`]
    const commitMatch = line.match(/\[`?([a-f0-9]{7,40})`?\]/i);
    if (commitMatch) {
      const commitId = commitMatch[1].toLowerCase();
      // Si el commit ya fue visto en un release más reciente, se descarta la línea repetida
      if (seenCommits.has(commitId)) {
        continue;
      }
    }
    filteredLines.push(line);
  }

  return filteredLines.join("\n");
}

/**
 * Obtiene todas las entradas del changelog de un directorio dado (o el directorio por defecto),
 * excluyendo borradores (draft: true), ordenadas por fecha descendente y descartando
 * commits repetidos entre releases.
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

  // Ordenar de forma descendente por fecha (el más reciente primero)
  rawEntries.sort((a, b) => b.frontmatter.date.localeCompare(a.frontmatter.date));

  const entries: ChangelogEntry[] = [];
  const globalSeenCommits = new Set<string>();

  for (const item of rawEntries) {
    const entryCommits = item.frontmatter.commits || [];

    // Primero filtramos el contenido con los commits ya vistos en releases más recientes
    const cleanedContent = deduplicateContentLines(item.content, globalSeenCommits);
    const html = renderMarkdown(cleanedContent);

    // Luego determinamos cuáles commits de este entry son únicos y los incorporamos al Set
    const uniqueEntryCommits: string[] = [];
    for (const c of entryCommits) {
      const normalized = c.toLowerCase();
      if (!globalSeenCommits.has(normalized)) {
        uniqueEntryCommits.push(c);
        globalSeenCommits.add(normalized);
      }
    }

    entries.push({
      ...item.frontmatter,
      commits: uniqueEntryCommits,
      slug: item.slug,
      content: cleanedContent,
      html,
    });
  }

  changelogCacheByDir.set(targetDir, entries);
  return entries;
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
