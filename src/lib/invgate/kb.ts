import { invgateGet } from "@lib/invgateClient";
import type { InvgateResult } from "@/types/invgate";

/** Artículo de la base de conocimientos de InvGate. */
export interface InvgateKbArticle {
  id: number;
  title: string;
  content?: string;
  category_id?: number;
  author_id?: number;
  [key: string]: unknown;
}

/** Envelope validado: `{ status, data: [...] }` (NO array plano). */
interface InvgateKbArticlesResponse {
  status: "OK" | "ERROR";
  info?: string;
  data: InvgateKbArticle[];
}

/**
 * Busca artículos de la KB por palabras clave. Devuelve [] ante cualquier
 * error (nunca lanza): el enriquecimiento degrada a "sin artículo".
 */
export async function searchKbArticles(
  keywords: string,
  pageSize = 20,
): Promise<InvgateResult<InvgateKbArticle[]>> {
  const term = keywords.trim();
  if (term.length === 0) {
    return { ok: true, status: 200, data: [] };
  }

  const search = new URLSearchParams({
    keywords: term,
    page: "1",
    page_size: String(pageSize),
  });

  const result = await invgateGet<InvgateKbArticlesResponse>(
    `kb.articles.by.keywords?${search.toString()}`,
  );

  if (!result.ok) {
    return result;
  }

  const articles = Array.isArray(result.data?.data) ? result.data.data : [];
  return { ok: true, status: result.status, data: articles };
}

/**
 * URL pública (front de InvGate) de un artículo de KB a partir de la base de
 * la API. `INVGATE_BASE_URL` puede pasar como prop desde el server (build-time)
 * o leerse de `process.env`.
 */
export function kbArticleUrlFromBase(
  baseUrl: string | undefined,
  articleId: number | string,
): string {
  const base = (baseUrl ?? "")
    .replace(/\/api\/v1\/?$/, "")
    .replace(/\/+$/, "");
  return `${base}/knowledgebase_articles/show/index/article_id/${articleId}`;
}

export function kbArticleUrl(articleId: number | string): string {
  const base =
    (import.meta.env?.INVGATE_BASE_URL as string | undefined) ||
    process.env.INVGATE_BASE_URL ||
    "";
  return kbArticleUrlFromBase(base, articleId);
}
