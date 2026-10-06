import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const KEY = process.env.INVGATE_API_KEY ?? "";
const BASE = process.env.INVGATE_BASE_URL ?? "";
const AUTH = "Basic " + Buffer.from((process.env.INVGATE_API_USERNAME || "portalmda") + ":" + KEY).toString("base64");
const OUT = process.env.REVAL_OUT ?? "C:/Users/irevainera/AppData/Local/Temp/opencode/reval";
mkdirSync(OUT, { recursive: true });

async function api<T = any>(path: string, ms = 180000, tries = 3): Promise<T> {
  for (let a = 1; ; a++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(`${BASE}${path}`, { headers: { Authorization: AUTH }, signal: ctl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      if (a >= tries) throw e;
      await new Promise((r) => setTimeout(r, 800 * a));
    } finally { clearTimeout(t); }
  }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cur = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (;;) { const i = cur++; if (i >= items.length) return; out[i] = await fn(items[i], i); }
  }));
  return out;
}

const t0 = Date.now();
const ts = () => ((Date.now() - t0) / 1000).toFixed(0) + "s";

// ---------- 1. categorías ----------
type Cat = { id: number; name: string; parent_category_id: number | null };
const cats: Cat[] = [];
for (let p = 1; ; p++) {
  const rows = await api<Cat[]>(`categories?page=${p}&page_size=500`);
  cats.push(...rows);
  if (rows.length < 500 || p > 40) break;
}
const byId = new Map(cats.map((c) => [c.id, c]));
const kids = new Map<number, Cat[]>();
for (const c of cats) {
  if (c.parent_category_id == null) continue;
  const a = kids.get(c.parent_category_id) ?? [];
  a.push(c);
  kids.set(c.parent_category_id, a);
}
const ROOT = 2;
console.log(`[${ts()}] categorias=${cats.length} raices=${cats.filter((c) => !byId.has(c.parent_category_id ?? -1)).length}`);

const depth = new Map<number, number>();
const path = new Map<number, string>();
{
  const st: number[] = [ROOT];
  depth.set(ROOT, 1);
  path.set(ROOT, byId.get(ROOT)?.name ?? "");
  while (st.length) {
    const cur = st.pop()!;
    for (const k of kids.get(cur) ?? []) {
      depth.set(k.id, (depth.get(cur) ?? 1) + 1);
      path.set(k.id, (path.get(cur) ?? "") + " > " + k.name);
      st.push(k.id);
    }
  }
}
const ramaIds = new Set(depth.keys());
const ramaLeaves = cats.filter((c) => ramaIds.has(c.id) && (kids.get(c.id)?.length ?? 0) === 0).map((c) => c.id);
const leafSet = new Set(ramaLeaves);

// ---------- 2. ids de incidentes ----------
const STATUSES = [1, 2, 3, 4, 5, 6, 7, 8];
const sq = STATUSES.map((s) => `status_ids[]=${s}`).join("&");
const head = await api<{ requestIds: number[]; total: number }>(`incidents.by.status?${sq}&limit=500&offset=0`);
const totalAll = head.total;
const offsets: number[] = [];
for (let o = 500; o < totalAll; o += 500) offsets.push(o);
console.log(`[${ts()}] by.status total=${totalAll} paginas=${offsets.length + 1}`);
const pages = await pool(offsets, 6, async (o) => (await api<{ requestIds: number[] }>(`incidents.by.status?${sq}&limit=500&offset=${o}`)).requestIds);
const allIds = Array.from(new Set([...head.requestIds, ...pages.flat()]));
console.log(`[${ts()}] ids unicos=${allIds.length}`);

// ---------- 3. hydrate ----------
type Row = { id: number; c: number | null; s: number; cr: number; so: number | null; cl: number | null; src: number; ty: number; loc: number | null };
const chunks: number[][] = [];
for (let i = 0; i < allIds.length; i += 200) chunks.push(allIds.slice(i, i + 200));
console.log(`[${ts()}] hydrate ${chunks.length} chunks de 200 (conc 6)`);
let done = 0;
const rows: Row[] = [];
await pool(chunks, 6, async (ch) => {
  const d = await api<Record<string, any>>("incidents?ids[]=" + ch.join("&ids[]="));
  for (const k of Object.keys(d)) {
    const o = d[k];
    rows.push({ id: o.id, c: o.category_id ?? null, s: o.status_id, cr: o.created_at, so: o.solved_at ?? null, cl: o.closed_at ?? null, src: o.source_id, ty: o.type_id, loc: o.location_id ?? null });
  }
  if (++done % 40 === 0) console.log(`[${ts()}] ${done}/${chunks.length} chunks, ${rows.length} incidentes`);
});
console.log(`[${ts()}] incidentes hidratados=${rows.length}`);
writeFileSync(join(OUT, "incidents.ndjson"), rows.map((r) => JSON.stringify(r)).join("\n"));

// ---------- 4. agregado ----------
const DESDE = Date.parse("2025-11-21T00:00:00Z") / 1000;
const HASTA = Date.parse("2026-09-29T23:59:59Z") / 1000;
const cntAll = new Map<number, number>();
const cntWin = new Map<number, number>();
let winCount = 0;
for (const r of rows) {
  if (r.c != null) cntAll.set(r.c, (cntAll.get(r.c) ?? 0) + 1);
  if (r.cr >= DESDE && r.cr <= HASTA) {
    winCount++;
    if (r.c != null) cntWin.set(r.c, (cntWin.get(r.c) ?? 0) + 1);
  }
}
const volRamaWin = ramaLeaves.reduce((a, id) => a + (cntWin.get(id) ?? 0), 0);
const volRamaAll = ramaLeaves.reduce((a, id) => a + (cntAll.get(id) ?? 0), 0);

// topological: volumen de un nodo = suma de su hojas
const leafOf = new Map<number, number>();
for (const id of ramaIds) {
  let acc = 0;
  const st = [id];
  while (st.length) { const c = st.pop()!; if (leafSet.has(c)) acc += cntWin.get(c) ?? 0; else for (const k of kids.get(c) ?? []) st.push(k); }
  leafOf.set(id, acc);
}
let nodesSinUso = 0, ramasSinUso = 0, unHijo = 0, interConTk = 0, repitePadre = 0;
for (const id of ramaIds) {
  const v = leafOf.get(id) ?? 0;
  if (v === 0) {
    nodesSinUso++;
    if ((kids.get(id)?.length ?? 0) === 0) { /* deadHojas */ }
    else ramasSinUso++;
  }
  const k = kids.get(id)?.length ?? 0;
  if (k === 1) unHijo++;
  if (k > 0 && v > 0) { /* inter con tickets propios */ }
  if (k > 0 && cntWin.get(id) != null && cntWin.get(id)! > 0) interConTk++;
  if (k > 0) {
    const pn = norm(byId.get(id)?.name ?? "");
    const nk = kids.get(id)!.filter((x) => norm(x.name) === pn);
    if (nk.length > 0) repitePadre += nk.length;
  }
}
function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const deadHojas = ramaLeaves.filter((id) => (cntWin.get(id) ?? 0) === 0).length;

// selecciones = profundidad de la categoria del incidente
let selSum = 0, selN = 0, sel6 = 0;
for (const r of rows) {
  if (r.c == null || !ramaIds.has(r.c)) continue;
  selSum += depth.get(r.c)!; selN++;
  if (depth.get(r.c)! >= 6) sel6++;
}
// tiempos
const win = rows.filter((r) => r.cr >= DESDE && r.cr <= HASTA);
const solved = win.filter((r) => r.so != null && r.so > 0);
const le15 = solved.filter((r) => r.so! - r.cr <= 900).length;
const le1 = solved.filter((r) => r.so! - r.cr <= 60).length;
const openWin = win.filter((r) => r.s <= 4).length;
// concentración
const leafVols = ramaLeaves.map((id) => ({ id, n: byId.get(id)?.name ?? "", v: cntWin.get(id) ?? 0 })).sort((a, b) => b.v - a.v);
const sumaTop = (k: number) => leafVols.slice(0, k).reduce((a, x) => a + x.v, 0);
const hist = { "0": 0, "1-9": 0, "10-49": 0, "50-199": 0, "200+": 0 };
for (const x of leafVols) { const v = x.v; if (v === 0) hist["0"]++; else if (v < 10) hist["1-9"]++; else if (v < 50) hist["10-49"]++; else if (v < 200) hist["50-199"]++; else hist["200+"]++; }
// mensual
const mes = new Map<string, number>();
for (const r of win) { const k = new Date(r.cr * 1000).toISOString().slice(0, 7); mes.set(k, (mes.get(k) ?? 0) + 1); }
// fuentes
const src = new Map<number, number>();
for (const r of win) src.set(r.src, (src.get(r.src) ?? 0) + 1);

// ---------- 5. diff vs HTML ----------
const html = readFileSync("docs/categories/Catálogo_MesaDeAyudaTI.html", "utf8");
const s = html.indexOf("window.__ARBOL__ = ") + "window.__ARBOL__ = ".length;
const D = JSON.parse(html.slice(s, html.indexOf("</script>", s)).replace(/;\s*$/, ""));
const M = D.meta;

const nJson = (() => { let n = 0; const st = [D.actual]; while (st.length) { const x = st.pop()!; n++; for (const c of x.h ?? []) st.push(c); } return n; })();

const cmp = (name: string, doc: unknown, live: unknown) => console.log(`${String(doc) === String(live) ? "OK  " : "DIFF"} ${name.padEnd(34)} doc=${String(doc).padEnd(10)} live=${live}`);

console.log("\n=== ESTRUCTURA ===");
cmp("categorias totales", 2884, cats.length);
cmp("raices", 13, cats.filter((c) => !byId.has(c.parent_category_id ?? -1)).length);
cmp("nodos subarbol 2 (excl raiz)", M.nodosHoy, ramaIds.size - 1);
cmp("nodos subarbol 2 (incl raiz)", nJson, ramaIds.size);
cmp("hojas subarbol 2", M.hojasHoy, ramaLeaves.length);
cmp("hojas muertas (0 tk ventana)", M.deadHojas, deadHojas);
cmp("nodos sin uso", M.nodosHoySinUso, nodesSinUso);
cmp("ramas sin uso", M.ramasSinUso, ramasSinUso);
cmp("nodos de un solo hijo", 39, unHijo);
cmp("hojas que repiten nombre del padre", 72, repitePadre);
cmp("intermedios con tickets propios", 2, interConTk);
cmp("profundidad max", 7, Math.max(...depth.values()) - 1);
console.log("\n=== VOLUMEN ===");
cmp("meta.total (todos los estados)", M.total, rows.length);
cmp("incidentes creados en la ventana", 86300, winCount);
cmp("volRama (hojas rama, ventana)", M.volRama, volRamaWin);
console.log(`     volRama all-time = ${volRamaAll}`);
cmp("promedio selecciones", 4.71, (selSum / selN).toFixed(2));
cmp("tickets con >=6 selecciones", 552, sel6);
cmp("abiertos hoy (s<=4) en ventana", 1212, openWin);
cmp("resueltos (solved_at) %", 89.8, ((solved.length / win.length) * 100).toFixed(1));
cmp("<=15 min %", 46.2, ((le15 / solved.length) * 100).toFixed(1));
cmp("<=1 min %", 37.3, ((le1 / solved.length) * 100).toFixed(1));
console.log("\n=== CONCENTRACION ===");
for (const k of [5, 10, 20, 50]) { const v = sumaTop(k); console.log(`     top${k} = ${v} (${((v / volRamaWin) * 100).toFixed(1)}%) doc=${k === 5 ? 2980 : k === 10 ? 4645 : k === 20 ? 6635 : 9308}`); }
console.log("     histograma live:", JSON.stringify(hist), "\n     histograma doc : {\"0\":150,\"1-9\":214,\"10-49\":74,\"50-199\":39,\"200+\":13}");
console.log("     mensual live:", [...mes.entries()].sort().map(([k, v]) => `${k}=${v}`).join(" "));
console.log("     mensual doc : 2025-11=486 2025-12=1574 2026-01=1316 2026-02=751 2026-03=1148 2026-04=726 2026-05=975 2026-06=1074 2026-07=1500 2026-08=1253 2026-09=1072");
console.log("     fuentes live:", [...src.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}=${v}`).join(" "));

// ---------- 6. diff por hoja del arbol actual ----------
const liveLeaf = new Map<number, number>();
for (const id of ramaLeaves) liveLeaf.set(id, cntWin.get(id) ?? 0);
let cmpN = 0, cmpOK = 0;
const diffs: Array<{ id: number; n: string; doc: number; win: number; all: number }> = [];
const st2: any[] = [D.actual];
while (st2.length) {
  const x = st2.pop()!;
  for (const c of x.h ?? []) {
    st2.push(c);
    const isLeafish = c.t === "leaf" || c.t === "cur" || c.t === "int" || c.t === "dead";
    if (!isLeafish) continue;
    const w = liveLeaf.get(c.id);
    if (w == null) continue;
    cmpN++; if (w === c.v) cmpOK++; else diffs.push({ id: c.id, n: c.n ?? "(null)", doc: c.v, win: w, all: cntAll.get(c.id) ?? 0 });
  }
}
console.log(`\n=== POR HOJA (volumen en ventana vs doc) ===  comparadas=${cmpN} iguales=${cmpOK} distintas=${diffs.length}`);
const porDelta = diffs.reduce((a, d) => a + (d.win - d.doc), 0);
console.log(`     delta neto = ${porDelta}`);
for (const d of diffs.sort((a, b) => Math.abs(b.win - b.doc) - Math.abs(a.win - a.doc)).slice(0, 40)) console.log(`     [${d.id}] ${String(d.n).slice(0, 42).padEnd(42)} doc=${String(d.doc).padEnd(5)} win=${d.win} all=${d.all}`);
writeFileSync(join(OUT, "leaf-diffs.json"), JSON.stringify(diffs, null, 1));
writeFileSync(join(OUT, "per-category.json"), JSON.stringify({ cntWin: [...cntWin.entries()], cntAll: [...cntAll.entries()], winCount, totalAll, rows: rows.length }));
console.log(`\n[${ts()}] listo. artefactos en ${OUT}`);