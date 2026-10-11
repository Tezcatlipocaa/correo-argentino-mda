import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.INVGATE_API_KEY ?? "";
const BASE = process.env.INVGATE_BASE_URL ?? "";
const AUTH = "Basic " + Buffer.from((process.env.INVGATE_API_USERNAME || "portalmda") + ":" + KEY).toString("base64");
const OUT = "C:/Users/irevainera/AppData/Local/Temp/opencode/reval";

async function api<T = any>(path: string, ms = 180000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { Authorization: AUTH }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally { clearTimeout(t); }
}

type Cat = { id: number; name: string; parent_category_id: number | null };
const cats: Cat[] = [];
for (let p = 1; ; p++) { const rows = await api<Cat[]>(`categories?page=${p}&page_size=500`); cats.push(...rows); if (rows.length < 500 || p > 40) break; }
const byId = new Map(cats.map((c) => [c.id, c]));

const DESDE = Date.parse("2025-11-21T00:00:00Z") / 1000;
const HASTA = Date.parse("2026-09-29T23:59:59Z") / 1000;
const cntWin = new Map<number, number>(), cntAll = new Map<number, number>();
for (const ln of readFileSync(OUT + "/incidents.ndjson", "utf8").split("\n")) {
  if (!ln) continue;
  const r = JSON.parse(ln);
  if (r.c != null) cntAll.set(r.c, (cntAll.get(r.c) ?? 0) + 1);
  if (r.cr >= DESDE && r.cr <= HASTA && r.c != null) cntWin.set(r.c, (cntWin.get(r.c) ?? 0) + 1);
}

const html = readFileSync("docs/categories/Catálogo_MesaDeAyudaTI.html", "utf8");
const s = html.indexOf("window.__ARBOL__ = ") + "window.__ARBOL__ = ".length;
const D = JSON.parse(html.slice(s, html.indexOf("</script>", s)).replace(/;\s*$/, ""));

const isLeafish = (t: string) => t === "leaf" || t === "cur" || t === "int" || t === "dead";
function flat(root: any) { const out: any[] = []; const st = [root]; while (st.length) { const x = st.pop()!; out.push(x); for (const c of x.h ?? []) st.push(c); } return out; }

const report: string[] = [];
const say = (l: string) => { report.push(l); console.log(l); };

// ---- 1. existencia de ids y coherencia padre/hijo ----
say("=== 1. IDs Y JERARQUIA vs /categories ===");
for (const [k, root] of [["actual", D.actual], ["a", D.a], ["b", D.b], ["c", D.c]] as const) {
  const nodes = k === "actual" ? flat(root) : (root as any[]).flatMap((r) => flat(r));
  const missing = nodes.filter((n) => n.id != null && !byId.has(n.id));
  const namMismatch = nodes.filter((n) => n.id != null && byId.has(n.id) && n.n != null && byId.get(n.id)!.name !== n.n);
  let relBad = 0; const relEx: string[] = [];
  const walk = (x: any, parentId: number | null) => {
    for (const c of x.h ?? []) {
      const live = byId.get(c.id);
      if (live && parentId != null && live.parent_category_id !== parentId) { relBad++; if (relEx.length < 5) relEx.push(`[${c.id}] "${c.n}" doc-padre=${parentId} live-padre=${live.parent_category_id} ("${byId.get(live.parent_category_id ?? -1)?.name}")`); }
      walk(c, c.id);
    }
  };
  if (k === "actual") walk(root, root.id); else for (const r of root as any[]) walk(r, null);
  say(`  ${k}: nodos=${nodes.length} ids-inexistentes=${missing.length} nombres-distintos-al-live=${namMismatch.length} padre-incierto=${relBad}`);
  for (const e of relEx) say(`      ${e}`);
  for (const n of missing.slice(0, 8)) say(`      id inexistente [${n.id}] "${n.n}"`);
  for (const n of namMismatch.slice(0, 8)) say(`      nombre [${n.id}] doc="${n.n}" live="${byId.get(n.id)!.name}"`);
}

// ---- 2. volumenes ----
say("\n=== 2. VOLUMENES (doc vs live en ventana) ===");
for (const [k, root] of [["actual", D.actual], ["a", D.a], ["b", D.b], ["c", D.c]] as const) {
  const nodes = k === "actual" ? flat(root) : (root as any[]).flatMap((r) => flat(r));
  const leaves = nodes.filter((n) => isLeafish(n.t));
  let n = 0, ok = 0, dist = 0, sinId = 0; const big: any[] = [];
  for (const l of leaves) {
    if (l.id == null || !byId.has(l.id)) { sinId++; continue; }
    const w = cntWin.get(l.id) ?? 0; n++;
    if (w === l.v) ok++; else { dist++; big.push({ id: l.id, n: l.n, doc: l.v, win: w, all: cntAll.get(l.id) ?? 0 }); }
  }
  const sumaDoc = leaves.reduce((a: number, l: any) => a + (l.v ?? 0), 0);
  const sumaWin = leaves.reduce((a: number, l: any) => a + (byId.has(l.id) ? cntWin.get(l.id) ?? 0 : 0), 0);
  say(`  ${k}: hojas=${leaves.length} con-id-live=${n} iguales=${ok} distintas=${dist} sin-id=${sinId} | suma doc=${sumaDoc} suma live=${sumaWin} (doc meta.volRama=${D.meta.volRama})`);
  for (const b of big.sort((x, y) => Math.abs(y.win - y.doc) - Math.abs(x.win - x.doc)).slice(0, 12)) say(`      [${b.id}] ${String(b.n).slice(0, 40).padEnd(40)} doc=${String(b.doc).padEnd(5)} win=${b.win} all=${b.all}`);
}

// ---- 3. fusiones con volumenes live ----
say("\n=== 3. FUSIONES (mismo nombre bajo el mismo padre) ===");
for (const [k, root] of [["a", D.a], ["b", D.b], ["c", D.c], ["actual", D.actual]] as const) {
  const roots = k === "actual" ? [D.actual] : (root as any[]);
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  let grupos = 0, cats = 0, tkDoc = 0, tkWin = 0;
  for (const r of roots) for (const n of [r, ...flat(r)]) {
    const ch = (n.h ?? []).filter((c: any) => isLeafish(c.t) && c.n);
    const m = new Map<string, any[]>();
    for (const c of ch) { const kk = norm(c.n); m.set(kk, [...(m.get(kk) ?? []), c]); }
    for (const [, arr] of m) if (arr.length > 1) { grupos++; cats += arr.length; for (const c of arr) { tkDoc += c.v ?? 0; tkWin += byId.has(c.id) ? cntWin.get(c.id) ?? 0 : 0; } }
  }
  say(`  ${k}: grupos=${grupos} categorias=${cats} se-eliminan=${cats - grupos} vol(doc)=${tkDoc} vol(live)=${tkWin}`);
}
say(`  doc meta: fusiones=${D.meta.fusiones} volDup=${D.meta.volDup}  (comp: homonimas bajo mismo padre A=0 -> ${D.meta.fusiones})`);

// ---- 4. ejemplos top-30 ----
say("\n=== 4. EJEMPLOS (top-30) rutas ===");
let exOK = 0; const exBad: string[] = [];
for (const e of D.ejemplos) {
  const idOk = e.id == null || byId.has(e.id);
  const w = idOk ? cntWin.get(e.id) ?? 0 : -1;
  if (idOk && w === e.v) exOK++;
  else exBad.push(`  [${e.id}] ${e.v} doc vs ${w} live :: ${e.desde}`);
}
say(`  filas=${D.ejemplos.length} volumen-coincide=${exOK} discrepan=${exBad.length}`);
for (const b of exBad.slice(0, 12)) say(b);
say("  muestra hasta (B): " + D.ejemplos.slice(0, 6).map((e: any) => `${e.id}:${e.v} ${e.hasta}`).join(" || "));
say("  live path real  : " + D.ejemplos.slice(0, 6).map((e: any) => { const c = byId.get(e.id); const p: string[] = []; let x = c; while (x) { p.unshift(x.name); x = x.parent_category_id ? byId.get(x.parent_category_id) : undefined; } return `${e.id}:${cntWin.get(e.id) ?? 0} ${p.join(" > ")}`; }).join(" || "));

// ---- 5. nodos sin uso: actual vs A ----
say("\n=== 5. NODOS SIN USO (ventana) ===");
{
  const actual = flat(D.actual);
  let sinUso = 0, ramasSinUso = 0;
  const st = [D.actual];
  while (st.length) {
    const x = st.pop()!;
    let acc = 0; const s2 = [x];
    while (s2.length) { const y = s2.pop()!; if (isLeafish(y.t)) acc += byId.has(y.id) ? cntWin.get(y.id) ?? 0 : 0; else for (const c of y.h ?? []) s2.push(c); }
    if (acc === 0) { sinUso++; if ((x.h ?? []).length > 0) ramasSinUso++; }
    for (const c of x.h ?? []) st.push(c);
  }
  say(`  actual: nodos=${actual.length} sin-uso=${sinUso} ramas-sin-uso=${ramasSinUso} (doc ${D.meta.nodosHoySinUso} / ${D.meta.ramasSinUso})`);
  say(`  nodo con volumen 0 en ventana pero >0 all-time: ${actual.filter((n) => isLeafish(n.t) && (cntWin.get(n.id) ?? 0) === 0 && (cntAll.get(n.id) ?? 0) > 0).length}`);
}

writeFileSync(OUT + "/estructura.txt", report.join("\n"), "utf8");
console.log("\n-> " + OUT + "/estructura.txt");