import type { APIRoute } from "astro";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleCategory } from "@/db/schema";

/** Escapa un campo para CSV (comillas dobles, se duplican). */
function csvField(value: string | null | undefined): string {
  const text = (value ?? "").toString();
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Exporta todos los títulos a CSV: Título, Categoría, Ruta, Descripción.
 * UTF-8 con BOM y CRLF para compatibilidad con Excel. Público (igual que la
 * vista /titulos): exportar no expone datos sensibles.
 */
export const GET: APIRoute = async () => {
  const rows = await db
    .select({
      name: titles.name,
      category: titleCategory.name,
      route: titles.route,
      description: titles.description,
    })
    .from(titles)
    .leftJoin(titleCategory, eq(titles.categoryId, titleCategory.id))
    .orderBy(asc(titles.name));

  const lines = ["Título,Categoría,Ruta,Descripción"];
  for (const row of rows) {
    lines.push(
      [
        csvField(row.name),
        csvField(row.category),
        csvField(row.route),
        csvField(row.description),
      ].join(","),
    );
  }

  const body = "\uFEFF" + lines.join("\r\n");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="titulos.csv"',
      "Cache-Control": "no-store",
    },
  });
};
