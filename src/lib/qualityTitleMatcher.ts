import { db } from "@/db";
import { titles } from "@/db/schema";
import { asc } from "drizzle-orm";

export {
  type TitleMatchResult,
  normalizeTitle,
  matchApprovedTitle,
  cleanHtmlText,
} from "./titleNormalizer";

/**
 * Obtiene la lista de nombres de títulos homologados activos desde la base de datos.
 */
export async function getApprovedTitlesList(): Promise<string[]> {
  try {
    const rows = await db
      .select({ name: titles.name })
      .from(titles)
      .orderBy(asc(titles.name));
    return rows.map((r) => r.name).filter(Boolean);
  } catch (err) {
    console.error("[qualityTitleMatcher] Error fetching approved titles:", err);
    return [];
  }
}
