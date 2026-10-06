import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
const KEY = process.env.INVGATE_API_KEY ?? ""; const BASE = process.env.INVGATE_BASE_URL ?? "";
const AUTH = "Basic " + Buffer.from((process.env.INVGATE_API_USERNAME || "portalmda") + ":" + KEY).toString("base64");
const OUT = "C:/Users/irevainera/AppData/Local/Temp/opencode/reval";
async function api<T = any>(p: string): Promise<T> { const c = new AbortController(); const t = setTimeout(() => c.abort(), 180000); try { const r = await fetch(`${BASE}${p}`, { headers: { Authorization: AUTH }, signal: c.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); } }
type Cat = { id: number; name: string; parent_category_id: number | null };
const cats: Cat[] = []; for (let p = 1; ; p++) { const r = await api<Cat[]>(`categories?page=${p}&page_size=500`); cats.push(...r); if (r.length < 500 || p > 40) break; }
const byId = new Map(cats.map((c) => [c.id, c]));
const kids = new Map<number, Cat[]>(); for (const c of cats) { if (c.parent_category_id == null) continue; const a = kids.get(c.parent_category_id) ?? []; a.push(c); kids.set(c.parent_category_id, a); }
const depth = new Map<number, number>(); const pmap = new Map<number, string>();
{ const st = [2]; depth.set(2, 0); pmap.set(2, byId.get(2)!.name); while (st.length) { const cur = st.pop()!; for (const k of kids.get(cur) ?? []) { depth.set(k.id, depth.get(cur)! + 1); pmap.set(k.id, (pmap.get(cur) ?? "") + " > " + k.name); st.push(k.id); } } }
const ramaIds = new Set(depth.keys());
const ramaLeaves = new Set(cats.filter((c) => ramaIds.has(c.id) && (kids.get(c.id)?.length ?? 0) === 0).map((c) => c.id));
const DESDE = Date.parse("2025-11-21T00:00:00Z") / 1000, HASTA = Date.parse("2026-09-29T23:59:59Z") / 1000;
const rows: any[] = readFileSync(OUT + "/incidents.ndjson", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const rw = rows.filter((r) => r.c != null && ramaIds.has(r.c) && r.cr >= DESDE && r.cr <= HASTA);
const L: string[] = []; const say = (l: string) => { L.push(l); console.log(l); };
const pct = (n: number, d: number) => ((n / d) * 100).toFixed(1);

say("=== 1. 'RESUELTOS' Y 'ABIERTOS' (doc: 89,8% resueltos / 10,2% = 1212 abiertos) ===");
{
  const solved = rw.filter((r) => r.so != null && r.so > 0);
  say(`  rama+ventana = ${rw.length}`);
  say(`  con solved_at = ${solved.length} -> ${pct(solved.length, rw.length)}%   (doc 89,8%)`);
  say(`  sin solved_at = ${rw.length - solved.length} -> ${pct(rw.length - solved.length, rw.length)}%   (doc 10,2% = 1212)`);
  const st = new Map<number, number>(); for (const r of rw) st.set(r.s, (st.get(r.s) ?? 0) + 1);
  say(`  por status_id: ${[...st.entries()].sort().map(([k, v]) => `${k}=${v}`).join(" ")}`);
  const stAll = new Map<number, number>(); for (const r of rw) if (r.s <= 4) stAll.set(r.s, (stAll.get(r.s) ?? 0) + 1);
  say(`  status<=4 (de verdad abiertos hoy): ${rw.filter((r) => r.s <= 4).length} = ${pct(rw.filter((r) => r.s <= 4).length, rw.length)}%`);
  say(`  => el 10,2% del informe = tickets SIN solved_at, no "abiertos hoy"`);
}

say("\n=== 2. TIEMPO A RESOLVER, denominador rama completa (doc: 46,2% <=15 min / 37,3% <=1 min) ===");
{
  const solved = rw.filter((r) => r.so != null && r.so > 0);
  const le15 = rw.filter((r) => r.so != null && r.so > 0 && r.so - r.cr <= 900).length;
  const le1 = rw.filter((r) => r.so != null && r.so > 0 && r.so - r.cr <= 60).length;
  say(`  <=15 min / rama        = ${le15}/${rw.length} = ${pct(le15, rw.length)}%   (doc 46,2%)`);
  say(`  <=1 min  / rama        = ${le1}/${rw.length} = ${pct(le1, rw.length)}%   (doc 37,3%)`);
  say(`  <=15 min / solo resueltos = ${pct(le15, solved.length)}%`);
  say(`  <=1 min  / solo resueltos = ${pct(le1, solved.length)}%`);
  const cl = rw.filter((r) => r.cl != null && r.cl > 0);
  say(`  (con closed_at: ${cl.length}; <=15min/closed = ${pct(rw.filter((r) => r.cl != null && r.cl > 0 && r.cl - r.cr <= 900).length, cl.length)}%)`);
}

say("\n=== 3. PROFUNDIDAD vs TIEMPO (doc §6: <=5 sel = 106,4 h ; >=6 sel = 38,1 h) ===");
{
  const solved = rw.filter((r) => r.so != null && r.so > 0);
  const h = (r: any) => (r.so! - r.cr) / 3600;
  for (const k of [4, 5, 6, 7]) {
    const lo = solved.filter((r) => depth.get(r.c)! <= k), hi = solved.filter((r) => depth.get(r.c)! >= k + 1);
    const m = (a: any[]) => (a.length ? (a.reduce((s, r) => s + h(r), 0) / a.length).toFixed(1) : "-");
    say(`  <=${k} sel (depth<=${k}): n=${String(lo.length).padStart(5)} media=${m(lo)} h   |   >=${k + 1} sel: n=${String(hi.length).padStart(5)} media=${m(hi)} h`);
  }
  say("  doc: <=5 sel = 106,4 h (n?) ; >=6 sel = 38,1 h");
  say(`  depth>=6 (>=6 sel) n=${solved.filter((r) => depth.get(r.c)! >= 6).length} media=${(solved.filter((r) => depth.get(r.c)! >= 6).reduce((s, r) => s + h(r), 0) / Math.max(1, solved.filter((r) => depth.get(r.c)! >= 6).length)).toFixed(1)} h`);
}

say("\n=== 4. FUENTES rama+ventana (doc: 62,4% telefono) ===");
{
  const m = new Map<number, number>(); for (const r of rw) m.set(r.src, (m.get(r.src) ?? 0) + 1);
  say(`  ${[...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `src${k}=${v} (${pct(v, rw.length)}%)`).join("  ")}`);
  say("  src: 1=Correo 2=Telefono 3=Web 4=Chat 8=API  (confirmar con incident.attributes.source)");
  const src = await api<Array<{ id: number; name: string }>>("incident.attributes.source");
  say(`  catálogos: ${src.map((s) => `${s.id}=${s.name}`).join(", ")}`);
}

say("\n=== 5. GENERICOS Y SIN USO (doc: 12 'Consulta', 13 'Fallas', 377 sin uso, 227 ramas) ===");
{
  const normSp = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const cnt = new Map<number, number>(), cntAll = new Map<number, number>();
  for (const r of rw) cnt.set(r.c, (cnt.get(r.c) ?? 0) + 1);
  for (const r of rows.filter((r) => r.c != null && ramaIds.has(r.c))) cntAll.set(r.c, (cntAll.get(r.c) ?? 0) + 1);
  const lv = [...ramaLeaves].map((id) => ({ id, n: byId.get(id)?.name ?? "", v: cnt.get(id) ?? 0, a: cntAll.get(id) ?? 0 }));
  for (const t of ["consulta", "falla", "falla general", "error", "consulta general", "falla en sistema", "no enciende", "la pc no funciona", "otro equipo roto o faltante"]) say(`  hoja exacta "${t}" = ${lv.filter((x) => normSp(x.n) === t).length}`);
  const porN = new Map<string, number>(); for (const l of lv) porN.set(normSp(l.n), (porN.get(normSp(l.n)) ?? 0) + 1);
  say(`  hojas con nombre repetido en >1 categoria = ${[...porN.values()].filter((n) => n > 1).reduce((a, b) => a + b, 0)}  grupos=${[...porN.values()].filter((n) => n > 1).length}`);
  say(`  mas repetidos: ${[...porN.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}=${n}`).join(", ")}`);
  const vol = (x: any) => x.v > 0; say(`  hojas con 0 tk en ventana pero >0 all-time = ${lv.filter((x) => x.v === 0 && x.a > 0).length}`);
  let sinUso = 0, ramas = 0, dead = 0;
  const st = [2]; while (st.length) { const x = st.pop()!; let acc = 0; const s2 = [x]; while (s2.length) { const y = s2.pop()!; if (!kids.get(y.id)?.length) acc += cnt.get(y.id) ?? 0; else for (const k of kids.get(y.id) ?? []) s2.push(k); } if (acc === 0) { sinUso++; if (kids.get(x.id)?.length) ramas++; else dead++; } for (const k of kids.get(x.id) ?? []) st.push(k); }
  say(`  sin uso (incl raiz) = ${sinUso} (doc 377) ; ramas sin uso = ${ramas} (doc 227) ; hojas muertas = ${dead} (doc 150)`);
  const sinUsoExRaiz = sinUso - ((() => { let a = 0; const s2 = [2]; while (s2.length) { const y = s2.pop()!; if (!kids.get(y.id)?.length) a += cnt.get(y.id) ?? 0; else for (const k of kids.get(y.id) ?? []) s2.push(k); } return a === 0 ? 1 : 0; })());
  say(`  sin uso excluyendo raiz = ${sinUsoExRaiz}`);
}

say("\n=== 6. 'REpite NOMBRE DEL PADRE' -> buscar la regla que da 72 ===");
{
  const normSp = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nv = (s: string) => normSp(s).replace(/ /g, "");
  const reglas: Record<string, (a: string, b: string) => boolean> = {
    "normalizado identico": (a, b) => normSp(a) === normSp(b),
    "normalizado sin espacios identico": (a, b) => nv(a) === nv(b),
    "hoja empieza con nombre del padre": (a, b) => nv(a).length >= 3 && nv(b).startsWith(nv(a)),
    "nombre del padre contenido en la hoja": (a, b) => normSp(a).length >= 4 && normSp(b).includes(normSp(a)),
    "alguna palabra del padre (>=4) esta en la hoja": (a, b) => normSp(a).split(" ").some((w) => w.length >= 4 && normSp(b).includes(w)),
    "hoja empieza con alguna palabra del padre": (a, b) => normSp(a).split(" ").some((w) => w.length >= 4 && nv(b).startsWith(nv(w))),
    "ultima palabra del padre es prefijo de la hoja": (a, b) => { const w = normSp(a).split(" ").pop() ?? ""; return w.length >= 4 && nv(b).startsWith(nv(w)); },
    "primera palabra del padre es prefijo": (a, b) => { const w = normSp(a).split(" ")[0] ?? ""; return w.length >= 4 && nv(b).startsWith(nv(w)); },
    "normalizado identico tras quitar el prefijo del padre": (a, b) => nv(b) !== nv(a) && nv(b).startsWith(nv(a)),
    "hoja contiene el padre como subpalabra completa": (a, b) => normSp(a).length >= 3 && normSp(b).split(" ").includes(normSp(a)),
  };
  for (const [nom, f] of Object.entries(reglas)) {
    let n = 0; const ex: string[] = [];
    for (const id of ramaIds) for (const c of kids.get(id) ?? []) { if (kids.get(c.id)?.length) continue; if (f(byId.get(id)?.name ?? "", c.name)) { n++; if (ex.length < 3) ex.push(`${byId.get(id)?.name} > ${c.name}`); } }
    say(`  ${n === 72 ? "*** " : "    "}${nom.padEnd(50)} = ${n}${n === 72 ? "   ej: " + ex.join(" ; ") : ""}`);
  }
  say("  (si ninguna da 72, el 72 del informe puede contar NODOS, no solo hojas, o incluir internos)");
  let nodos = 0; const ex2: string[] = [];
  for (const id of ramaIds) for (const c of kids.get(id) ?? []) if (normSp(byId.get(id)?.name ?? "") === normSp(c.name)) { nodos++; if (ex2.length < 6) ex2.push(`${byId.get(id)?.name} > ${c.name}${kids.get(c.id)?.length ? " (interno)" : ""}`); }
  say(`  nodos (cualquier tipo) con nombre identico al padre = ${nodos} : ${ex2.join(" ; ")}`);
}

writeFileSync(OUT + "/informe.txt", L.join("\n"), "utf8");