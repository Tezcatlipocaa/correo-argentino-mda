# Estadísticas de Inventario de Terminales — Diseño

- Fecha: 2026-10-10
- Rama: `feat/inventario-terminales-stats` (worktree `.worktrees/inventario-terminales-stats`)
- Estado: aprobado; pendiente review del spec por el usuario

## 1. Contexto y objetivo

Reporte institucional **para jefatura** del parque de terminales (PCs), construido
sobre la infraestructura ChartCard de #183 (pilot `/admin/usuarios/estadisticas`).
Es la primera vista de estadísticas no-admin y el cierre de la deuda explícita de
#183 ("sub-vistas de Oficinas e Inventario-terminales").

### Decisiones del grill (2026-10-10)

| Pregunta | Decisión |
| --- | --- |
| Objetivo de las métricas | Reporte para jefatura (reporting institucional) |
| Alcance temporal | Solo foto actual — sin histórico de inventario |
| Alcance del parque | Solo terminales (tab Terminales del parque PC) |
| Cortes | Geografía (región/provincia), hardware/SO (marca, familia SO), top sucursales |
| Consumo | Página en el portal (login) **+** export PNG/CSV |

### Enfoque elegido

**A — Subpágina dedicada `/inventario-terminales/estadisticas`** (patrón #183),
sobre B (inline en la página operativa) y C (híbrido). Razones: consistencia con
el pilot, cero ruido en la vista operativa, URL directa para jefatura, RBAC sin
fricción (heredado por prefix-match).

## 2. Datos reales que guían el diseño (muestra 2026-10-10)

- **7.787 terminales**; 1.192 sucursales con equipos (nis matchea `offices`);
  **34 huérfanos** (nis sin oficina); 5 regiones; 24 provincias.
- SO: **Windows 10 = 74%** (5.772 entre Pro / Pro for Workstations / N / Education),
  Windows 11 = 613, Ubuntu = 872 (mayoría 8.04), Debian = 237 (10 + 12),
  Windows 7 + XP = 60, Windows Server ≈ 64, sin dato = 138.
- `terminals.manufacturer` crudo **mezcla motherboards y VMs** (Gigabyte 1.367,
  ASRock 1.286, MSI, Intel, Oracle/VirtualBox, AMI) con marcas reales
  (Dell 2.615, Bangho 682, Coradir 525, HP 480 = Hewlett-Packard 361 + HP 119,
  Lenovo 46). → Agrupar con la lógica de marcas conocidas existente +
  **"Otras/armadas" (~44%)**, que es un dato de interés en sí para jefatura.
- Top sucursales: CTP BUENOS AIRES (752), SEDE DOMINGO FRENCH (687),
  CDP PAQUETERÍA MALVINAS ARGENTINAS (182).
- Los colores por región existen en `regions.color`, pero el diseño usa la
  paleta estándar de `readChartTokens()` (DESIGN.md); no se usan hex de la DB.

## 3. Alcance

**Incluye**
- Tab Terminales (parque PC completo, 7.787 equipos).
- Filtros: región, provincia, marca, familia SO.
- 4 KPIs + 5 charts + export PNG/CSV por chart.
- Entrada de sidebar y link de vuelta al inventario.

**Excluye (fases futuras, no ahora)**
- Mediterránea, T&T/STS, Cúbics (otro data model/visibilidad).
- Historial / evolución temporal (requeriría tabla de snapshots — YAGNI hoy).
- KPIs inline en la página operativa (enfoque C — fase 2 si esta vista demuestra uso).
- Interactividad segment-click → drilldown (ChartCard la emite; no se consume).

## 4. Arquitectura

### Archivos nuevos

| Archivo | Rol |
| --- | --- |
| `src/pages/inventario-terminales/estadisticas.astro` | Wrapper: `BaseLayout > PageContainer width=xl > PageHeader backHref=/inventario-terminales + Content server:defer + ChartCardSkeleton count={5}` (patrón exacto de `admin/usuarios/estadisticas.astro`) |
| `src/components/inventario/EstadisticasTerminalesContent.astro` | Filtros + KPIs + 5 ChartCard + script live (patrón `UsuariosEstadisticasContent.astro`) |
| `src/lib/terminalStats.ts` | `computeTerminalStats(rows, filters)` **pura** + `getTerminalStatsRows()` (query SQL) + tipos |
| `src/pages/api/terminals/estadisticas.ts` | Endpoint GET |
| `src/lib/terminalStats.test.ts` | Tests de dominio (`node:test`) de la agregación pura |
| `tests/inventario/terminal-estadisticas.spec.ts` | E2E Playwright (primario) |

### Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `src/components/ui/ChartCard.astro` | Prop opcional `exportable?: boolean` (default `false`) → botones PNG + CSV en la fila del toggle "Ver tabla". Aditivo: sin prop, comportamiento actual intacto (usuarios/asistencia no se tocan) |
| `src/lib/terminalQueries.ts` | Exportar `inferBrandFromManufacturer` (hoy privada) para reutilizarla en la agregación |
| `src/lib/rbac.ts` | Módulo nuevo `"inventario"` en `getModulePermissions`: `canRead: true` (todos), `canWrite: false` |
| `src/lib/navigation.ts` | Child `{ href: "/inventario-terminales/estadisticas", label: "Estadísticas", icon: "boxicons:pie-chart-alt-filled" }` bajo "Terminales" (Accesos rápidos) |

### Datos: una query + agregación JS

- `getTerminalStatsRows()`: `terminals LEFT JOIN offices (nis=code) LEFT JOIN provinces (provinceCode=code) LEFT JOIN regions (regionId=id)`; selecciona columnas mínimas
  (`manufacturer`, `operating_system`, `nis`, `office.name`, `province.name/region`).
  ~7,8k filas → agregación en memoria por request. Mismo criterio ya aceptado en
  `getTTGroups` ("miles, no millones"); dejar comentario `ponytail:` con el techo
  (si el parque crece, mover bucketing a SQL).
- `computeTerminalStats(rows, filters)`: filtros y bucketing **JS puro**:
  - marca: `inferBrandFromManufacturer` (Dell/HP/Lenovo/Bangho/Coradir/Otras).
  - SO: `getTerminalTypeLabel` (reuso) → `Windows 11`, `Windows 10`, `Windows 7`, `Windows XP`, `Windows Server`, `Ubuntu`, `Debian`, `Windows`/`Linux`/raw, `Sin datos`.
  - geografía: región/provincia por nombre; sin match → bucket `Sin ubicación`.
  - filtros: AND entre los presentes; valores validados contra whitelist. Valores:
    `region` = `regions.id` (CABA|SUR|PBA-LP|NEA|NOA), `provincia` = `provinces.code`,
    `marca` = `dell|hp|lenovo|bangho|coradir|otras`, `os` = mismos ids que el filtro
    `filter-os` del inventario (`win11|win10|win7|winxp|winserver|ubuntu|debian`) + `sin-dato`.
  - Buckets de SO no listados en el filtro (fallback `Windows`/`Linux`/label crudo)
    se muestran en el chart con su label pero no son filtrables (caso raro; documentado).

## 5. UI

### Filtros (card estándar, `select select-bordered select-sm`)

- **Región** (5 + Todas), **Provincia** (24 + Todas; valor = `provinces.code`),
  **Marca** (Dell, HP, Lenovo, Bangho, Coradir, Otras + Todas),
  **Familia SO** (8 buckets + Todas). Sin cascada. Estado en query-params
  (`history.replaceState`), inicializado desde `window.location.search`.

### KPIs (grid `gap-4 sm:grid-cols-2 lg:grid-cols-4`)

| KPI | Valor | Color |
| --- | --- | --- |
| Total terminales | `toLocaleString("es-AR")` | primary |
| Sucursales con equipos | nis distintos con oficina | info |
| % Windows 11 | redondeado entero | success |
| % Windows 10 | redondeado entero (parque a migrar, EOL) | warning |

Sin "% SO soportado": mezclar Ubuntu 8.04 (2008) en "vigente" sería engañoso;
los KPIs factuales Win11/Win10 son los que jefatura sigue.

### Charts (grid `gap-6 lg:grid-cols-3`, `ChartCardSkeleton count={5}`)

1. **Equipos por provincia** — `bar`, span-2. Top-12 + `Resto` + `Sin ubicación` (si hay).
2. **Por región** — `doughnut`. 5 regiones + `Sin ubicación` (si hay).
3. **Equipos por sistema operativo** — `bar`, span-2. Buckets ordenados desc (~9).
4. **Por marca** — `doughnut`. Dell/HP/Lenovo/Bangho/Coradir/Otras.
5. **Top 10 sucursales** — `bar`, span-3. Por nombre de oficina; huérfanos excluidos.

Todos: `fetchUrl` + `chartKey` (modo vivo), escuchan `stats:filters-changed`,
estado vacío estándar, toggle "Ver tabla" (a11y ya en ChartCard). Link
"Ver inventario completo" → `/inventario-terminales`.

### Export (decisión "Ambas")

- Extensión aditiva de `ChartCard` con `exportable`:
  - **PNG**: recomposición en canvas offscreen con fondo `base-100` (el canvas de
    Chart.js es transparente) → `toBlob` → descarga `slug(título)-YYYYMMDD.png`.
  - **CSV**: desde `currentLabels`/`currentSeries` ya presentes → BOM `\uFEFF` +
    separador `;` (Excel es-AR) → `slug(título)-YYYYMMDD.csv`.
  - Botones visibles solo con datos; en estado vacío se ocultan/deshabilitan.
- Solo la página de estadísticas activa `exportable`.

## 6. API

`GET /api/terminals/estadisticas?region&provincia&marca&os`

```jsonc
{
  "kpis": { "total": 7787, "sucursales": 1192, "pctWin11": 8, "pctWin10": 74 },
  "charts": {
    "porRegion":    { "labels": ["..."], "series": [{ "label": "Equipos", "data": [0] }] },
    "porProvincia": { "labels": ["..."], "series": [{ "label": "Equipos", "data": [0] }] },
    "porSo":        { "labels": ["..."], "series": [{ "label": "Equipos", "data": [0] }] },
    "porMarca":     { "labels": ["..."], "series": [{ "label": "Equipos", "data": [0] }] },
    "topSucursales":{ "labels": ["..."], "series": [{ "label": "Equipos", "data": [0] }] }
  },
  "filtros": { "region": "SUR", "provincia": null, "marca": null, "os": null }
}
```

- `requireReadAccess(locals, "inventario")` (módulo nuevo: read todos, write nadie).
- La whitelist de rutas `/api/terminals` (ALL_ROLES) ya cubre este path por prefix-match.
- `Cache-Control: no-store`. Formato de respuesta `jsonResponse` (`@lib/apiResponse`).
- Validación estricta de query params contra whitelist: valor inválido → **400**
  con mensaje en español (ej. `"Región inválida: XX"`). Error interno → 500 `jsonError`.

## 7. RBAC y navegación

- Ruta de página: `/inventario-terminales/estadisticas` hereda `ALL_ROLES` de
  `/inventario-terminales` (prefix-match en `hasPermission`). **Sin cambios** en
  `routePermissions`.
- Sidebar: child bajo "Terminales" (misma mecánica que Usuarios → Estadísticas).
- Sin `logAdminAction` (vista de solo lectura).

## 8. Manejo de errores (cliente)

- Fetch fallido: KPIs → `—`, charts quedan en estado vacío; `console.error` y
  guard de secuencia (`fetchSeq`) para descartar respuestas viejas.
- El evento `stats:filters-changed` se emite en `finally` (patrón #183) para que
  las ChartCard en modo vivo reciban el query aunque el KPI fetch falle.

## 9. Testing

- **E2E (primario)** `tests/inventario/terminal-estadisticas.spec.ts`, espejo del
  spec de usuarios: KPIs ≠ `…`, canvases visibles, cambio de filtro actualiza
  charts + URL, toggle "Ver tabla", botones export presentes, estado vacío con
  filtro sin resultados, back link. Usa `test.info().project.use.baseURL`.
- **Unit dominio** `src/lib/terminalStats.test.ts` (`node:test`): verificar si
  `test:domain` usa glob sobre `src/lib/*.test.ts`; si lista archivos explícita,
  sumar este ahí. Cubre: bucketing marca (incl. `Otras` y vacíos), mapeo de SO, top-N,
  AND de filtros, aritmética de KPIs, huérfanos → `Sin ubicación`, cuadre de
  totales. Es lógica pura, no espejo de implementación.
- Cierre: `npm run test:domain`, `npm run test:unit`, `npm run test:e2e` (o spec
  scopeado) + reporte Playwright como artefacto.

## 10. Rollout

1. Spec (este archivo) → commit en la rama del worktree (`git add -f`, el dir
   `docs/superpowers/` está gitignored).
2. Issue nueva "Estadísticas de inventario de terminales" linkeando el spec.
3. Plan de implementación (writing-plans) → ejecución.
4. E2E + reporte HTML/traces como evidencia de cierre.

## 11. Riesgos y notas

- `ChartCard` es compartido (usuarios, asistencia): el cambio `exportable` es
  opt-in y aditivo; cubrir con el E2E existente de usuarios que nada cambió.
- Prefijo de ruta ya cubierto: no olvidar que la whitelist es default-deny — el
  nuevo endpoint va **bajo** `/api/terminals/` a propósito.
- Los 34 huérfanos se excluyen de sucursales pero se muestran como `Sin ubicación`
  en región/provincia para que los totales de los charts cuadren con el KPI total.
- Performance: agregación JS sobre ~7,8k filas por request es aceptable hoy
  (comentario `ponytail:` con upgrade path a SQL GROUP BY).
