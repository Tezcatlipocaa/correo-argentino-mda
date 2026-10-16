import { db, getSqliteDataVersion } from "@/db";
import { feedback } from "@/db/schema";
import { and, eq, isNull, count } from "drizzle-orm";

const FEEDBACK_CACHE_TTL_MS = 10_000;

let cachedCount: number | null = null;
let cachedAt = 0;
let lastDataVersion = -1;

export function invalidateFeedbackCountCache(): void {
  cachedCount = null;
  cachedAt = 0;
}

export async function getUnassignedFeedbackCount(): Promise<number> {
  const currentVersion = getSqliteDataVersion();
  const now = Date.now();
  if (
    cachedCount !== null &&
    currentVersion === lastDataVersion &&
    now - cachedAt < FEEDBACK_CACHE_TTL_MS
  ) {
    return cachedCount;
  }

  const result = await db
    .select({ value: count() })
    .from(feedback)
    .where(
      and(isNull(feedback.assignedToId), eq(feedback.status, "pendiente")),
    );
  const value = result[0]?.value ?? 0;
  cachedCount = value;
  cachedAt = now;
  lastDataVersion = currentVersion;
  return value;
}
