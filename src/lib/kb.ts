import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@db/index";
import { kbArticles, mesas, users } from "@db/schema";

export type KbArticleStatus = "draft" | "published" | "archived";

export type KbScope = {
  helpdeskId: number | null;
  includeAll: boolean;
};

export type KbArticle = typeof kbArticles.$inferSelect & {
  mesaName: string | null;
  authorName: string | null;
};

export type KbArticleListItem = Omit<KbArticle, "content">;

const articleSelection = {
  id: kbArticles.id,
  helpdeskId: kbArticles.helpdeskId,
  title: kbArticles.title,
  content: kbArticles.content,
  category: kbArticles.category,
  status: kbArticles.status,
  authorUserId: kbArticles.authorUserId,
  publishedByUserId: kbArticles.publishedByUserId,
  publishedAt: kbArticles.publishedAt,
  createdAt: kbArticles.createdAt,
  updatedAt: kbArticles.updatedAt,
  mesaName: mesas.name,
  authorName: users.username,
};

const articleListSelection = {
  id: kbArticles.id,
  helpdeskId: kbArticles.helpdeskId,
  title: kbArticles.title,
  category: kbArticles.category,
  status: kbArticles.status,
  authorUserId: kbArticles.authorUserId,
  publishedByUserId: kbArticles.publishedByUserId,
  publishedAt: kbArticles.publishedAt,
  createdAt: kbArticles.createdAt,
  updatedAt: kbArticles.updatedAt,
  mesaName: mesas.name,
  authorName: users.username,
};

function articleWhere(conditions: SQL[]): SQL | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function scopedArticleConditions(id: number, scope: KbScope): SQL[] | null {
  if (!scope.includeAll && scope.helpdeskId === null) {
    return null;
  }

  const conditions: SQL[] = [eq(kbArticles.id, id)];
  if (!scope.includeAll) {
    conditions.push(eq(kbArticles.helpdeskId, scope.helpdeskId as number));
  }

  return conditions;
}

type KbArticlePatch = {
  title?: string;
  content?: string;
  category?: string | null;
};

function buildArticlePatchValues(patch: KbArticlePatch) {
  return {
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.content === undefined ? {} : { content: patch.content }),
    ...(patch.category === undefined ? {} : { category: patch.category }),
  };
}

export function listArticles(opts: {
  helpdeskId: number | null;
  includeAll: boolean;
  includeUnpublished: boolean;
  limit?: number;
  offset?: number;
}): KbArticleListItem[] {
  const conditions: SQL[] = [];

  if (!opts.includeAll) {
    if (opts.helpdeskId === null) {
      return [];
    }
    conditions.push(eq(kbArticles.helpdeskId, opts.helpdeskId));
  }

  if (!opts.includeUnpublished) {
    conditions.push(eq(kbArticles.status, "published"));
  }

  const requestedLimit = opts.limit ?? 100;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(500, Math.max(1, Math.trunc(requestedLimit)))
    : 100;
  const offset = opts.offset ?? 0;

  return db
    .select(articleListSelection)
    .from(kbArticles)
    .leftJoin(mesas, eq(mesas.invgateId, kbArticles.helpdeskId))
    .leftJoin(users, eq(users.id, kbArticles.authorUserId))
    .where(articleWhere(conditions))
    .orderBy(desc(kbArticles.updatedAt), desc(kbArticles.id))
    .limit(limit)
    .offset(offset)
    .all();
}

export function getArticle(id: number, scope: KbScope): KbArticle | null {
  const conditions = scopedArticleConditions(id, scope);
  if (conditions === null) {
    return null;
  }

  const [article] = db
    .select(articleSelection)
    .from(kbArticles)
    .leftJoin(mesas, eq(mesas.invgateId, kbArticles.helpdeskId))
    .leftJoin(users, eq(users.id, kbArticles.authorUserId))
    .where(articleWhere(conditions))
    .limit(1)
    .all();

  return article ?? null;
}

export function createArticle(input: {
  helpdeskId: number;
  title: string;
  content: string;
  category?: string | null;
  status: KbArticleStatus;
  authorUserId: number;
  publishedByUserId?: number | null;
}): number | null {
  if (!Number.isInteger(input.helpdeskId) || input.helpdeskId <= 0) {
    return null;
  }

  const published = input.status === "published";
  const [article] = db
    .insert(kbArticles)
    .values({
      helpdeskId: input.helpdeskId,
      title: input.title,
      content: input.content,
      category: input.category ?? null,
      status: input.status,
      authorUserId: input.authorUserId,
      publishedByUserId: published
        ? (input.publishedByUserId ?? input.authorUserId)
        : null,
      publishedAt: published ? new Date() : null,
    })
    .returning({ id: kbArticles.id })
    .all();

  return article?.id ?? null;
}

export function updateArticle(
  id: number,
  patch: KbArticlePatch,
  scope: KbScope,
): boolean {
  const conditions = scopedArticleConditions(id, scope);
  if (conditions === null) {
    return false;
  }

  const values = buildArticlePatchValues(patch);

  if (Object.keys(values).length === 0) {
    return false;
  }

  const result = db
    .update(kbArticles)
    .set(values)
    .where(articleWhere(conditions))
    .run();

  return result.changes > 0;
}

export function updateArticleAndTransition(
  id: number,
  patch: { title?: string; content?: string; category?: string | null },
  targetStatus: KbArticleStatus,
  publishedByUserId: number,
  scope: KbScope,
):
  | { ok: true; statusChanged: boolean; status: KbArticleStatus }
  | { ok: false; reason: "not_found" | "invalid_transition" } {
  return db.transaction((tx) => {
    const conditions = scopedArticleConditions(id, scope);
    if (conditions === null) {
      return { ok: false as const, reason: "not_found" as const };
    }

    const [current] = tx
      .select({
        status: kbArticles.status,
        publishedAt: kbArticles.publishedAt,
        publishedByUserId: kbArticles.publishedByUserId,
      })
      .from(kbArticles)
      .where(articleWhere(conditions))
      .limit(1)
      .all();

    if (!current) {
      return { ok: false as const, reason: "not_found" as const };
    }

    if (targetStatus === "draft" && current.status !== "draft") {
      return { ok: false as const, reason: "invalid_transition" as const };
    }

    const statusChanged = current.status !== targetStatus;
    const shouldWritePublicationMetadata =
      targetStatus === "published" &&
      (current.status !== "published" ||
        current.publishedAt === null ||
        current.publishedByUserId === null);
    const statusValues =
      targetStatus === "published"
        ? shouldWritePublicationMetadata
          ? {
              status: "published" as const,
              publishedAt: new Date(),
              publishedByUserId,
            }
          : { status: "published" as const }
        : targetStatus === "archived"
          ? { status: "archived" as const }
          : {};
    const values = {
      ...buildArticlePatchValues(patch),
      ...statusValues,
    };

    if (Object.keys(values).length > 0) {
      tx.update(kbArticles).set(values).where(articleWhere(conditions)).run();
    }

    return { ok: true as const, statusChanged, status: targetStatus };
  });
}

export function publishArticle(
  id: number,
  publishedByUserId: number,
  scope: KbScope,
): boolean {
  const conditions = scopedArticleConditions(id, scope);
  if (conditions === null) {
    return false;
  }

  const result = db
    .update(kbArticles)
    .set({
      status: "published",
      publishedAt: new Date(),
      publishedByUserId,
    })
    .where(articleWhere(conditions))
    .run();

  return result.changes > 0;
}

export function archiveArticle(id: number, scope: KbScope): boolean {
  const conditions = scopedArticleConditions(id, scope);
  if (conditions === null) {
    return false;
  }

  const result = db
    .update(kbArticles)
    .set({ status: "archived" })
    .where(articleWhere(conditions))
    .run();

  return result.changes > 0;
}
