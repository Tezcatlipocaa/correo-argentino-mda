import type { APIRoute } from "astro";
import { requireReadAccess } from "@lib/rbac-middleware";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { searchKbArticles, kbArticleUrl } from "@lib/invgate/kb";

export interface CategoryNodeDetailsResponse {
  id: number;
  name: string;
  kbArticles: Array<{ id: number; title: string; url: string }>;
  invgateStatus: {
    existsInCatalog: boolean;
    catalogId?: number;
  };
}

export const GET: APIRoute = async ({ request, locals }) => {
  const denied = await requireReadAccess(locals, "reportes");
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const rawId = url.searchParams.get("id");
    const parsedId = rawId ? parseInt(rawId, 10) : 0;
    const id = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : 0;
    const name = url.searchParams.get("name") || "";
    const cleanName = name.trim();

    let kbArticles: Array<{ id: number; title: string; url: string }> = [];
    if (cleanName) {
      try {
        const kbRes = await searchKbArticles(cleanName, 3);
        if (kbRes.ok && Array.isArray(kbRes.data)) {
          kbArticles = kbRes.data.map((art) => ({
            id: art.id,
            title: art.title,
            url: kbArticleUrl(art.id),
          }));
        }
      } catch {
        kbArticles = [];
      }
    }

    const response: CategoryNodeDetailsResponse = {
      id,
      name,
      kbArticles,
      invgateStatus: {
        existsInCatalog: id > 0,
        catalogId: id > 0 ? id : undefined,
      },
    };

    return jsonResponse(response);
  } catch (error) {
    return jsonError(sanitizeError(error), 500);
  }
};
