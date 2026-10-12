import type { APIRoute } from "astro";
import { db } from "@db/index";
import { provinces, regions } from "@db/schema";
import { jsonError, jsonResponse, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import {
  computeTerminalStats,
  MARCA_VALUES,
  OS_FILTER_VALUES,
  type MarcaFilter,
  type OsFilter,
  type TerminalStatsFilters,
} from "@lib/terminalStats";
import { getTerminalStatsRows } from "@lib/terminalQueries";

export const GET: APIRoute = async ({ url, locals }) => {
  const denied = await requireReadAccess(locals, "inventario");
  if (denied) return denied;

  const regionParam = url.searchParams.get("region");
  const provinciaParam = url.searchParams.get("provincia");
  const marcaParam = url.searchParams.get("marca");
  const osParam = url.searchParams.get("os");

  try {
    if (regionParam !== null) {
      const regionIds = (await db.select({ id: regions.id }).from(regions)).map(
        (r) => r.id,
      );
      if (!regionIds.includes(regionParam)) {
        return jsonError(`Región inválida: ${regionParam}`, 400, "no-store");
      }
    }
    if (provinciaParam !== null) {
      const provinceCodes = (
        await db.select({ code: provinces.code }).from(provinces)
      ).map((p) => p.code);
      if (!provinceCodes.includes(provinciaParam)) {
        return jsonError(
          `Provincia inválida: ${provinciaParam}`,
          400,
          "no-store",
        );
      }
    }
    if (
      marcaParam !== null &&
      !MARCA_VALUES.includes(marcaParam as MarcaFilter)
    ) {
      return jsonError(`Marca inválida: ${marcaParam}`, 400, "no-store");
    }
    if (osParam !== null && !OS_FILTER_VALUES.includes(osParam as OsFilter)) {
      return jsonError(
        `Filtro de sistema operativo inválido: ${osParam}`,
        400,
        "no-store",
      );
    }

    const filters: TerminalStatsFilters = {
      region: regionParam ?? undefined,
      provincia: provinciaParam ?? undefined,
      marca: (marcaParam as MarcaFilter | null) ?? undefined,
      os: (osParam as OsFilter | null) ?? undefined,
    };

    const rows = await getTerminalStatsRows();
    const stats = computeTerminalStats(rows, filters);

    return jsonResponse(
      {
        ...stats,
        filtros: {
          region: regionParam,
          provincia: provinciaParam,
          marca: marcaParam,
          os: osParam,
        },
      },
      200,
      "no-store",
    );
  } catch (error) {
    console.error("[API terminals/estadisticas] Error:", error);
    return jsonError(sanitizeError(error), 500, "no-store");
  }
};
