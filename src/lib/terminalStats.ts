import { db } from "@db/index";
import { terminals, offices, provinces, regions } from "@db/schema";
import { eq } from "drizzle-orm";
import { getTerminalTypeLabel } from "@lib/terminalHelpers";
import { inferBrandFromManufacturer } from "@lib/terminalQueries";

export const MARCA_VALUES = [
  "dell",
  "hp",
  "lenovo",
  "bangho",
  "coradir",
  "otras",
] as const;
export type MarcaFilter = (typeof MARCA_VALUES)[number];

export const MARCA_LABELS: Record<MarcaFilter, string> = {
  dell: "Dell",
  hp: "HP",
  lenovo: "Lenovo",
  bangho: "Bangho",
  coradir: "Coradir",
  otras: "Otras",
};

export const OS_FILTER_BUCKETS = {
  win11: "Windows 11",
  win10: "Windows 10",
  win7: "Windows 7",
  winxp: "Windows XP",
  winserver: "Windows Server",
  ubuntu: "Ubuntu",
  debian: "Debian",
} as const;
export type OsFilter = keyof typeof OS_FILTER_BUCKETS | "sin-dato";
export const OS_FILTER_VALUES: readonly OsFilter[] = [
  ...(Object.keys(OS_FILTER_BUCKETS) as (keyof typeof OS_FILTER_BUCKETS)[]),
  "sin-dato",
];

export const SIN_UBICACION = "Sin ubicación";
export const SIN_DATOS = "Sin datos";

export interface TerminalStatsFilters {
  region?: string; // regions.id
  provincia?: string; // provinces.code
  marca?: MarcaFilter;
  os?: OsFilter;
}

export interface TerminalStatsRow {
  manufacturer: string | null;
  operatingSystem: string | null;
  nis: string | null;
  officeName: string | null;
  provinceCode: string | null;
  provinceName: string | null;
  regionId: string | null;
  regionName: string | null;
}

export interface ChartSeries {
  label: string;
  data: number[];
}

export interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

export interface TerminalStatsResult {
  kpis: {
    total: number;
    sucursales: number;
    pctWin11: number;
    pctWin10: number;
  };
  charts: {
    porRegion: ChartData;
    porProvincia: ChartData;
    porSo: ChartData;
    porMarca: ChartData;
    topSucursales: ChartData;
  };
}

export function osBucket(os: string | null): string {
  const trimmed = (os ?? "").trim();
  return trimmed ? getTerminalTypeLabel(trimmed) : SIN_DATOS;
}

export function marcaBucket(manufacturer: string | null): MarcaFilter {
  const brand = inferBrandFromManufacturer(manufacturer);
  return brand && (MARCA_VALUES as readonly string[]).includes(brand)
    ? (brand as MarcaFilter)
    : "otras";
}

function matchesFilters(
  row: TerminalStatsRow,
  filters: TerminalStatsFilters,
): boolean {
  if (filters.region && row.regionId !== filters.region) return false;
  if (filters.provincia && row.provinceCode !== filters.provincia) return false;
  if (filters.marca && marcaBucket(row.manufacturer) !== filters.marca)
    return false;
  if (filters.os) {
    const bucket = osBucket(row.operatingSystem);
    if (filters.os === "sin-dato") {
      if (bucket !== SIN_DATOS) return false;
    } else if (bucket !== OS_FILTER_BUCKETS[filters.os]) {
      return false;
    }
  }
  return true;
}

const PROVINCIA_TOP = 12;
const SUCURSAL_TOP = 10;

function sortedEntries(counts: Map<string, number>): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function toChartData(entries: [string, number][]): ChartData {
  return {
    labels: entries.map(([label]) => label),
    series: [{ label: "Equipos", data: entries.map(([, count]) => count) }],
  };
}

export function computeTerminalStats(
  rows: TerminalStatsRow[],
  filters: TerminalStatsFilters = {},
): TerminalStatsResult {
  const osCounts = new Map<string, number>();
  const marcaCounts = new Map<MarcaFilter, number>();
  const regionCounts = new Map<string, number>();
  const provinceCounts = new Map<string, number>();
  const officeCounts = new Map<string, number>();
  const sucursales = new Set<string>();
  let total = 0;
  let win11 = 0;
  let win10 = 0;

  for (const row of rows) {
    if (!matchesFilters(row, filters)) continue;
    total += 1;

    const os = osBucket(row.operatingSystem);
    osCounts.set(os, (osCounts.get(os) ?? 0) + 1);
    if (os === OS_FILTER_BUCKETS.win11) win11 += 1;
    if (os === OS_FILTER_BUCKETS.win10) win10 += 1;

    const marca = marcaBucket(row.manufacturer);
    marcaCounts.set(marca, (marcaCounts.get(marca) ?? 0) + 1);

    const region = row.regionName ?? SIN_UBICACION;
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);

    const provincia = row.provinceName ?? SIN_UBICACION;
    provinceCounts.set(provincia, (provinceCounts.get(provincia) ?? 0) + 1);

    if (row.officeName && row.nis) {
      sucursales.add(row.nis);
      const office = row.officeName.trim();
      officeCounts.set(office, (officeCounts.get(office) ?? 0) + 1);
    }
  }

  // Provincia: top-N + "Sin ubicación" (si hay huérfanos) + "Resto", para que
  // el eje no se vuelva ilegible.
  const provinceSorted = sortedEntries(provinceCounts);
  const top = provinceSorted.slice(0, PROVINCIA_TOP);
  const topLabels = new Set(top.map(([label]) => label));
  const sinUbicacion = provinceSorted.find(([label]) => label === SIN_UBICACION);
  const resto = provinceSorted
    .filter(([label]) => !topLabels.has(label) && label !== SIN_UBICACION)
    .reduce((acc, [, count]) => acc + count, 0);
  const provinciaEntries: [string, number][] = [...top];
  if (sinUbicacion && !topLabels.has(SIN_UBICACION)) {
    provinciaEntries.push(sinUbicacion);
  }
  if (resto > 0) provinciaEntries.push(["Resto", resto]);

  const marcaEntries: [string, number][] = MARCA_VALUES.filter(
    (m) => (marcaCounts.get(m) ?? 0) > 0,
  )
    .map((m) => [MARCA_LABELS[m], marcaCounts.get(m) ?? 0] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  return {
    kpis: {
      total,
      sucursales: sucursales.size,
      pctWin11: total ? Math.round((win11 / total) * 100) : 0,
      pctWin10: total ? Math.round((win10 / total) * 100) : 0,
    },
    charts: {
      porRegion: toChartData(sortedEntries(regionCounts)),
      porProvincia: toChartData(provinciaEntries),
      porSo: toChartData(sortedEntries(osCounts)),
      porMarca: toChartData(marcaEntries),
      topSucursales: toChartData(
        sortedEntries(officeCounts).slice(0, SUCURSAL_TOP),
      ),
    },
  };
}

export async function getTerminalStatsRows(): Promise<TerminalStatsRow[]> {
  // ponytail: agregación JS sobre ~8k filas por request (mismo criterio ya
  // aceptado en getTTGroups: "miles, no millones"). Si el parque crece a
  // decenas de miles, mover el bucketing a SQL GROUP BY manteniendo el
  // contrato de computeTerminalStats.
  return db
    .select({
      manufacturer: terminals.manufacturer,
      operatingSystem: terminals.operatingSystem,
      nis: terminals.nis,
      officeName: offices.name,
      provinceCode: offices.provinceCode,
      provinceName: provinces.name,
      regionId: regions.id,
      regionName: regions.name,
    })
    .from(terminals)
    .leftJoin(offices, eq(terminals.nis, offices.code))
    .leftJoin(provinces, eq(offices.provinceCode, provinces.code))
    .leftJoin(regions, eq(provinces.regionId, regions.id))
    .all();
}
