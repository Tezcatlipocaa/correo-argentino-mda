import type { OfficeDirectoryItem } from "@/types/offices";

export interface SiblingOffice {
  code: string;
  name: string;
}

export function siblingKey(
  address: string | null | undefined,
  region: string | null | undefined,
  provinceCode: string | null | undefined,
): string {
  const normAddr = (address ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const normRegion = (region ?? "").trim().toLowerCase();
  const normProv = (provinceCode ?? "").trim().toUpperCase();
  if (!normAddr) return "";
  return `${normAddr}|${normRegion}|${normProv}`;
}

type Groupable = Pick<
  OfficeDirectoryItem,
  "code" | "name" | "address" | "region" | "provinceCode"
>;

export function buildSiblingMap(
  items: Groupable[],
): Map<string, SiblingOffice[]> {
  const groups = new Map<string, Groupable[]>();

  for (const item of items) {
    const key = siblingKey(item.address, item.region, item.provinceCode);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }

  const result = new Map<string, SiblingOffice[]>();

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const item of group) {
      const siblings = group
        .filter((o) => o.code !== item.code)
        .map((o) => ({ code: o.code, name: o.name }));
      result.set(item.code, siblings);
    }
  }

  return result;
}
