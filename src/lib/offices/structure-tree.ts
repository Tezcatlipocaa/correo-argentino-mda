import { buildBuildingKey } from "../officeBuildingKey";

export interface OfficeTreeNode {
  id: string;
  type: "root" | "region" | "province" | "building" | "office";
  name: string;
  code?: string;
  color?: string;
  officeType?: string;
  isHeadquarter?: boolean;
  totalOffices: number;
  totalTickets: number;
  totalTerminals: number;
  children: OfficeTreeNode[];
  metadata?: {
    address?: string;
    locality?: string;
    provinceName?: string;
    regionName?: string;
    parentNis?: string | null;
  };
}

export interface RawOfficeStructureRecord {
  code: string;
  name: string;
  type?: string | null;
  officeType?: string | null;
  address?: string | null;
  locality?: string | null;
  provinceCode: string;
  provinceName?: string | null;
  regionId: string;
  regionName?: string | null;
  regionColor?: string | null;
  parentNis?: string | null;
  totalTickets?: number;
  totalTerminals?: number;
}

export interface TreeBuildOptions {
  onlyHeadquarters?: boolean;
}

export function isOfficeHeadquarter(code?: string | null): boolean {
  if (!code || typeof code !== "string") return false;
  return /^[A-Z]0000$/.test(code.trim().toUpperCase());
}

export function constructOfficeStructureTree(
  records: RawOfficeStructureRecord[],
  options?: TreeBuildOptions,
): OfficeTreeNode {
  const onlyHeadquarters = Boolean(options?.onlyHeadquarters);

  // Filter if only headquarters
  const eligibleRecords = onlyHeadquarters
    ? records.filter((r) => isOfficeHeadquarter(r.code))
    : records;

  // Build maps: Region -> Province -> BuildingKey -> Offices
  interface BuildingGroup {
    key: string;
    displayName: string;
    address: string;
    locality: string;
    provinceCode: string;
    provinceName: string;
    regionId: string;
    regionName: string;
    regionColor?: string;
    offices: RawOfficeStructureRecord[];
  }

  interface ProvinceGroup {
    code: string;
    name: string;
    regionId: string;
    regionName: string;
    regionColor?: string;
    buildings: Map<string, BuildingGroup>;
  }

  interface RegionGroup {
    id: string;
    name: string;
    color?: string;
    provinces: Map<string, ProvinceGroup>;
  }

  const regionsMap = new Map<string, RegionGroup>();

  for (const record of eligibleRecords) {
    const regId = record.regionId || "SIN_REGION";
    const regName = record.regionName || regId;
    const regColor = record.regionColor || "#64748b";

    if (!regionsMap.has(regId)) {
      regionsMap.set(regId, {
        id: regId,
        name: regName,
        color: regColor,
        provinces: new Map(),
      });
    }
    const region = regionsMap.get(regId)!;

    const provCode = record.provinceCode || "X";
    const provName = record.provinceName || provCode;

    if (!region.provinces.has(provCode)) {
      region.provinces.set(provCode, {
        code: provCode,
        name: provName,
        regionId: regId,
        regionName: regName,
        regionColor: regColor,
        buildings: new Map(),
      });
    }
    const province = region.provinces.get(provCode)!;

    // Determine building key using canonical reconciler
    const rawAddress = (record.address || "").trim();
    const bldKeyResult = buildBuildingKey(rawAddress, provCode);
    const bldKey = bldKeyResult.key || `nobld-${record.code}`;
    const displayAddress = rawAddress || "Sin domicilio registrado";

    if (!province.buildings.has(bldKey)) {
      province.buildings.set(bldKey, {
        key: bldKey,
        displayName: displayAddress,
        address: displayAddress,
        locality: record.locality || "",
        provinceCode: provCode,
        provinceName: provName,
        regionId: regId,
        regionName: regName,
        regionColor: regColor,
        offices: [],
      });
    }
    province.buildings.get(bldKey)!.offices.push(record);
  }

  // Construct hierarchy from groups
  let rootTotalOffices = 0;
  let rootTotalTickets = 0;
  let rootTotalTerminals = 0;

  const regionNodes: OfficeTreeNode[] = [];

  for (const reg of regionsMap.values()) {
    let regTotalOffices = 0;
    let regTotalTickets = 0;
    let regTotalTerminals = 0;

    const provinceNodes: OfficeTreeNode[] = [];

    for (const prov of reg.provinces.values()) {
      let provTotalOffices = 0;
      let provTotalTickets = 0;
      let provTotalTerminals = 0;

      const buildingNodes: OfficeTreeNode[] = [];

      for (const bld of prov.buildings.values()) {
        const officeNodes: OfficeTreeNode[] = [];
        let bldTotalTickets = 0;
        let bldTotalTerminals = 0;

        for (const off of bld.offices) {
          const isHq = isOfficeHeadquarter(off.code);
          const tickets = off.totalTickets || 0;
          const terminals = off.totalTerminals || 0;

          bldTotalTickets += tickets;
          bldTotalTerminals += terminals;

          officeNodes.push({
            id: `off-${off.code}`,
            type: "office",
            name: off.name,
            code: off.code,
            officeType: off.officeType || off.type || "SUCURSAL",
            isHeadquarter: isHq,
            totalOffices: 1,
            totalTickets: tickets,
            totalTerminals: terminals,
            children: [],
            metadata: {
              address: off.address || undefined,
              locality: off.locality || undefined,
              provinceName: prov.name,
              regionName: reg.name,
              parentNis: off.parentNis,
            },
          });
        }

        // Sort offices inside building by NIS
        officeNodes.sort((a, b) => (a.code || "").localeCompare(b.code || ""));

        const bldTotalOffices = officeNodes.length;
        provTotalOffices += bldTotalOffices;
        provTotalTickets += bldTotalTickets;
        provTotalTerminals += bldTotalTerminals;

        buildingNodes.push({
          id: `bld-${prov.code}-${bld.key}`,
          type: "building",
          name: bld.displayName,
          totalOffices: bldTotalOffices,
          totalTickets: bldTotalTickets,
          totalTerminals: bldTotalTerminals,
          children: officeNodes,
          metadata: {
            address: bld.address,
            locality: bld.locality,
            provinceName: prov.name,
            regionName: reg.name,
          },
        });
      }

      // Sort buildings inside province alphabetically
      buildingNodes.sort((a, b) => a.name.localeCompare(b.name, "es"));

      regTotalOffices += provTotalOffices;
      regTotalTickets += provTotalTickets;
      regTotalTerminals += provTotalTerminals;

      provinceNodes.push({
        id: `prov-${reg.id}-${prov.code}`,
        type: "province",
        name: prov.name,
        color: reg.color,
        totalOffices: provTotalOffices,
        totalTickets: provTotalTickets,
        totalTerminals: provTotalTerminals,
        children: buildingNodes,
        metadata: {
          provinceName: prov.name,
          regionName: reg.name,
        },
      });
    }

    // Sort provinces alphabetically
    provinceNodes.sort((a, b) => a.name.localeCompare(b.name, "es"));

    rootTotalOffices += regTotalOffices;
    rootTotalTickets += regTotalTickets;
    rootTotalTerminals += regTotalTerminals;

    regionNodes.push({
      id: `reg-${reg.id}`,
      type: "region",
      name: reg.name,
      color: reg.color,
      totalOffices: regTotalOffices,
      totalTickets: regTotalTickets,
      totalTerminals: regTotalTerminals,
      children: provinceNodes,
    });
  }

  // Predefined ordering for the 5 regions: CABA, PBA-LP, NEA, NOA, SUR
  const regionOrder = ["CABA", "PBA-LP", "NEA", "NOA", "SUR"];
  regionNodes.sort((a, b) => {
    const cleanA = a.id.replace("reg-", "");
    const cleanB = b.id.replace("reg-", "");
    const idxA = regionOrder.indexOf(cleanA);
    const idxB = regionOrder.indexOf(cleanB);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name, "es");
  });

  return {
    id: "root",
    type: "root",
    name: "Red Postal Nacional",
    totalOffices: rootTotalOffices,
    totalTickets: rootTotalTickets,
    totalTerminals: rootTotalTerminals,
    children: regionNodes,
  };
}

/**
 * Consulta la base de datos de MDA y construye el árbol completo de estructura de oficinas.
 */
export async function getOfficeStructureTree(
  options?: TreeBuildOptions,
): Promise<OfficeTreeNode> {
  const { db } = await import("@db/index");
  const {
    offices,
    provinces,
    regions,
    terminals,
    officeInvgateLinks,
  } = await import("@db/schema");
  const { eq, sql } = await import("drizzle-orm");

  const officeRows = await db
    .select({
      code: offices.code,
      name: offices.name,
      type: offices.type,
      officeType: offices.officeType,
      address: offices.address,
      locality: offices.locality,
      provinceCode: offices.provinceCode,
      provinceName: provinces.name,
      regionId: provinces.regionId,
      regionName: regions.name,
      regionColor: regions.color,
      parentNis: offices.parentNis,
      invgateLocationId: officeInvgateLinks.invgateLocationId,
    })
    .from(offices)
    .leftJoin(provinces, eq(provinces.code, offices.provinceCode))
    .leftJoin(regions, eq(regions.id, provinces.regionId))
    .leftJoin(officeInvgateLinks, eq(officeInvgateLinks.officeId, offices.id))
    .where(eq(offices.active, true));

  // Count terminals by NIS
  const terminalCountByNis = new Map<string, number>();
  try {
    const termRows = await db
      .select({
        nis: terminals.nis,
        count: sql<number>`count(*)`,
      })
      .from(terminals)
      .where(sql`${terminals.nis} IS NOT NULL AND ${terminals.nis} != ''`)
      .groupBy(terminals.nis);

    for (const r of termRows) {
      if (r.nis) terminalCountByNis.set(r.nis.toUpperCase(), r.count);
    }
  } catch (err) {
    console.error("[getOfficeStructureTree] Error querying terminals:", err);
  }

  // Count tickets by location/code if available
  const ticketsByCode = new Map<string, number>();
  try {
    const { getOpenOfficeIncidentsByLocation } = await import(
      "@lib/invgate/officeIncidents"
    );
    const { countOpenIncidentsByCode } = await import("@lib/officeStats");
    const byLocation = await getOpenOfficeIncidentsByLocation();
    const locationToCode = new Map<number, string>();
    for (const row of officeRows) {
      if (row.invgateLocationId != null) {
        locationToCode.set(row.invgateLocationId, row.code);
      }
    }
    const allIncidents = [...byLocation.values()].flat();
    const counted = countOpenIncidentsByCode(allIncidents, locationToCode);
    for (const [code, count] of counted.entries()) {
      ticketsByCode.set(code, count);
    }
  } catch (err) {
    // Graceful fallback: 0 tickets
  }

  const rawRecords: RawOfficeStructureRecord[] = officeRows.map((row) => ({
    code: row.code,
    name: row.name,
    type: row.type,
    officeType: row.officeType,
    address: row.address,
    locality: row.locality,
    provinceCode: row.provinceCode,
    provinceName: row.provinceName,
    regionId: row.regionId || "SIN_REGION",
    regionName: row.regionName || row.regionId || "Sin región",
    regionColor: row.regionColor || "#64748b",
    parentNis: row.parentNis,
    totalTerminals: terminalCountByNis.get(row.code.toUpperCase()) || 0,
    totalTickets: ticketsByCode.get(row.code) || 0,
  }));

  return constructOfficeStructureTree(rawRecords, options);
}
