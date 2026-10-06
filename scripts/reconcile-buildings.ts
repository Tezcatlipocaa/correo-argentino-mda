import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { offices, auditLogs } from "../src/db/schema";
import {
  groupOfficesByBuilding,
  type BuildingCandidateGroup,
} from "../src/lib/officeBuildingReconcile";

const normalizeSearch = (value: string): string =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function printHelp() {
  console.log(`
Reconciliación de oficinas del mismo edificio
=============================================

Uso: tsx src/scripts/reconcile-buildings.ts [opciones]

Opciones:
  --apply            Aplica los cambios (pide CONFIRMAR). Sin esto solo releva.
  --only <key>       Solo unifica el grupo con esa clave. Repetible.
  --interactive      Pregunta sí/no por cada grupo (escribir CONFIRMAR).
  --province <code>  Filtra por provincia (ej. C, BA, o "all" para todas).
  --export <file>   Vuelca el reporte de grupos a CSV.
  --help             Muestra esta ayuda.

Ejemplos:
  # 1) Relevar todos los grupos candidatos
  npm run buildings:reconcile

  # 2) Revisar reporte antes de decidir
  npm run buildings:reconcile -- --export reporte.csv

  # 3) Unificar SOLO algunos grupos (por clave, del reporte)
  npm run buildings:reconcile -- --apply --only "1349|JUAN+SAN" --only "3443|GOBERNADOR+VALENTIN+VERGARA"

  # 4) Unificar grupo a grupo, decidiendo en cada uno
  npm run buildings:reconcile -- --apply --interactive

Notas:
  - Sin --apply el script NO modifica la base de datos.
  - --apply pide CONFIRMAR global; luego aplica --only/--interactive.
  - Antes de escribir se hace backup automático en database/backups/.
`);
}

function parseArgs(argv: string[]) {
  const args = {
    apply: false,
    province: undefined as string | undefined,
    exportCsv: undefined as string | undefined,
    interactive: false,
    only: [] as string[],
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--apply") args.apply = true;
    else if (arg === "--interactive") args.interactive = true;
    else if (arg === "--province") args.province = argv[++i];
    else if (arg === "--export") args.exportCsv = argv[++i];
    else if (arg === "--only") args.only.push(argv[++i]);
  }
  return args;
}

async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${message}\nEscriba CONFIRMAR para continuar: `, (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === "CONFIRMAR");
    });
  });
}

function backupDatabase() {
  const dbPath = path.join(process.cwd(), "database", "mda.db");
  const backupDir = path.join(process.cwd(), "database", "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(backupDir, `mda-reconcile-${stamp}.db`);
  fs.copyFileSync(dbPath, dest);
  console.log(`Backup creado: ${dest}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const rows = await db
    .select({
      id: offices.id,
      code: offices.code,
      name: offices.name,
      address: offices.address,
      provinceCode: offices.provinceCode,
    })
    .from(offices);

  const candidates = groupOfficesByBuilding(
    rows.flatMap((r) =>
      r.address
        ? [
            {
              id: r.id,
              code: r.code,
              name: r.name,
              address: r.address,
              provinceCode: r.provinceCode,
            },
          ]
        : [],
    ),
  );

  const scoped =
    args.province && args.province !== "all"
      ? candidates.filter((g) =>
          g.members.every((m) => m.provinceCode === args.province),
        )
      : candidates;

  const totalOffices = scoped.reduce((n, g) => n + g.members.length, 0);
  console.log(
    `\nGrupos candidatos de mismo edificio: ${scoped.length} (${totalOffices} oficinas)\n`,
  );

  const scope =
    args.only.length > 0
      ? scoped.filter((c) => args.only.includes(c.key))
      : scoped;

  const list = args.apply ? scope : scoped;

  for (const group of list) {
    console.log(`=== Edificio [${group.key}] → canónica: ${group.canonical}`);
    for (const m of group.members) {
      console.log(
        `  ${m.code} · ${m.name} · ${m.address} (${m.provinceCode})`,
      );
    }
    console.log("");
  }

  if (args.exportCsv) {
    const lines = ["key,canonical,code,name,address,provinceCode"];
    for (const g of list) {
      for (const m of g.members) {
        lines.push(
          [
            g.key,
            g.canonical,
            m.code,
            `"${m.name}"`,
            `"${m.address}"`,
            m.provinceCode,
          ].join(","),
        );
      }
    }
    fs.writeFileSync(args.exportCsv, lines.join("\n"), "utf8");
    console.log(`Reporte exportado: ${args.exportCsv}`);
  }

  if (!args.apply) {
    console.log(
      "Modo relevamiento (dry-run). Para aplicar, ejecutá con --apply.\n",
    );
    console.log("Unificar SOLO algunas oficinas (no todas):");
    console.log(
      '  npm run buildings:reconcile -- --apply --only "<key>"   (repetible por grupo)',
    );
    console.log(
      "  npm run buildings:reconcile -- --apply --interactive    (pregunta por cada grupo)",
    );
    console.log(
      "  npm run buildings:reconcile -- --export reporte.csv     (ver columna key)",
    );
    console.log("  npm run buildings:reconcile -- --help               (ayuda completa)");
    return;
  }

  if (scope.length === 0) {
    console.log(
      "Ningún grupo coincide con --only. Verificá la clave exacta (incluye provincia).",
    );
    return;
  }

  const scopeOffices = scope.reduce((n, g) => n + g.members.length, 0);
  const confirmed = await promptConfirmation(
    `Se modificarán ${scopeOffices} oficinas en ${scope.length} grupo(s) para usar la dirección canónica.`,
  );
  if (!confirmed) {
    console.log("Operación cancelada. No se realizaron cambios.");
    return;
  }

  const toApply: BuildingCandidateGroup[] = [];
  for (const group of scope) {
    if (args.interactive) {
      const ok = await promptConfirmation(
        `Unificar grupo [${group.key}] → "${group.canonical}" (${group.members.length} oficinas)?`,
      );
      if (!ok) {
        console.log(`  Grupo omitido: ${group.key}`);
        continue;
      }
    }
    toApply.push(group);
  }

  if (toApply.length === 0) {
    console.log("Ningún grupo seleccionado. No se realizaron cambios.");
    return;
  }

  backupDatabase();

  let updated = 0;
  for (const group of toApply) {
    for (const m of group.members) {
      const searchableText = normalizeSearch(
        [m.code, m.name, group.canonical].filter(Boolean).join(" "),
      );
      await db
        .update(offices)
        .set({ address: group.canonical.toUpperCase(), searchableText })
        .where(eq(offices.id, m.id));
      updated++;
    }
    await db.insert(auditLogs).values({
      username: "system:reconcile-buildings",
      action: `Reconciliación de edificio: ${group.members.length} oficinas → "${group.canonical}" (${group.members
        .map((m) => m.code)
        .join(", ")})`,
      timestamp: new Date().toISOString(),
    });
  }

  console.log(`\nListo. ${updated} oficinas actualizadas.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
