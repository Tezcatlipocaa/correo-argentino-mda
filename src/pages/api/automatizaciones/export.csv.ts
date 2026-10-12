import type { APIRoute } from "astro";
import { jsonError, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import {
  listAutomationParentsForExport,
  parseAutomationParentsQuery,
} from "@lib/workflow/parent-history";

/**
 * Export CSV del listado de automatizaciones. Respeta los mismos filtros que la
 * vista (q, status, region, age, order).
 */
const HEADERS = [
  "Código",
  "Sucursal",
  "Código sucursal",
  "Nombre sucursal",
  "Región",
  "Localidad",
  "Estado",
  "Progreso",
  "Mesa",
  "Iniciada",
  "Actualizada",
  "Finalizada",
];

const escapeCsv = (value: unknown): string =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

function toIso(epochSeconds: number | null | undefined): string {
  if (typeof epochSeconds !== "number") return "";
  return new Date(epochSeconds * 1000).toISOString();
}

export const GET: APIRoute = async ({ url, locals }) => {
  const denied = await requireReadAccess(locals, "automatizaciones");
  if (denied) return denied;

  try {
    const query = parseAutomationParentsQuery(url.searchParams);
    const items = listAutomationParentsForExport(query);

    const rows = items.map((item) => [
      item.prettyId,
      item.displayName,
      item.branchCode ?? "",
      item.branchName ?? "",
      item.region ?? "",
      item.locality ?? "",
      item.isActive ? "En curso" : "Finalizada",
      typeof item.progressPercent === "number" ? `${item.progressPercent}%` : "",
      item.assignedGroupName ?? "",
      toIso(item.createdAt),
      toIso(item.updatedAt),
      toIso(item.closedAt),
    ]);

    const csv = [HEADERS, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const date = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="automatizaciones_${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[API automatizaciones/export.csv] Error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
