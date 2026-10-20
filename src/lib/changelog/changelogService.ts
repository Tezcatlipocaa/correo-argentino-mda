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
      },
      content: match[2].trim(),
    };
  } catch {
    return {
      frontmatter: {
        title: "Actualización",
        date: "1970-01-01",
      },
      content: match[2].trim(),
    };
  }
}

/**
 * Obtiene todas las entradas del changelog de un directorio dado (o el directorio por defecto),
 * excluyendo borradores (draft: true) y ordenadas por fecha descendente.
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
  const entries: ChangelogEntry[] = [];

  for (const fileName of mdFiles) {
    try {
      const fullPath = path.join(targetDir, fileName);
      const raw = await fs.promises.readFile(fullPath, "utf-8");
      const { frontmatter, content } = parseFrontmatterAndContent(raw);

      if (frontmatter.draft) {
        continue;
      }

      const slug = path.basename(fileName, ".md");
      const html = renderMarkdown(content);

      entries.push({
        ...frontmatter,
        slug,
        content,
        html,
      });
    } catch {
      // Si un archivo particular no puede ser leído o parseado, se continúa con el resto
      continue;
    }
  }

  // Ordenar de forma descendente por fecha (más reciente primero)
  entries.sort((a, b) => b.date.localeCompare(a.date));

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
