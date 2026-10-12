# Estadísticas de Inventario de Terminales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subpágina `/inventario-terminales/estadisticas` con 4 KPIs, 5 gráficos ChartCard (modo vivo con filtros región/provincia/marca/SO) y export PNG/CSV por gráfico, según el spec `docs/superpowers/specs/2026-10-10-inventario-terminales-estadisticas-design.md`.

**Architecture:** Una query con joins (`terminals LEFT JOIN offices/provinces/regions`) → agregación JS pura (`computeTerminalStats`, testeable) → endpoint GET con validación whitelist → página server:defer + ChartCard en modo vivo que escucha `stats:filters-changed` (patrón exacto del pilot `/admin/usuarios/estadisticas`). ChartCard gana una prop aditiva `exportable` (PNG/CSV).

**Tech Stack:** Astro SSR, Drizzle/better-sqlite3, Chart.js (dentro de ChartCard), Tailwind v4 + DaisyUI v5, `node:test` (dominio), Playwright (E2E).

**Worktree:** `E:\Dev\proyectos\correo-argentino-mda\.worktrees\inventario-terminales-stats` (rama `feat/inventario-terminales-stats`). Todos los paths son relativos a esa raíz. El dev server E2E va en 4321 (verificar puerto antes).

**Hechos verificados en recon (no re-investigar):**
- `test:domain` en `package.json` es una **lista explícita** de archivos (no glob) → hay que sumar el archivo nuevo ahí.
- `tsx` resuelve los alias `@lib/*`/`@db/*` en tests `node:test` (verificado con script temporal).
- Iconos boxicons disponibles y verificados: `building-house`, `desktop`, `pie-chart-alt-filled`, `table`, `windows`, `image`, `file`, `arrow-down`. **No existe** `download` ni `export` en `@iconify-json/boxicons` 1.2.0 — no usarlos.
- `jsonResponse(data, status, cacheControl)` / `jsonError(msg, status, cacheControl)` (3er arg = Cache-Control).
- `requireReadAccess(locals, module)` usa `getModulePermissions` de `rbac.ts`.
- Ruta `/inventario-terminales` = ALL_ROLES → `/inventario-terminales/estadisticas` hereda por prefix-match; `/api/terminals` = ALL_ROLES → `/api/terminals/estadisticas` hereda. `helpdeskAccess.isSectionVisibleSync` no bloquea esa subruta para mesas no-MDA-TI (solo bloquea `/inventario-terminales/cubics`). NADA que tocar en `routePermissions`.
- `tests/unit/roles-matrix-consistency.test.ts` no exige fila nueva en `rolesMatrix.ts` para el módulo nuevo.
- ChartCard: `chartProps` JSON viaja al script; `renderTableVisibility()` es el punto único que se llama en build/empty/setData/toggle; la instancia Chart es privada del closure.

---

### Task 1: Módulo RBAC `inventario`

**Files:**
- Modify: `src/lib/rbac.ts` (agregar branch en `getModulePermissions`, antes del `return perm`)

- [ ] **Step 1: Agregar el módulo**

En `src/lib/rbac.ts`, reemplazar:

```ts
  } else if (moduleName === "automatizaciones") {
    // Monitoreo de automatizaciones InvGate: lectura para todos los roles
    // logueados. Escritura (cerrar/reabrir localmente y editar datos manuales)
    // para supervisor+, que es la política de cierre desde el portal.
    perm.canRead = true;
    perm.canWrite = rank >= ROLE_HIERARCHY.supervisor;
  }

  return perm;
```

por:

```ts
  } else if (moduleName === "automatizaciones") {
    // Monitoreo de automatizaciones InvGate: lectura para todos los roles
    // logueados. Escritura (cerrar/reabrir localmente y editar datos manuales)
    // para supervisor+, que es la política de cierre desde el portal.
    perm.canRead = true;
    perm.canWrite = rank >= ROLE_HIERARCHY.supervisor;
  } else if (moduleName === "inventario") {
    // Estadísticas del parque de terminales: lectura para todos los roles
    // logueados; sin escrituras por ahora.
    perm.canRead = true;
  }

  return perm;
```

- [ ] **Step 2: Verificar que no rompe la matriz**

Run: `npx vitest run tests/unit/roles-matrix-consistency.test.ts`
Expected: PASS (3 tests). La fila "Ver Inventario" de `rolesMatrix` mapea a `hasPermission("/inventario-terminales")`, que no cambia.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rbac.ts
git commit -m "feat(rbac): modulo inventario para estadisticas de terminales"
```

---

### Task 2: Librería de agregación `terminalStats.ts` (TDD)

**Files:**
- Create: `src/lib/terminalStats.test.ts`
- Create: `src/lib/terminalStats.ts`
- Modify: `src/lib/terminalQueries.ts:926` (exportar `inferBrandFromManufacturer`)
- Modify: `package.json:28` (sumar el test nuevo a `test:domain`)

- [ ] **Step 1: Escribir el test de dominio que falla**

Crear `src/lib/terminalStats.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeTerminalStats,
  marcaBucket,
  osBucket,
  type TerminalStatsRow,
} from "./terminalStats";

const row = (
  overrides: Partial<TerminalStatsRow> = {},
): TerminalStatsRow => ({
  manufacturer: "Dell Inc.",
  operatingSystem: "Windows 11 Pro",
  nis: "OF001",
  officeName: "Sucursal Uno",
  provinceCode: "BA",
  provinceName: "Buenos Aires",
  regionId: "PBA-LP",
  regionName: "Buenos Aires y La Pampa",
  ...overrides,
});

test("osBucket mapea variantes y vacíos", () => {
  assert.equal(osBucket("Windows 10 Pro"), "Windows 10");
  assert.equal(osBucket("Windows Server 2019"), "Windows Server");
  assert.equal(osBucket("Debian GNU/Linux 12"), "Debian");
  assert.equal(osBucket(""), "Sin datos");
  assert.equal(osBucket(null), "Sin datos");
});

test("marcaBucket normaliza marcas conocidas y manda el resto a otras", () => {
  assert.equal(marcaBucket("Dell Inc."), "dell");
  assert.equal(marcaBucket("Hewlett-Packard"), "hp");
  assert.equal(marcaBucket("HP"), "hp");
  assert.equal(marcaBucket("LENOVO"), "lenovo");
  assert.equal(marcaBucket("Gigabyte Technology Co., Ltd."), "otras");
  assert.equal(marcaBucket(null), "otras");
});

test("KPIs: total, sucursales con oficina y porcentajes redondeados", () => {
  const rows = [
    row(),
    row({ operatingSystem: "Windows 10 Pro" }),
    row({
      manufacturer: "HP",
      operatingSystem: "Windows 10 Pro",
      nis: "OF002",
      officeName: "Sucursal Dos",
    }),
    row({
      manufacturer: null,
      operatingSystem: null,
      nis: "HUERFANO",
      officeName: null,
      provinceCode: null,
      provinceName: null,
      regionId: null,
      regionName: null,
    }),
  ];
  const stats = computeTerminalStats(rows);
  assert.deepEqual(stats.kpis, {
    total: 4,
    sucursales: 2,
    pctWin11: 25,
    pctWin10: 50,
  });
});

test("las series de todos los charts suman el total", () => {
  // Sin huérfanos: topSucursales excluye nis sin oficina, así que el cuadre
  // se prueba con filas todas asignadas a una sucursal.
  const rows = [
    row(),
    row({ operatingSystem: "Windows 10 Pro" }),
    row({
      manufacturer: "HP",
      operatingSystem: "Windows 10 Pro",
      nis: "OF002",
      officeName: "Sucursal Dos",
    }),
  ];
  const { kpis, charts } = computeTerminalStats(rows);
  for (const chart of Object.values(charts)) {
    const sum = chart.series[0].data.reduce((a, b) => a + b, 0);
    assert.equal(sum, kpis.total);
  }
});

test("los filtros combinan con AND", () => {
  const rows = [
    row(),
    row({ operatingSystem: "Windows 10 Pro" }),
    row({ manufacturer: "HP" }),
    row({ manufacturer: "HP", operatingSystem: "Windows 10 Pro" }),
  ];
  assert.equal(computeTerminalStats(rows, { marca: "dell" }).kpis.total, 2);
  assert.equal(
    computeTerminalStats(rows, { marca: "dell", os: "win10" }).kpis.total,
    1,
  );
  assert.equal(
    computeTerminalStats(rows, { marca: "hp", os: "win11" }).kpis.total,
    1,
  );
});

test("filtros de geografía y sin-dato", () => {
  const rows = [
    row(),
    row({
      nis: "OF003",
      officeName: "Sucursal Tres",
      provinceCode: "CF",
      provinceName: "Capital Federal",
      regionId: "CABA",
      regionName: "CABA",
    }),
    row({
      operatingSystem: null,
      nis: "HUERFANO",
      officeName: null,
      provinceCode: null,
      provinceName: null,
      regionId: null,
      regionName: null,
    }),
  ];
  assert.equal(computeTerminalStats(rows, { region: "CABA" }).kpis.total, 1);
  assert.equal(computeTerminalStats(rows, { provincia: "BA" }).kpis.total, 1);
  assert.equal(computeTerminalStats(rows, { os: "sin-dato" }).kpis.total, 1);
  const orphanOnly = computeTerminalStats(rows, { region: "CABA" });
  assert.deepEqual(orphanOnly.charts.porRegion.labels, ["CABA"]);
});

test("provincia: top-12 + Sin ubicación + Resto", () => {
  const named = Array.from({ length: 14 }, (_, i) =>
    row({
      nis: `OF${i + 10}`,
      officeName: `Sucursal ${i + 10}`,
      provinceName: `Provincia ${String(i + 1).padStart(2, "0")}`,
      provinceCode: `P${i + 1}`,
    }),
  );
  const rows = [
    ...named,
    row({
      nis: "HUERFANO",
      officeName: null,
      provinceCode: null,
      provinceName: null,
      regionId: null,
      regionName: null,
    }),
  ];
  const { labels, series } = computeTerminalStats(rows).charts.porProvincia;
  assert.equal(labels.length, 14);
  assert.equal(labels[12], "Sin ubicación");
  assert.equal(labels[13], "Resto");
  assert.equal(series[0].data[12], 1);
  assert.equal(series[0].data[13], 2);
});

test("top sucursales: orden desc y corte en 10", () => {
  const rows = Array.from({ length: 11 }, (_, i) =>
    Array.from({ length: i + 1 }, () =>
      row({ nis: `OF${i}`, officeName: `Sucursal ${i}` }),
    ),
  ).flat();
  const { labels, series } = computeTerminalStats(rows).charts.topSucursales;
  assert.equal(labels.length, 10);
  assert.equal(labels[0], "Sucursal 10");
  assert.equal(series[0].data[0], 11);
  assert.ok(!labels.includes("Sucursal 0"));
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx tsx --test src/lib/terminalStats.test.ts`
Expected: FAIL — `Cannot find module './terminalStats'` (o equivalente).

- [ ] **Step 3: Exportar `inferBrandFromManufacturer`**

En `src/lib/terminalQueries.ts` línea 926, cambiar:

```ts
function inferBrandFromManufacturer(
  manufacturer: string | null,
): string | null {
```

por:

```ts
export function inferBrandFromManufacturer(
  manufacturer: string | null,
): string | null {
```

- [ ] **Step 4: Implementar `src/lib/terminalStats.ts`**

```ts
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
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx tsx --test src/lib/terminalStats.test.ts`
Expected: PASS (8 tests, 0 fail).

- [ ] **Step 6: Sumar el archivo a `test:domain`**

En `package.json` línea 28, reemplazar:

```json
    "test:domain": "tsx --test src/lib/officeAddress.test.ts src/lib/officeAddressSuggestions.test.ts src/lib/officeBuildingKey.test.ts src/lib/officeBuildingReconcile.test.ts src/lib/officeLayout.test.ts src/lib/officeSiblings.test.ts src/lib/supportGuides.test.ts",
```

por:

```json
    "test:domain": "tsx --test src/lib/officeAddress.test.ts src/lib/officeAddressSuggestions.test.ts src/lib/officeBuildingKey.test.ts src/lib/officeBuildingReconcile.test.ts src/lib/officeLayout.test.ts src/lib/officeSiblings.test.ts src/lib/supportGuides.test.ts src/lib/terminalStats.test.ts",
```

- [ ] **Step 7: Correr la suite de dominio completa**

Run: `npm run test:domain`
Expected: 60 tests pass (52 previos + 8 nuevos), 0 fail.

- [ ] **Step 8: Commit**

```bash
git add src/lib/terminalStats.ts src/lib/terminalStats.test.ts src/lib/terminalQueries.ts package.json
git commit -m "feat(inventario): agregacion de estadisticas de terminales con tests de dominio"
```

---

### Task 3: Entrada de sidebar

**Files:**
- Modify: `src/lib/navigation.ts:67-70` (children bajo "Terminales")

- [ ] **Step 1: Agregar el child**

Reemplazar:

```ts
      {
        href: "/inventario-terminales",
        label: "Terminales",
        icon: "boxicons:desktop-filled",
      },
```

por:

```ts
      {
        href: "/inventario-terminales",
        label: "Terminales",
        icon: "boxicons:desktop-filled",
        children: [
          {
            href: "/inventario-terminales/estadisticas",
            label: "Estadísticas",
            icon: "boxicons:pie-chart-alt-filled",
          },
        ],
      },
```

- [ ] **Step 2: Verificar navegación**

Run: `npx vitest run tests/unit/navigation`
Expected: PASS (todos).

- [ ] **Step 3: Commit**

```bash
git add src/lib/navigation.ts
git commit -m "feat(navegacion): acceso a estadisticas de terminales desde el sidebar"
```

---

### Task 4: API `GET /api/terminals/estadisticas`

**Files:**
- Create: `src/pages/api/terminals/estadisticas.ts`

- [ ] **Step 1: Crear el endpoint**

```ts
import type { APIRoute } from "astro";
import { db } from "@db/index";
import { provinces, regions } from "@db/schema";
import { jsonError, jsonResponse, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import {
  computeTerminalStats,
  getTerminalStatsRows,
  MARCA_VALUES,
  OS_FILTER_VALUES,
  type MarcaFilter,
  type OsFilter,
  type TerminalStatsFilters,
} from "@lib/terminalStats";

export const GET: APIRoute = async ({ url, locals }) => {
  const denied = await requireReadAccess(locals, "inventario");
  if (denied) return denied;

  const regionParam = url.searchParams.get("region");
  const provinciaParam = url.searchParams.get("provincia");
  const marcaParam = url.searchParams.get("marca");
  const osParam = url.searchParams.get("os");

  try {
    if (regionParam !== null) {
      const regionIds = (await db.select({ id: regions.id }).from(regions)).map(
        (r) => r.id,
      );
      if (!regionIds.includes(regionParam)) {
        return jsonError(`Región inválida: ${regionParam}`, 400, "no-store");
      }
    }
    if (provinciaParam !== null) {
      const provinceCodes = (
        await db.select({ code: provinces.code }).from(provinces)
      ).map((p) => p.code);
      if (!provinceCodes.includes(provinciaParam)) {
        return jsonError(
          `Provincia inválida: ${provinciaParam}`,
          400,
          "no-store",
        );
      }
    }
    if (
      marcaParam !== null &&
      !MARCA_VALUES.includes(marcaParam as MarcaFilter)
    ) {
      return jsonError(`Marca inválida: ${marcaParam}`, 400, "no-store");
    }
    if (osParam !== null && !OS_FILTER_VALUES.includes(osParam as OsFilter)) {
      return jsonError(
        `Filtro de sistema operativo inválido: ${osParam}`,
        400,
        "no-store",
      );
    }

    const filters: TerminalStatsFilters = {
      region: regionParam ?? undefined,
      provincia: provinciaParam ?? undefined,
      marca: (marcaParam as MarcaFilter | null) ?? undefined,
      os: (osParam as OsFilter | null) ?? undefined,
    };

    const rows = await getTerminalStatsRows();
    const stats = computeTerminalStats(rows, filters);

    return jsonResponse(
      {
        ...stats,
        filtros: {
          region: regionParam,
          provincia: provinciaParam,
          marca: marcaParam,
          os: osParam,
        },
      },
      200,
      "no-store",
    );
  } catch (error) {
    console.error("[API terminals/estadisticas] Error:", error);
    return jsonError(sanitizeError(error), 500, "no-store");
  }
};
```

- [ ] **Step 2: Typecheck**

Run: `npx astro check`
Expected: sin errores nuevos. Si aparecen errores pre-existentes ajenos, verificar que **ninguno** apunte a `terminalStats.ts` ni a `estadisticas.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/terminals/estadisticas.ts
git commit -m "feat(api): endpoint de estadisticas de terminales"
```

---

### Task 5: ChartCard — prop `exportable` (PNG + CSV)

**Files:**
- Modify: `src/components/ui/ChartCard.astro` (6 ediciones puntuales; todo aditivo, sin prop = comportamiento actual)

- [ ] **Step 1: Prop en la interfaz**

Reemplazar:

```ts
  variant?: "card" | "bare";
  emptyMessage?: string;
  class?: string;
}
```

por:

```ts
  variant?: "card" | "bare";
  emptyMessage?: string;
  exportable?: boolean;
  class?: string;
}
```

- [ ] **Step 2: Destructurar (frontmatter)**

Reemplazar:

```ts
  variant = "card",
  emptyMessage = "Sin datos para los filtros seleccionados",
  class: className = "",
} = Astro.props;
```

por:

```ts
  variant = "card",
  emptyMessage = "Sin datos para los filtros seleccionados",
  exportable = false,
  class: className = "",
} = Astro.props;
```

- [ ] **Step 3: Pasar la prop al script**

Reemplazar:

```ts
const chartProps = JSON.stringify({
  chartId,
  chartName,
  type,
  title,
  labels,
  series,
  fetchUrl,
  chartKey,
});
```

por:

```ts
const chartProps = JSON.stringify({
  chartId,
  chartName,
  type,
  title,
  labels,
  series,
  fetchUrl,
  chartKey,
  exportable,
});
```

- [ ] **Step 4: Botones en el footer**

Reemplazar:

```astro
    <div class="flex justify-end">
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        data-table-toggle
        aria-expanded="false"
        aria-controls={tableId}
      >
        <Icon name="boxicons:table" size={16} is:inline />
        <span data-table-toggle-label>Ver tabla</span>
      </button>
    </div>
```

por:

```astro
    <div class="flex items-center justify-end gap-1">
      {exportable && (
        <div class="items-center gap-1" data-export-buttons style="display: none">
          <button type="button" class="btn btn-ghost btn-sm" data-export-png>
            <Icon name="boxicons:image" size={16} is:inline />
            <span>PNG</span>
          </button>
          <button type="button" class="btn btn-ghost btn-sm" data-export-csv>
            <Icon name="boxicons:file" size={16} is:inline />
            <span>CSV</span>
          </button>
        </div>
      )}
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        data-table-toggle
        aria-expanded="false"
        aria-controls={tableId}
      >
        <Icon name="boxicons:table" size={16} is:inline />
        <span data-table-toggle-label>Ver tabla</span>
      </button>
    </div>
```

- [ ] **Step 5: Script — tipo y destructura**

En el `<script>`, reemplazar:

```ts
  fetchUrl?: string;
  chartKey?: string;
}
```

por:

```ts
  fetchUrl?: string;
  chartKey?: string;
  exportable?: boolean;
}
```

y reemplazar:

```ts
  const {
    chartId,
    chartName,
    type,
    title,
    labels,
    series,
    fetchUrl,
    chartKey,
  } = props;
```

por:

```ts
  const {
    chartId,
    chartName,
    type,
    title,
    labels,
    series,
    fetchUrl,
    chartKey,
    exportable = false,
  } = props;
```

- [ ] **Step 6: Script — helpers de export (nivel módulo)**

Insertar después de `const win = window as ChartWindow;`:

```ts
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dateStamp(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}${mm}${dd}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportPng(canvas: HTMLCanvasElement, title: string): void {
  const source = document.createElement("canvas");
  source.width = canvas.width;
  source.height = canvas.height;
  const ctx = source.getContext("2d");
  if (!ctx) return;
  // El canvas de Chart.js es transparente: recomponer sobre base-100.
  const style = getComputedStyle(document.documentElement);
  ctx.fillStyle = style.getPropertyValue("--color-base-100").trim() || "#ffffff";
  ctx.fillRect(0, 0, source.width, source.height);
  ctx.drawImage(canvas, 0, 0);
  source.toBlob((blob) => {
    if (blob) triggerDownload(blob, `${slugify(title)}-${dateStamp()}.png`);
  }, "image/png");
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function exportCsv(
  currentLabels: string[],
  currentSeries: { label: string; data: number[] }[],
  title: string,
): void {
  const lines = [["Serie", ...currentLabels].map(csvEscape).join(";")];
  for (const s of currentSeries) {
    lines.push(
      [s.label, ...currentLabels.map((_, i) => String(s.data[i] ?? 0))]
        .map(csvEscape)
        .join(";"),
    );
  }
  // BOM + ';' para que Excel es-AR lo abra en columnas.
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, `${slugify(title)}-${dateStamp()}.csv`);
}
```

- [ ] **Step 7: Script — query del wrapper y visibilidad**

Reemplazar:

```ts
  const toggleBtn = card.querySelector<HTMLButtonElement>("[data-table-toggle]");
```

por:

```ts
  const toggleBtn = card.querySelector<HTMLButtonElement>("[data-table-toggle]");
  const exportWrap = card.querySelector<HTMLElement>("[data-export-buttons]");
```

Y dentro de `renderTableVisibility()`, reemplazar:

```ts
    tableWrap?.classList.toggle("hidden", !showingTable);
    if (toggle) {
      if (label) label.textContent = showingTable ? "Ver gráfico" : "Ver tabla";
      toggle.setAttribute("aria-expanded", String(showingTable));
    }
  }
```

por:

```ts
    tableWrap?.classList.toggle("hidden", !showingTable);
    if (toggle) {
      if (label) label.textContent = showingTable ? "Ver gráfico" : "Ver tabla";
      toggle.setAttribute("aria-expanded", String(showingTable));
    }
    if (exportWrap) {
      exportWrap.style.display = hasData() ? "flex" : "none";
    }
  }
```

- [ ] **Step 8: Script — wire de clicks**

Reemplazar:

```ts
  toggleBtn?.addEventListener("click", () => {
    showingTable = !showingTable;
    renderTableVisibility();
  });
```

por:

```ts
  toggleBtn?.addEventListener("click", () => {
    showingTable = !showingTable;
    renderTableVisibility();
  });

  if (exportable) {
    card
      .querySelector("[data-export-png]")
      ?.addEventListener("click", () => {
        if (canvas) exportPng(canvas, title);
      });
    card
      .querySelector("[data-export-csv]")
      ?.addEventListener("click", () => {
        exportCsv(currentLabels, currentSeries, title);
      });
  }
```

- [ ] **Step 9: Typecheck**

Run: `npx astro check`
Expected: sin errores nuevos en `ChartCard.astro`.

- [ ] **Step 10: Commit**

```bash
git add src/components/ui/ChartCard.astro
git commit -m "feat(chart-card): export PNG/CSV opt-in por grafico"
```

---

### Task 6: Página `/inventario-terminales/estadisticas`

**Files:**
- Create: `src/pages/inventario-terminales/estadisticas.astro`
- Create: `src/components/inventario/EstadisticasTerminalesContent.astro`

- [ ] **Step 1: Wrapper de página**

Crear `src/pages/inventario-terminales/estadisticas.astro`:

```astro
---
import BaseLayout from "@layouts/BaseLayout.astro";
import PageContainer from "@components/ui/PageContainer.astro";
import PageHeader from "@components/ui/PageHeader.astro";
import ChartCardSkeleton from "@components/ui/ChartCardSkeleton.astro";
import EstadisticasTerminalesContent from "@components/inventario/EstadisticasTerminalesContent.astro";
import { getCleanBase } from "@lib/baseUrl";

const cleanBase = getCleanBase();
---

<BaseLayout>
  <PageContainer width="xl">
    <PageHeader
      backHref={`${cleanBase}inventario-terminales`}
      backLabel="Volver al inventario"
      title="Estadísticas de terminales"
      description="Distribución del parque de terminales por ubicación, sistema operativo y marca."
    />

    <EstadisticasTerminalesContent server:defer>
      <ChartCardSkeleton slot="fallback" count={5} />
    </EstadisticasTerminalesContent>
  </PageContainer>
</BaseLayout>
```

- [ ] **Step 2: Componente de contenido**

Crear `src/components/inventario/EstadisticasTerminalesContent.astro`:

```astro
---
import { Icon } from "astro-icon/components";
import StatsCard from "@components/ui/StatsCard.astro";
import ChartCard from "@components/ui/ChartCard.astro";
import { db } from "@db/index";
import { provinces, regions } from "@db/schema";
import { getCleanBase } from "@lib/baseUrl";

const endpoint = `${getCleanBase()}api/terminals/estadisticas`;
const inventarioHref = `${getCleanBase()}inventario-terminales`;

const regionOptions = await db
  .select({ id: regions.id, name: regions.name })
  .from(regions)
  .orderBy(regions.name);
const provinceOptions = await db
  .select({ code: provinces.code, name: provinces.name })
  .from(provinces)
  .orderBy(provinces.name);
---

<div class="flex w-full flex-col gap-6 pb-24">
  <div
    class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-4 shadow-sm md:flex-row md:flex-wrap md:items-end"
  >
    <label class="form-control w-full md:w-48">
      <span class="label-text mb-1 text-sm font-bold">Región</span>
      <select id="stats-region" class="select select-bordered select-sm">
        <option value="">Todas</option>
        {regionOptions.map((r) => <option value={r.id}>{r.name}</option>)}
      </select>
    </label>
    <label class="form-control w-full md:w-56">
      <span class="label-text mb-1 text-sm font-bold">Provincia</span>
      <select id="stats-provincia" class="select select-bordered select-sm">
        <option value="">Todas</option>
        {provinceOptions.map((p) => (
          <option value={p.code}>{p.name}</option>
        ))}
      </select>
    </label>
    <label class="form-control w-full md:w-40">
      <span class="label-text mb-1 text-sm font-bold">Marca</span>
      <select id="stats-marca" class="select select-bordered select-sm">
        <option value="">Todas</option>
        <option value="dell">Dell</option>
        <option value="hp">HP</option>
        <option value="lenovo">Lenovo</option>
        <option value="bangho">Bangho</option>
        <option value="coradir">Coradir</option>
        <option value="otras">Otras</option>
      </select>
    </label>
    <label class="form-control w-full md:w-44">
      <span class="label-text mb-1 text-sm font-bold">Sistema operativo</span>
      <select id="stats-os" class="select select-bordered select-sm">
        <option value="">Todos</option>
        <option value="win11">Windows 11</option>
        <option value="win10">Windows 10</option>
        <option value="win7">Windows 7</option>
        <option value="winxp">Windows XP</option>
        <option value="winserver">Windows Server</option>
        <option value="ubuntu">Ubuntu</option>
        <option value="debian">Debian</option>
        <option value="sin-dato">Sin datos</option>
      </select>
    </label>
    <a class="btn btn-ghost btn-sm md:ml-auto" href={inventarioHref}>
      <Icon name="boxicons:desktop-filled" size={16} is:inline />
      Ver inventario completo
    </a>
  </div>

  <div class="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div data-kpi="total">
      <StatsCard
        icon="desktop"
        label="Total terminales"
        value="…"
        subtitle="Parque PC completo"
      />
    </div>
    <div data-kpi="sucursales">
      <StatsCard
        icon="building-house"
        label="Sucursales con equipos"
        value="…"
        subtitle="Oficinas con al menos un equipo"
        color="info"
      />
    </div>
    <div data-kpi="pctWin11">
      <StatsCard
        icon="windows"
        label="% Windows 11"
        value="…"
        subtitle="Del parque filtrado"
        color="success"
      />
    </div>
    <div data-kpi="pctWin10">
      <StatsCard
        icon="windows"
        label="% Windows 10"
        value="…"
        subtitle="Parque a migrar (EOL)"
        color="warning"
      />
    </div>
  </div>

  <div class="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="lg:col-span-2">
      <ChartCard
        type="bar"
        title="Equipos por provincia"
        fetchUrl={endpoint}
        chartKey="porProvincia"
        exportable
      />
    </div>
    <ChartCard
      type="doughnut"
      title="Equipos por región"
      fetchUrl={endpoint}
      chartKey="porRegion"
      exportable
    />
    <div class="lg:col-span-2">
      <ChartCard
        type="bar"
        title="Equipos por sistema operativo"
        fetchUrl={endpoint}
        chartKey="porSo"
        exportable
      />
    </div>
    <ChartCard
      type="doughnut"
      title="Equipos por marca"
      fetchUrl={endpoint}
      chartKey="porMarca"
      exportable
    />
    <div class="lg:col-span-3">
      <ChartCard
        type="bar"
        title="Top 10 sucursales"
        fetchUrl={endpoint}
        chartKey="topSucursales"
        exportable
      />
    </div>
  </div>
</div>

<script>
  import { getCleanBase } from "@lib/baseUrl";

  const endpoint = `${getCleanBase()}api/terminals/estadisticas`;

  const getSelect = (id: string): HTMLSelectElement | null =>
    document.getElementById(id) as HTMLSelectElement | null;

  function buildQuery(): string {
    const params = new URLSearchParams();
    const region = getSelect("stats-region")?.value;
    const provincia = getSelect("stats-provincia")?.value;
    const marca = getSelect("stats-marca")?.value;
    const os = getSelect("stats-os")?.value;
    if (region) params.set("region", region);
    if (provincia) params.set("provincia", provincia);
    if (marca) params.set("marca", marca);
    if (os) params.set("os", os);
    return params.toString();
  }

  function syncUrl(): void {
    const query = buildQuery();
    const url = query ? `?${query}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }

  function setKpi(key: string, value: string): void {
    const el = document.querySelector(`[data-kpi="${key}"] [data-kpi-value]`);
    if (el) el.textContent = value;
  }

  function clearKpis(): void {
    setKpi("total", "—");
    setKpi("sucursales", "—");
    setKpi("pctWin11", "—");
    setKpi("pctWin10", "—");
  }

  let fetchSeq = 0;

  async function load(): Promise<void> {
    const query = buildQuery();
    syncUrl();
    const seq = ++fetchSeq;
    try {
      const response = await fetch(`${endpoint}?${query}`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (seq !== fetchSeq) return;
      setKpi("total", Number(body.kpis.total).toLocaleString("es-AR"));
      setKpi(
        "sucursales",
        Number(body.kpis.sucursales).toLocaleString("es-AR"),
      );
      setKpi("pctWin11", `${body.kpis.pctWin11}%`);
      setKpi("pctWin10", `${body.kpis.pctWin10}%`);
    } catch (error) {
      if (seq !== fetchSeq) return;
      console.error("[estadisticas terminales] no se pudieron cargar:", error);
      clearKpis();
    } finally {
      if (seq === fetchSeq) {
        window.dispatchEvent(
          new CustomEvent("stats:filters-changed", { detail: { query } }),
        );
      }
    }
  }

  let bound = false;

  function init(): void {
    if (bound) return;
    const regionSelect = getSelect("stats-region");
    // El HTML llega por server island: si el fetch gana la carrera al script,
    // los selects todavía no están y hay que reintentar al inyectarse.
    if (!regionSelect) return;
    bound = true;

    const initial = new URLSearchParams(window.location.search);
    if (initial.get("region")) regionSelect.value = initial.get("region") as string;
    const provinciaSelect = getSelect("stats-provincia");
    if (initial.get("provincia") && provinciaSelect) {
      provinciaSelect.value = initial.get("provincia") as string;
    }
    const marcaSelect = getSelect("stats-marca");
    if (initial.get("marca") && marcaSelect) {
      marcaSelect.value = initial.get("marca") as string;
    }
    const osSelect = getSelect("stats-os");
    if (initial.get("os") && osSelect) {
      osSelect.value = initial.get("os") as string;
    }

    regionSelect.addEventListener("change", load);
    provinciaSelect?.addEventListener("change", load);
    marcaSelect?.addEventListener("change", load);
    osSelect?.addEventListener("change", load);

    load();
  }

  init();

  const injectedObserver = new MutationObserver((records) => {
    if (records.some((record) => record.addedNodes.length)) init();
  });
  injectedObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
</script>
```

- [ ] **Step 3: Typecheck**

Run: `npx astro check`
Expected: sin errores nuevos. Si `astro check` marca errores pre-existentes ajenos, verificar que ninguno apunte a los archivos nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/pages/inventario-terminales/estadisticas.astro src/components/inventario/EstadisticasTerminalesContent.astro
git commit -m "feat(inventario): pagina de estadisticas de terminales"
```

---

### Task 7: E2E Playwright + regresión de ChartCard

**Files:**
- Create: `tests/inventario/terminal-estadisticas.spec.ts`

- [ ] **Step 1: Escribir el spec**

Crear `tests/inventario/terminal-estadisticas.spec.ts`:

```ts
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { createHmac } from "crypto";
import { eq, isNotNull, ne } from "drizzle-orm";
import { db } from "../../src/db/index";
import { provinces, regions, sessions, users } from "../../src/db/schema";

const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";
function sign(sessionId: string): string {
  const sig = createHmac("sha256", SECRET_KEY)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${sig}`;
}

async function findEmptyRegionProvinceCombo(): Promise<{
  regionId: string;
  provinceCode: string;
}> {
  // Provincia de una región + otra región distinta ⇒ intersección vacía.
  const [prov] = await db
    .select({ code: provinces.code, regionId: provinces.regionId })
    .from(provinces)
    .where(isNotNull(provinces.regionId))
    .limit(1);
  const [other] = await db
    .select({ id: regions.id })
    .from(regions)
    .where(ne(regions.id, prov.regionId as string))
    .limit(1);
  return { regionId: other.id, provinceCode: prov.code };
}

test.describe("Endpoint de estadísticas de terminales", () => {
  const stamp = Date.now();
  const sessionId = `sess_term_stats_${stamp}`;
  const username = `term_stats_${stamp}`;
  let userId = 0;
  let cookie = "";

  test.beforeAll(async () => {
    const [row] = await db
      .insert(users)
      .values({ username, password: "x", role: "admin" })
      .returning({ id: users.id });
    userId = row.id;
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: Date.now() + 86_400_000,
    });
    cookie = sign(sessionId);
  });

  test.afterAll(async () => {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  const authHeaders = () => ({ cookie: `session_id=${cookie}` });

  test("sin sesión responde 401", async ({ request }) => {
    const response = await request.get("/api/terminals/estadisticas");
    expect(response.status()).toBe(401);
  });

  test("con sesión devuelve KPIs y los cinco charts", async ({ request }) => {
    const response = await request.get("/api/terminals/estadisticas", {
      headers: authHeaders(),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.kpis).toMatchObject({
      total: expect.any(Number),
      sucursales: expect.any(Number),
      pctWin11: expect.any(Number),
      pctWin10: expect.any(Number),
    });
    expect(body.kpis.total).toBeGreaterThan(0);
    expect(Object.keys(body.charts).sort()).toEqual([
      "porMarca",
      "porProvincia",
      "porRegion",
      "porSo",
      "topSucursales",
    ]);
    for (const chart of Object.values(body.charts) as {
      labels: string[];
      series: { label: string; data: number[] }[];
    }[]) {
      expect(chart.series[0].data).toHaveLength(chart.labels.length);
    }
    expect(body.filtros).toEqual({
      region: null,
      provincia: null,
      marca: null,
      os: null,
    });
  });

  test("el filtro por marca reduce el total", async ({ request }) => {
    const all = await (
      await request.get("/api/terminals/estadisticas", {
        headers: authHeaders(),
      })
    ).json();
    const dell = await (
      await request.get("/api/terminals/estadisticas?marca=dell", {
        headers: authHeaders(),
      })
    ).json();
    expect(dell.kpis.total).toBeGreaterThan(0);
    expect(dell.kpis.total).toBeLessThan(all.kpis.total);
  });

  test("rechaza filtros inválidos con 400", async ({ request }) => {
    for (const query of ["region=NOPE", "marca=sony", "os=amiga"]) {
      const response = await request.get(
        `/api/terminals/estadisticas?${query}`,
        { headers: authHeaders() },
      );
      expect(response.status(), query).toBe(400);
    }
  });

  test("región y provincia de distinta región dan total cero", async ({
    request,
  }) => {
    const empty = await findEmptyRegionProvinceCombo();
    const response = await request.get(
      `/api/terminals/estadisticas?region=${empty.regionId}&provincia=${empty.provinceCode}`,
      { headers: authHeaders() },
    );
    expect(response.status()).toBe(200);
    expect((await response.json()).kpis.total).toBe(0);
  });
});

test.describe("Vista de estadísticas de terminales", () => {
  const stamp = Date.now();
  const sessionId = `sess_term_stats_view_${stamp}`;
  const username = `term_stats_view_${stamp}`;
  let userId = 0;
  let cookie = "";

  test.beforeAll(async () => {
    const [row] = await db
      .insert(users)
      .values({ username, password: "x", role: "agent" })
      .returning({ id: users.id });
    userId = row.id;
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: Date.now() + 86_400_000,
    });
    cookie = sign(sessionId);
  });

  test.afterAll(async () => {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: "session_id", value: cookie, domain: "localhost", path: "/" },
    ]);
  });

  test("renderiza KPIs, cinco gráficos y no pide Chart.js por CDN", async ({
    page,
  }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("cdn.jsdelivr.net")) {
        externalRequests.push(request.url());
      }
    });

    await page.goto("/inventario-terminales/estadisticas");
    await expect(
      page.getByRole("heading", { name: "Estadísticas de terminales" }),
    ).toBeVisible();

    await expect(page.locator("[data-chart-card] canvas")).toHaveCount(5);
    await expect(page.locator("[data-chart-empty]:visible")).toHaveCount(0);

    const total = page.locator('[data-kpi="total"] [data-kpi-value]');
    await expect(total).not.toHaveText("…");
    expect(await total.textContent()).toMatch(/^\d{1,3}(\.\d{3})*$/);

    expect(externalRequests).toEqual([]);
  });

  test("el toggle Ver tabla muestra los datos y oculta el canvas", async ({
    page,
  }) => {
    await page.goto("/inventario-terminales/estadisticas");
    const card = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Equipos por provincia" }) });
    await card.locator("[data-table-toggle]").click();
    await expect(card.locator("canvas")).toBeHidden();
    await expect(card.locator("[data-chart-table] td").first()).toBeVisible();
  });

  test("el filtro por marca sincroniza la URL y recalcula los datos", async ({
    page,
  }) => {
    await page.goto("/inventario-terminales/estadisticas");
    const total = page.locator('[data-kpi="total"] [data-kpi-value]');
    await expect(total).not.toHaveText("…");
    const before = await total.textContent();

    await page.selectOption("#stats-marca", "dell");
    await expect(page).toHaveURL(/marca=dell/);

    const card = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Equipos por marca" }) });
    await card.locator("[data-table-toggle]").click();
    await expect(
      card.locator('[data-chart-table] td[data-label="Dell"]'),
    ).toBeVisible();
    await expect(card.locator("[data-chart-table] tbody tr")).toHaveCount(1);

    await expect(total).not.toHaveText(before as string);
  });

  test("inicializa los filtros desde la query de la URL", async ({ page }) => {
    await page.goto("/inventario-terminales/estadisticas?marca=dell");
    await expect(page.locator("#stats-marca")).toHaveValue("dell");
    const card = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Equipos por marca" }) });
    await card.locator("[data-table-toggle]").click();
    await expect(card.locator("[data-chart-table] tbody tr")).toHaveCount(1);
    await expect(
      card.locator('[data-chart-table] td[data-label="Dell"]'),
    ).toBeVisible();
  });

  test("estado vacío: KPIs en cero, gráficos vacíos y export oculto", async ({
    page,
  }) => {
    const empty = await findEmptyRegionProvinceCombo();
    await page.goto(
      `/inventario-terminales/estadisticas?region=${empty.regionId}&provincia=${empty.provinceCode}`,
    );

    await expect(page.locator('[data-kpi="total"] [data-kpi-value]')).toHaveText(
      "0",
    );
    await expect(page.locator("[data-chart-empty]:visible")).toHaveCount(5);
    await expect(page.locator("[data-chart-card] canvas:visible")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-export-buttons]:visible")).toHaveCount(0);
  });

  test("exporta CSV y PNG desde el gráfico", async ({ page }) => {
    await page.goto("/inventario-terminales/estadisticas");
    const card = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Equipos por región" }) });
    await expect(card.locator("[data-export-buttons]")).toBeVisible();

    const [csv] = await Promise.all([
      page.waitForEvent("download"),
      card.locator("[data-export-csv]").click(),
    ]);
    expect(csv.suggestedFilename()).toMatch(/^equipos-por-region-\d{8}\.csv$/);
    const csvPath = await csv.path();
    if (csvPath) {
      const { readFileSync } = await import("fs");
      const contents = readFileSync(csvPath, "utf8");
      expect(contents.startsWith("\uFEFF")).toBe(true);
      expect(contents).toContain('"Equipos"');
      expect(contents.split("\r\n")[0]).toContain(";");
    }

    const [png] = await Promise.all([
      page.waitForEvent("download"),
      card.locator("[data-export-png]").click(),
    ]);
    expect(png.suggestedFilename()).toMatch(/^equipos-por-region-\d{8}\.png$/);
  });

  test("el botón volver del header regresa al inventario", async ({ page }) => {
    await page.goto("/inventario-terminales/estadisticas");
    await page
      .locator("header")
      .getByRole("link", { name: "Volver al inventario" })
      .click();
    await expect(page).toHaveURL(/\/inventario-terminales$/);
  });
});
```

- [ ] **Step 2: Verificar puertos libres y arrancar dev server**

Run (en PowerShell): `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 4321,4322,4323 }`
Expected: sin listeners en 4321. Si está ocupado, liberar el puerto o setear `PLAYWRIGHT_BASE_URL` + `--port` acorde.

Arrancar en su propio comando: `npm run dev`
Expected: `Local http://localhost:4321/` escuchando.

- [ ] **Step 3: Correr el spec nuevo + regresión de usuarios (ChartCard compartido)**

Run: `npx playwright test tests/inventario/terminal-estadisticas.spec.ts tests/admin/usuarios-estadisticas.spec.ts`
Expected: TODOS verdes. Los de usuarios no deben cambiar — prueba que la prop `exportable` es aditiva.

Si algo falla: leer el error de Playwright, corregir el código de la causa (no el test), re-correr. NO continuar hasta verde.

- [ ] **Step 4: Reporte como artefacto**

Run: `npx playwright show-report`
Expected: reporte HTML con ambos specs verdes (dejarlo abierto para revisión; las trazas quedan en `test-results/`).

- [ ] **Step 5: Commit**

```bash
git add tests/inventario/terminal-estadisticas.spec.ts
git commit -m "test(e2e): estadisticas de terminales end-to-end"
```

---

### Task 8: Cierre y verificación completa

- [ ] **Step 1: Suites completas**

Run: `npm run test:domain`
Expected: 60 tests, 0 fail.

Run: `npm run test:unit`
Expected: 59 archivos, 401 tests, 0 fail (baseline del worktree; sin regresiones).

Run: `npm run test:e2e`
Expected: suite completa verde con el dev server arriba.

- [ ] **Step 2: Apagar el dev server**

Detener el proceso de `npm run dev` (Ctrl+C en su consola). No dejar procesos Node huérfanos.

- [ ] **Step 3: Commit final de docs + estado**

```bash
git add -f docs/superpowers/plans/2026-10-10-inventario-terminales-estadisticas.md docs/superpowers/specs/2026-10-10-inventario-terminales-estadisticas-design.md
git commit -m "docs(inventario): plan de implementacion de estadisticas de terminales"
```

- [ ] **Step 4: Rollout (fuera del worktree)**

- Crear issue "Estadísticas de inventario de terminales" en `ignaciorevainera/correo-argentino-mda` (MCP `github_issue_write`), linkeando el spec en el cuerpo. Buscar duplicados antes (`github_search_issues`).
- Registrar issue de drift de AGENTS.md: afirma "48 archivos, 332 tests, 1 fallo pre-existente" y que `npm test` sale con código 1; el baseline real es 59/401/0 fallos.

---

## Notas de ejecución

- **Commits frecuentes**: uno por task, mensajes en el estilo del repo (`feat(scope): ...` en español sin tildes en el subject).
- **No tocar**: `routePermissions` (la herencia por prefix ya cubre), `rolesMatrix.ts` (el test anti-drift no lo exige para este módulo), E2E de usuarios/asistencia más allá de correrlos.
- **Semántica de datos**: los KPIs cuentan filas crudas de `terminals` (7.787), no el dedup por clustering de la vista operativa — decisión aprobada en el spec §2. Los 34 huérfanos se muestran como "Sin ubicación" en los charts y se excluyen de "Sucursales con equipos".
- **ChartCard**: el cambio es solo aditivo. En modo vivo la visibilidad de los botones de export se recalcula en `renderTableVisibility()`, que ya se invoca en `setData`/`buildChart`/`showEmpty`/toggle — no agregar llamadas nuevas en esos sitios.
