import { invgateGet } from "@lib/invgateClient";
import type { InvgateResult } from "@/types/invgate";

const HELPDESKS_ENDPOINT = "helpdesks";
const HELPDESKS_LEVELS_ENDPOINT = "helpdesksandlevels";
const PAGE_SIZE = 500;
/** Guardia anti-loop: 40 páginas × 500 = 20k registros es un techo holgado. */
const MAX_PAGES = 40;

/** Shape validado en producción: array plano de helpdesks activos. */
export interface InvgateHelpdeskNode {
  id: number;
  name: string | null;
  parent_id: number | null;
  status_id: number;
  engine_id: number;
  total_members: number | null;
}

/**
 * helpdesksandlevels mezcla dos entidades (validado en producción, 2026-09):
 * - type_id=2: helpdesk, con `name`.
 * - type_id=1: NIVEL (level_order) del helpdesk `parent_id` — sin `name`.
 *   Es la cola real donde viven los tickets: incidents.by.helpdesk usa este id.
 */
export interface InvgateHelpdeskLevelNode {
  id: number;
  type_id: number | null;
  name: string | null;
  status_id: number;
  level_order: number | null;
  parent_id: number | null;
  engine_id: number | null;
  members_ids: number[];
  total_members: number | null;
}

async function paginateFlatArray<T>(
  endpoint: string,
): Promise<InvgateResult<T[]>> {
  const all: T[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await invgateGet<unknown>(
      `${endpoint}?page=${page}&page_size=${PAGE_SIZE}`,
    );

    if (!result.ok) {
      return result;
    }

    const payload: unknown = result.data;
    const chunk = Array.isArray(payload)
      ? (payload as T[])
      : Array.isArray((payload as { data?: T[] })?.data)
        ? ((payload as { data?: T[] }).data ?? [])
        : [];

    all.push(...chunk);

    if (chunk.length < PAGE_SIZE) {
      break;
    }
  }

  return { ok: true, status: 200, data: all };
}

export function getHelpdesks(): Promise<InvgateResult<InvgateHelpdeskNode[]>> {
  return paginateFlatArray<InvgateHelpdeskNode>(HELPDESKS_ENDPOINT);
}

export function getHelpdesksAndLevels(): Promise<
  InvgateResult<InvgateHelpdeskLevelNode[]>
> {
  return paginateFlatArray<InvgateHelpdeskLevelNode>(
    HELPDESKS_LEVELS_ENDPOINT,
  );
}
