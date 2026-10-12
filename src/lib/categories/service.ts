import type {
  CategoryNode,
  CategoryNodeAnomaly,
  CategoryNodeStatus,
  RawCategoryItem,
} from "@/types/categories";
import { computeTreeMetrics, type TreeMetricsResult } from "./metrics-engine";
import {
  MDA_TI_ARBOL_ACTUAL,
  type MdaTreeNode,
} from "./fixtures/mda-ti-canonical";
import {
  readPersistedCache,
  writePersistedCache,
  deletePersistedCache,
} from "@/lib/invgate/cache";

export interface CategoryCatalogReport {
  tree: CategoryNode;
  metrics: TreeMetricsResult;
  cachedAt: string;
}

export const MESA_TI_RAW_FIXTURE: RawCategoryItem[] = [
  { id: 1, name: "TI Mesa de Ayuda", parentId: null, totalTickets: 12076 },
  { id: 10, name: "Sistemas Postales", parentId: 1, totalTickets: 5400 },
  { id: 101, name: "Mosaic", parentId: 10, totalTickets: 3200 },
  { id: 1011, name: "Reimpresión", parentId: 101, totalTickets: 567 },
  { id: 1012, name: "Consulta", parentId: 101, totalTickets: 779 },
  { id: 102, name: "TYT", parentId: 10, totalTickets: 1800 },
  { id: 1021, name: "Consulta", parentId: 102, totalTickets: 509 },
  { id: 1022, name: "Re direccionamiento", parentId: 102, totalTickets: 267 },
  { id: 20, name: "Hardware y Puestos", parentId: 1, totalTickets: 2500 },
  { id: 201, name: "PC", parentId: 20, totalTickets: 1200 },
  { id: 202, name: "Impresora Láser", parentId: 20, totalTickets: 1300 },
  { id: 30, name: "Comunicaciones y Redes", parentId: 1, totalTickets: 1500 },
  { id: 40, name: "Ramas Obsoletas", parentId: 1, totalTickets: 0 },
  { id: 401, name: "Sistema Giros Legacy", parentId: 40, totalTickets: 0 },
];

export const CACHE_TTL_MS = 30 * 60 * 1000;
export const PERSISTED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const PERSISTED_CACHE_KEY = "categories.mda_ti_tree";

interface CacheEntry {
  report: CategoryCatalogReport;
  expiresAt: number;
}

const reportCache = new Map<string, CacheEntry>();

const WILDCARD_NAMES = new Set(["consulta", "otro", "otros"]);

function resolveStatus(
  totalTickets: number,
  isLeaf: boolean,
): CategoryNodeStatus {
  if (totalTickets === 0) {
    return isLeaf ? "dead" : "zero";
  }
  if (totalTickets >= 200) {
    return "hot";
  }
  return "normal";
}

export function convertMdaTreeNodeToCategoryNode(
  mdaNode: MdaTreeNode,
  parentPath: string | null = null,
  parentId: number | null = null,
  depth = 1,
): CategoryNode {
  const name = mdaNode.name;
  const currentPath = parentPath ? `${parentPath} » ${name}` : name;
  const rawChildren = mdaNode.children || [];
  const isLeaf = rawChildren.length === 0;

  const numericId =
    typeof mdaNode.id === "number"
      ? mdaNode.id
      : typeof mdaNode.id === "string" && !isNaN(Number(mdaNode.id))
        ? Number(mdaNode.id)
        : 0;

  const children: CategoryNode[] = rawChildren.map((child) =>
    convertMdaTreeNodeToCategoryNode(child, currentPath, numericId, depth + 1),
  );

  const anomalies: CategoryNodeAnomaly[] = [];
  if (!isLeaf && children.length === 1) {
    anomalies.push("single_child");
  }
  if (WILDCARD_NAMES.has(name.trim().toLowerCase())) {
    anomalies.push("wildcard_name");
  }

  const totalTickets = mdaNode.tickets ?? mdaNode.v ?? 0;
  const status = resolveStatus(totalTickets, isLeaf);

  return {
    id: numericId,
    parentId,
    name,
    totalTickets,
    ticketCount: totalTickets,
    path: currentPath,
    depth,
    isLeaf,
    status,
    anomalies,
    children,
  };
}

function findMdaSubtree(node: MdaTreeNode, targetId: number): MdaTreeNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children || []) {
    const found = findMdaSubtree(child, targetId);
    if (found) return found;
  }
  return null;
}

export async function getCategoryCatalogReport(
  rootId = 2,
): Promise<CategoryCatalogReport> {
  const cacheKey = `categories.report.${rootId}`;
  const now = Date.now();
  const cached = reportCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.report;
  }

  const isMdaTiRoot = rootId === 2 || rootId === 1;

  if (isMdaTiRoot) {
    const persisted = readPersistedCache<CategoryCatalogReport | CategoryNode>(
      PERSISTED_CACHE_KEY,
    );
    if (persisted) {
      let report: CategoryCatalogReport;
      if ("metrics" in persisted && "tree" in persisted) {
        report = persisted;
      } else {
        const tree = persisted as CategoryNode;
        const metrics = computeTreeMetrics(tree);
        report = {
          tree,
          metrics,
          cachedAt: new Date(now).toISOString(),
        };
      }
      reportCache.set(cacheKey, {
        report,
        expiresAt: now + CACHE_TTL_MS,
      });
      return report;
    }

    const tree = convertMdaTreeNodeToCategoryNode(MDA_TI_ARBOL_ACTUAL);
    const metrics = computeTreeMetrics(tree);
    const report: CategoryCatalogReport = {
      tree,
      metrics,
      cachedAt: new Date(now).toISOString(),
    };

    reportCache.set(cacheKey, {
      report,
      expiresAt: now + CACHE_TTL_MS,
    });
    writePersistedCache(PERSISTED_CACHE_KEY, report, PERSISTED_CACHE_TTL_MS);

    return report;
  }

  const targetMdaNode = findMdaSubtree(MDA_TI_ARBOL_ACTUAL, rootId);
  if (!targetMdaNode) {
    throw new Error(`No se encontró categoría raíz con id ${rootId}`);
  }

  const tree = convertMdaTreeNodeToCategoryNode(targetMdaNode);
  const metrics = computeTreeMetrics(tree);
  const report: CategoryCatalogReport = {
    tree,
    metrics,
    cachedAt: new Date(now).toISOString(),
  };

  reportCache.set(cacheKey, {
    report,
    expiresAt: now + CACHE_TTL_MS,
  });

  return report;
}

export function invalidateCategoryCache(rootId?: number): void {
  if (rootId !== undefined) {
    reportCache.delete(`categories.report.${rootId}`);
    deletePersistedCache(`categories.report.${rootId}`);
    if (rootId === 2 || rootId === 1) {
      reportCache.delete(`categories.report.1`);
      reportCache.delete(`categories.report.2`);
      deletePersistedCache(PERSISTED_CACHE_KEY);
    }
  } else {
    reportCache.clear();
    deletePersistedCache(PERSISTED_CACHE_KEY);
  }
}

export const invalidateCategoryCatalogCache = invalidateCategoryCache;
