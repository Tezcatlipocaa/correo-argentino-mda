import "dotenv/config";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const OUT = "C:/Users/irevainera/AppData/Local/Temp/opencode/reval";
const DIR = "docs/categories";
const f = readdirSync(DIR).find((x) => x.endsWith("_MesaDeAyudaTI.html") && !x.includes("Informe"))!;
const html = readFileSync(`${DIR}/${f}`, "utf8");
const s0 = html.indexOf("window.__ARBOL__ = ") + "window.__ARBOL__ = ".length;
const D = JSON.parse(html.slice(s0, html.indexOf("</script>", s0)).replace(/;\s*$/, ""));
const L: string[] = []; const say = (l: string) => { L.push(l); console.log(l); };
const flat = (r: any) => { const o: any[] = []; const st = [r]; while (st.length) { const x = st.pop()!; o.push(x); for (const c of x.h ?? []) st.push(c); } return o; };

const KEY = process.env.INVGATE_API_KEY ?? "", BASE = process.env.INVGATE_BASE_URL ?? "";
const AUTH = "Basic " + Buffer.from((process.env.INVGATE_API_USERNAME || "portalmda") + ":" + KEY).toString("base64");
async function api(p: string): Promise<any> { const c = new AbortController(); const t = setTimeout(() => c.abort(), 180000); try { const r = await fetch(`${BASE}${p}`, { headers: { Authorization: AUTH }, signal: c.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); } }
const cats: any[] = []; for (let p = 1; ; p++) { const r = await api(`categories?page=${p}&page_size=500`); cats.push(...r); if (r.length < 500 || p > 40) break; }
const byId = new Map<number, any>(cats.map((c) => [c.id, c]));
const kids = new Map<number, any[]>(); for (const c of cats) { if (c.parent_category_id == null) continue; const a = kids.get(c.parent_category_id) ?? []; a.push(c); kids.set(c.parent_category_id, a); }
const depth = new Map<number, number>(); { const st = [2]; depth.set(2, 0); while (st.length) { const cur = st.pop()!; for (const k of kids.get(cur) ?? []) { depth.set(k.id, depth.get(cur)! + 1); st.push(k.id); } } }
const ramaIds = new Set(depth.keys());
const rows: any[] = readFileSync(OUT + "/incidents.ndjson", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const DESDE = Date.parse("2025-11-21T00:00:00Z") / 1000, HASTA = Date.parse("2026-09-29T23:59:59Z") / 1000;

say("=== 1. §6: hipotesis 'selecciones = depth+1' sobre TODOS los incidentes en ventana ===");
{
  const sv = rows.filter((r) => r.cr >= DESDE && r.cr <= HASTA && r.so != null && r.so > 0);
  const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "-");
  const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)].toFixed(1) : "-"; };
  const sel = (r: any) => (ramaIds.has(r.c) ? (depth.get(r.c) ?? 0) + 1 : 1);
  for (const k of [5, 6]) {
    const lo = sv.filter((r) => sel(r) <= k).map((r) => (r.so! - r.cr) / 3600);
    const hi = sv.filter((r) => sel(r) >= k + 1).map((r) => (r.so! - r.cr) / 3600);
    say(`  seleccion<=${k}: n=${lo.length} prom=${avg(lo)}h med=${med(lo)}h | seleccion>=${k + 1}: n=${hi.length} prom=${avg(hi)}h med=${med(hi)}h`);
  }
  say("  doc: <=5 = 106,4 h ; >=6 = 38,1 h   <-- objetivo 106,4 / 38,1");
}

say("\n=== 2. volumenes de las hojas del arbol actual (doc) vs live ===");
{
  const actLeaf = new Map<number, number>(); for (const n of flat(D.actual)) if (n.t === "cur" && !kids.get(n.id)?.length) actLeaf.set(n.id, n.v);
  const cnt = new Map<number, number>(); for (const r of rows) if (r.c != null && ramaIds.has(r.c) && r.cr >= DESDE && r.cr <= HASTA) cnt.set(r.c, (cnt.get(r.c) ?? 0) + 1);
  say(`  hojas en el HTML = ${actLeaf.size}; ids nonull=${[...actLeaf.keys()].filter((i) => i != null).length}; suma v=${[...actLeaf.values()].reduce((a, b) => a + b, 0)}`);
  let diff = 0; const sample: string[] = [];
  for (const [id, v] of actLeaf) { const live = cnt.get(id) ?? 0; if (live !== v) { diff++; if (sample.length < 8) sample.push(`[${id}] "${byId.get(id)?.name}" doc=${v} live=${live}`); } }
  say(`  hojas con volumen distinto = ${diff}/${actLeaf.size}`);
  sample.forEach((s) => say(`     ${s}`));
}

say("\n=== 3. propuestas A/B/C: ids reales de InvGate y coherencia de volumen ===");
{
  const actLeaf = new Map<number, number>(); for (const n of flat(D.actual)) if (n.t === "cur" && !kids.get(n.id)?.length) actLeaf.set(n.id, n.v);
  for (const [k, roots] of [["a", D.a], ["b", D.b], ["c", D.c]] as const) {
    const nodes = (roots as any[]).flatMap((r) => flat(r));
    const leaves = nodes.filter((n: any) => n.t === "leaf" || n.t === "int" || n.t === "dead");
    const ids = leaves.map((n: any) => (n.id == null ? null : Number(n.id)));
    const uniq = new Set(ids.filter((x) => x != null));
    const inCat = [...uniq].filter((i) => byId.has(i)).length;
    const inHoja = [...uniq].filter((i) => actLeaf.has(i)).length;
    let same = 0, dist = 0; const bad: string[] = [];
    for (const n of leaves) { if (n.id == null) continue; const id = Number(n.id); const a = actLeaf.get(id); if (a == null) continue; if (a === n.v) same++; else { dist++; if (bad.length < 6) bad.push(`[${id}] "${byId.get(id)?.name}" actual=${a} propuesta=${n.v}`); } }
    // nombres propuestos vs nombre real en InvGate
    let nomIgual = 0, nomDistinto = 0; const ej: string[] = [];
    for (const n of leaves) { if (n.id == null || !byId.has(Number(n.id))) continue; const real = byId.get(Number(n.id)).name; if (real === n.n) nomIgual++; else { nomDistinto++; if (ej.length < 5) ej.push(`[${n.id}] propuesta="${n.n}" invgate="${real}"`); } }
    // nombres repetidos entre props
    const porNom = new Map<string, number>(); for (const n of leaves) if (n.n) porNom.set(n.n, (porNom.get(n.n) ?? 0) + 1);
    const rep = [...porNom.entries()].filter(([, c]) => c > 1).length;
    // fusiones (mismo nombre bajo mismo padre)
    let grupos = 0, cat = 0, elim = 0, vol = 0;
    for (const n of nodes) { const ch = (n.h ?? []).filter((x: any) => x.t === "leaf"); const m = new Map<string, any[]>(); for (const c2 of ch) if (c2.n) { const a = m.get(c2.n) ?? []; a.push(c2); m.set(c2.n, a); } for (const [, b] of m) if (b.length > 1) { grupos++; cat += b.length; elim += b.length - 1; const top = b.slice().sort((a, b2) => b2.v - a.v); vol += top.slice(1).reduce((a, x) => a + x.v, 0); } }
    say(`  ${k.toUpperCase()}: nodos=${nodes.length} hojas=${leaves.length} ids unicos=${uniq.size} en /categories=${inCat} en hoja del arbol actual=${inHoja}`);
    say(`      volumen total hojas=${leaves.reduce((a: number, n: any) => a + (n.v ?? 0), 0)} | volumen igual al actual=${same} distinto=${dist}`);
    bad.forEach((s) => say(`         ${s}`));
    say(`      nombre proposed == InvGate: ${nomIgual} distintos=${nomDistinto} | nombres repetidos entre hojas=${rep}`);
    ej.forEach((s) => say(`         ${s}`));
    say(`      fusiones (mismo nombre bajo mismo padre): grupos=${grupos} categorias=${cat} se eliminan=${elim} volumen=${vol}`);
  }
  say(`  meta.fusiones=${D.meta.fusiones} meta.volDup=${D.meta.volDup} nodosA=${D.meta.nodosA} nodosB=${D.meta.nodosB} nodosC=${D.meta.nodosC}`);
}
writeFileSync(OUT + "/propuestas.txt", L.join("\n"), "utf8");