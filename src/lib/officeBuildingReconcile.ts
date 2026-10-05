import { getOfficeAddressKey } from "./officeAddress";
import { buildBuildingKey, pickCanonicalAddress } from "./officeBuildingKey";

export interface ReconcileOfficeRow {
  id: number;
  code: string;
  name: string;
  address: string;
  provinceCode: string;
}

export interface BuildingCandidateGroup {
  key: string;
  canonical: string;
  members: ReconcileOfficeRow[];
}

/**
 * Agrupa oficinas que comparten edificio pero tienen la dirección escrita
 * distinto. Un grupo es candidato solo si:
 *  - todas las filas comparten provincia (el key ya incluye provincia),
 *  - tienen al menos dos miembros,
 *  - y las direcciones crudas no son todas idénticas (si lo fueran, ya
 *    estarían agrupadas por siblingKey y no hay nada que unificar).
 */
export function groupOfficesByBuilding(
  rows: ReconcileOfficeRow[],
): BuildingCandidateGroup[] {
  const byKey = new Map<string, ReconcileOfficeRow[]>();

  for (const row of rows) {
    const { key } = buildBuildingKey(row.address, row.provinceCode);
    if (!key) continue;
    const bucket = byKey.get(key) ?? [];
    bucket.push(row);
    byKey.set(key, bucket);
  }

  const groups: BuildingCandidateGroup[] = [];

  for (const [key, members] of byKey.entries()) {
    if (members.length < 2) continue;

    const rawVariants = new Set(members.map((m) => getOfficeAddressKey(m.address)));
    if (rawVariants.size < 2) continue;

    groups.push({
      key,
      canonical: pickCanonicalAddress(members.map((m) => m.address)),
      members: [...members].sort((a, b) => a.code.localeCompare(b.code, "es-AR")),
    });
  }

  return groups.sort(
    (a, b) =>
      b.members.length - a.members.length ||
      a.key.localeCompare(b.key, "es-AR"),
  );
}
