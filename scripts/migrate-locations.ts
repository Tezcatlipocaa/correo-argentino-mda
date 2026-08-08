// scripts/migrate-locations.ts
import "dotenv/config";
import { invgateGet } from "../src/lib/invgateClient";
import { invgateQaPost } from "../src/lib/invgate-qa-client";
import type { InvgateLocation } from "../src/types/invgate";

interface LocationNode {
  prodId: number;
  name: string;
  prodParentId: number | null;
  children: LocationNode[];
}

interface MigrationResult {
  created: number;
  skipped: number;
  errors: { name: string; reason: string }[];
  idMap: Map<number, number>;
}

function buildTree(flatList: InvgateLocation[]): LocationNode[] {
  const nodeMap = new Map<number, LocationNode>();

  for (const loc of flatList) {
    nodeMap.set(loc.id, {
      prodId: loc.id,
      name: loc.name,
      prodParentId: loc.parent_id,
      children: [],
    });
  }

  const roots: LocationNode[] = [];

  for (const loc of flatList) {
    const node = nodeMap.get(loc.id)!;
    if (loc.parent_id === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(loc.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

function flattenTopological(roots: LocationNode[]): LocationNode[] {
  const result: LocationNode[] = [];
  const queue = [...roots];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    queue.push(...node.children);
  }
  return result;
}
