import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let cachedRubricsMap: Map<string, string> | null = null;

/**
 * Resuelve la ruta absoluta del archivo de rúbricas independientemente
 * de si se ejecuta desde src/lib/ai o desde un script compilado/empaquetado.
 */
function getRubricsFilePath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  // Si estamos en src/lib/ai, el config está en ../../config/ai/rubricas-calidad.md
  const candidates = [
    path.resolve(currentDir, "../../config/ai/rubricas-calidad.md"),
    path.resolve(process.cwd(), "src/config/ai/rubricas-calidad.md"),
    path.resolve(process.cwd(), "dist/config/ai/rubricas-calidad.md"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback default
  return path.resolve(process.cwd(), "src/config/ai/rubricas-calidad.md");
}

/**
 * Parsea el archivo Markdown maestro y extrae un mapa de { [criterioCode]: contenidoMarkdown }
 */
export function parseRubricsMap(): Map<string, string> {
  if (cachedRubricsMap) {
    return cachedRubricsMap;
  }

  const map = new Map<string, string>();
  const filePath = getRubricsFilePath();

  if (!fs.existsSync(filePath)) {
    console.warn(`[rubricsLoader] No se encontró el archivo de rúbricas en: ${filePath}`);
    cachedRubricsMap = map;
    return map;
  }

  const rawContent = fs.readFileSync(filePath, "utf-8");
  // Dividir por bloques que comiencen con ## criterio: <codigo>
  const sections = rawContent.split(/\n(?=## criterio:\s*)/);

  for (const section of sections) {
    const match = section.match(/^## criterio:\s*([a-zA-Z0-9_-]+)/);
    if (match) {
      const code = match[1].trim();
      // Guardar el bloque recortado y formateado
      map.set(code, section.trim());
    }
  }

  cachedRubricsMap = map;
  return map;
}

/**
 * Obtiene las rúbricas formateadas solo para la lista de códigos de criterios proporcionada.
 * Si un código no existe en el Markdown, se omite silenciosamente.
 */
export function getRubricsForCriteria(codes: string[]): string {
  if (!codes || codes.length === 0) {
    return "";
  }

  const map = parseRubricsMap();
  const matchedSections: string[] = [];

  for (const code of codes) {
    const section = map.get(code);
    if (section) {
      matchedSections.push(section);
    }
  }

  return matchedSections.join("\n\n---\n\n");
}
