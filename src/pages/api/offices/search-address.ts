import type { APIRoute } from "astro";
import { findOfficeAddressMatches } from "@lib/officeQueries";
import { normalizeOfficeAddress } from "@lib/officeAddress";
import { jsonResponse } from "@lib/apiResponse";

const MAX_SUGGESTIONS = 6;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user || locals.user.id === 0) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  const query = url.searchParams.get("q") ?? "";
  if (query.trim().length < 3) return jsonResponse([]);

  const excludeIdValue = url.searchParams.get("excludeId");
  const excludeId = excludeIdValue ? Number(excludeIdValue) : undefined;
  const provinceCode = url.searchParams.get("provinceCode") || undefined;

  try {
    const matches = await findOfficeAddressMatches({
      address: query,
      provinceCode,
      excludeId: Number.isInteger(excludeId) ? excludeId : undefined,
      partial: true,
    });
    const normalizedQuery = normalizeOfficeAddress(query) ?? "";
    const grouped = new Map<string, { address: string; offices: typeof matches }>();

    for (const match of matches) {
      const item = grouped.get(match.address) ?? { address: match.address, offices: [] };
      item.offices.push(match);
      grouped.set(match.address, item);
    }

    const result = [...grouped.values()]
      .sort((a, b) => {
        const aStarts = a.address.startsWith(normalizedQuery) ? 0 : 1;
        const bStarts = b.address.startsWith(normalizedQuery) ? 0 : 1;
        return aStarts - bStarts || a.address.localeCompare(b.address, "es-AR");
      })
      .slice(0, MAX_SUGGESTIONS)
      .map(({ address, offices }) => ({
        address,
        offices: offices.map(({ code, name, provinceName, regionName }) => ({
          code,
          name,
          provinceName,
          regionName,
        })),
      }));

    return jsonResponse(result);
  } catch (error) {
    console.error("Error en search-address API:", error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
};
