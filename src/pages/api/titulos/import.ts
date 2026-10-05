import type { APIRoute } from "astro";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleCategory } from "@/db/schema";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { formatTitleName } from "@/lib/titleFormat";
import { logAdminFromAstro } from "@lib/auditLogger";

interface CsvRow {
  Título?: string;
  "Titulo"?: string;
  name?: string;
  Categoría?: string;
  "Categoria"?: string;
  category?: string;
  Ruta?: string;
  route?: string;
  Descripción?: string;
  "Descripcion"?: string;
  description?: string;
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

/**
 * Importa títulos desde CSV (columnas Título, Categoría, Ruta, Descripción).
 * Upsert por nombre de título; la categoría debe existir (si no, error de fila).
 * Requiere permiso de escritura.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const denied = await requireWriteAccess(locals, "titulos");
  if (denied) return denied;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("Adjuntá un archivo CSV", 400);
    }

    const text = await file.text();
    let rows: Record<string, string>[];
    try {
      rows = parse(text, {
        columns: (header: string[]) =>
          header.map((h) => h.replace(/^\uFEFF/, "").trim()),
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Record<string, string>[];
    } catch {
      return jsonError("No se pudo parsear el CSV", 400);
    }

    const categories = await db
      .select({ id: titleCategory.id, name: titleCategory.name })
      .from(titleCategory);
    const categoryMap = new Map(
      categories.map((c) => [c.name.toLowerCase(), c.id]),
    );

    const existing = await db
      .select({ id: titles.id, name: titles.name })
      .from(titles);
    const existingMap = new Map(
      existing.map((t) => [t.name.toLowerCase(), t.id]),
    );

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as CsvRow & Record<string, string>;
      const lineNo = i + 2;
      const rawName = pick(row, ["Título", "Titulo", "name"]);
      const rawCategory = pick(row, ["Categoría", "Categoria", "category"]);
      const route = pick(row, ["Ruta", "route"]) || null;
      const description = pick(row, ["Descripción", "Descripcion", "description"]) || null;

      if (!rawName) {
        errors.push(`Fila ${lineNo}: sin título`);
        continue;
      }
      if (!rawCategory) {
        errors.push(`Fila ${lineNo} (${rawName}): sin categoría`);
        continue;
      }
      const categoryId = categoryMap.get(rawCategory.toLowerCase());
      if (!categoryId) {
        errors.push(
          `Fila ${lineNo} (${rawName}): la categoría "${rawCategory}" no existe`,
        );
        continue;
      }

      const name = formatTitleName(rawName);
      const existingId = existingMap.get(name.toLowerCase());
      try {
        if (existingId !== undefined) {
          await db
            .update(titles)
            .set({ categoryId, route, description, updatedAt: new Date() })
            .where(eq(titles.id, existingId));
          updated++;
        } else {
          await db.insert(titles).values({
            name,
            categoryId,
            route,
            description,
            articleOnKdb: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          existingMap.set(name.toLowerCase(), -1);
          created++;
        }
      } catch {
        errors.push(`Fila ${lineNo} (${rawName}): no se pudo guardar`);
      }
    }

    await logAdminFromAstro(
      locals,
      `Importó títulos desde CSV: ${created} creados, ${updated} actualizados, ${errors.length} con error`,
    );

    return jsonResponse({ created, updated, errors }, 200, "no-store");
  } catch (error) {
    console.error("[API titulos/import] Error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
