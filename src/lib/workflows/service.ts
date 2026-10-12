import type { WorkflowReportData } from "@/types/workflows";
import { getWorkflowConfig } from "./registry";
import { computeWorkflowOverview } from "./metrics-engine";
import { IMPLEMENTACION_FIXTURE } from "./fixtures/implementacion";

export const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry {
  data: WorkflowReportData;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getWorkflowReport(
  slug = "implementacion",
): Promise<WorkflowReportData> {
  const now = Date.now();
  const cached = cache.get(slug);

  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  const config = getWorkflowConfig(slug);
  if (!config) {
    throw new Error(`Workflow no encontrado: ${slug}`);
  }

  const instances =
    slug === "implementacion" ? [...IMPLEMENTACION_FIXTURE] : [];
  const overview = computeWorkflowOverview(instances);

  const report: WorkflowReportData = {
    config,
    overview,
    instances,
    cachedAt: new Date(now).toISOString(),
  };

  cache.set(slug, {
    data: report,
    expiresAt: now + CACHE_TTL_MS,
  });

  return report;
}

export function invalidateWorkflowCache(slug?: string): void {
  if (slug) {
    cache.delete(slug);
  } else {
    cache.clear();
  }
}
