import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Las banderas con valor de `scripts/reconcile-buildings.ts` se leían con
 * `argv[++i]` sin verificar que el valor exista (#161). Con la bandera al final,
 * `--province` quedaba en `undefined`, el chequeo `args.province && ...` lo
 * tomaba como "sin filtro", y `--apply` reconciliaba las 229 oficinas del país
 * en lugar del subconjunto pedido.
 *
 * Se prueba por spawning y no importando `parseArgs` porque lo que importa es
 * el código de salida y el mensaje: un test unitario del parser pasaría aunque
 * el valor se ignorara después.
 */
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const TSX_CLI = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

/**
 * Fixture propia para los tests que dependen de conteos.
 *
 * `database/mda.db` es una copia de producción que cambia con el uso real: la
 * unificación de edificios ya se aplicó sobre los 66 grupos y el dry-run pasó
 * de `66 (229 oficinas)` a `0 (0 oficinas)`, lo que rompió 6 tests que fijaban
 * ese snapshot. Con datos propios el resultado es determinista y los tests dejan
 * de fallar por un movimiento legítimo de los datos.
 *
 * `src/db/index.ts:5` abre `./database/mda.db` relativo al cwd, así que basta
 * con pasar un cwd distinto: es el mismo mecanismo que ya usa `runCli`. Se
 * borran todos los renglones reales y se insertan los de arriba en una
 * conexión con `foreign_keys` apagado (better-sqlite3 lo prende por defecto, y
 * las tablas hijas con `office_id` impedirían el borrado); la CLI solo lee
 * `offices`.
 */
const FIXTURE_ROWS: [string, string, string, string, string][] = [
  ["CF001", "San Juan Central", "SUCURSAL", "C", "AV. SAN JUAN 1349"],
  ["CF002", "San Juan Anexo", "SUCURSAL", "C", "SAN JUAN 1349"],
  ["CF003", "San Juan Norte", "SUCURSAL", "C", "AV SAN JUAN 1349"],
  ["BF001", "Vergara Centro", "SUCURSAL", "B", "AV. GDOR V VERGARA 3443"],
  [
    "BF002",
    "Vergara Sur",
    "SUCURSAL",
    "B",
    "VERGARA GOBERNADOR DOCTOR VALENTIN 3443",
  ],
];

const COUNT_ALL = "Grupos candidatos de mismo edificio: 2 (5 oficinas)";
const COUNT_C = "Grupos candidatos de mismo edificio: 1 (3 oficinas)";
const KEY_B = "B#3443|GOBERNADOR+VALENTIN+VERGARA";

let fixtureDir = "";

function buildFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reconcile-fixture-"));
  fs.mkdirSync(path.join(dir, "database"), { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, "database", "mda.db"),
    path.join(dir, "database", "mda.db"),
  );
  const db = new Database(path.join(dir, "database", "mda.db"));
  // better-sqlite3 activa foreign_keys por defecto, y hay tablas hijas con
  // `office_id` que impedirían borrar las oficinas reales. La CLI solo lee
  // `offices`, así que las filas huérfanas no le importan.
  db.pragma("foreign_keys = OFF");
  db.exec("DELETE FROM offices");
  const insert = db.prepare(
    "INSERT INTO offices (code, name, type, provinceCode, address) VALUES (?, ?, ?, ?, ?)",
  );
  for (const row of FIXTURE_ROWS) insert.run(...row);
  db.close();
  return dir;
}

// `npx` es un .cmd: spawnSync no lo abre sin shell, y shell:true interpretaría
// el `|` de una clave como pipe. El bin de tsx está declarado en su
// package.json (`"bin": "./dist/cli.mjs"`), así que lo invocamos con node.
function runCli(args: string[], cwd: string = REPO_ROOT) {
  const result = spawnSync(
    process.execPath,
    // Ruta absoluta: con `cwd` temporal el entry relativo no existiría.
    [
      TSX_CLI,
      path.join(REPO_ROOT, "scripts", "reconcile-buildings.ts"),
      ...args,
    ],
    { cwd, encoding: "utf8", timeout: 60_000 },
  );
  // Un spawn fallido o un timeout devuelven `status: null`; sin este guard el
  // fallo se reporta como `expected null to be 1` y esconde la causa real.
  if (result.error) throw result.error;
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

beforeAll(() => {
  fixtureDir = buildFixture();
});

afterAll(() => {
  if (fixtureDir) fs.rmSync(fixtureDir, { recursive: true, force: true });
});

describe("banderas con valor obligatorio (#161)", () => {
  // Es el escenario reportado: bandera sin valor + `--apply`. Es seguro aunque
  // la guarda desaparezca: `parseArgs` es la primera instrucción de `main()`,
  // y sin la guarda el script llegaría al prompt de CONFIRMAR, donde stdin es
  // EOF y cancela antes de tocar `backupDatabase()` ni escribir nada.
  it("--apply --province sin valor corta con código 1 y menciona la bandera", () => {
    const { status, output } = runCli(["--apply", "--province"]);
    expect(status).toBe(1);
    expect(output).toContain("--province");
    expect(output).toContain("requiere un valor");
  }, 90_000);

  it("--only sin valor corta con código 1 y menciona la bandera", () => {
    const { status, output } = runCli(["--only"]);
    expect(status).toBe(1);
    expect(output).toContain("--only");
    expect(output).toContain("requiere un valor");
  }, 90_000);

  it("--export sin valor corta con código 1 y menciona la bandera", () => {
    const { status, output } = runCli(["--export"]);
    expect(status).toBe(1);
    expect(output).toContain("--export");
    expect(output).toContain("requiere un valor");
  }, 90_000);

  it("--province con valor válido no corta y filtra", () => {
    const { status, output } = runCli(["--province", "C"], fixtureDir);
    expect(status).toBe(0);
    expect(output).toContain(COUNT_C);
  }, 90_000);

  it("--province en minúscula se normaliza a mayúsculas", () => {
    const lower = runCli(["--province", "c"], fixtureDir);
    expect(lower.status).toBe(0);
    expect(lower.output).toContain(COUNT_C);
  }, 90_000);

  it("--province all equivale a no filtrar", () => {
    const none = runCli([], fixtureDir);
    const all = runCli(["--province", "all"], fixtureDir);
    expect(none.output).toContain(COUNT_ALL);
    expect(all.output).toContain(COUNT_ALL);
  }, 150_000);

  it("--help documenta que las banderas requieren valor", () => {
    const { output } = runCli(["--help"]);
    expect(output).toContain("Requiere un valor");
    expect(output).toContain("tsx scripts/reconcile-buildings.ts");
  }, 90_000);
});

describe("el dry-run y el export respetan --only (#163)", () => {
  it("el dry-run con --only lista solo el grupo acotado", () => {
    const { status, output } = runCli(["--only", KEY_B], fixtureDir);
    expect(status).toBe(0);
    const bloques = output.split("=== Edificio [").length - 1;
    expect(bloques).toBe(1);
    expect(output).toContain(KEY_B);
  }, 90_000);

  it("--export con --only escribe un CSV acotado", () => {
    const csv = path.join(os.tmpdir(), "reconcile-scope.csv");
    fs.rmSync(csv, { force: true });
    try {
      const { status } = runCli(["--only", KEY_B, "--export", csv], fixtureDir);
      expect(status).toBe(0);

      const lineas = fs.readFileSync(csv, "utf8").trim().split(/\r?\n/);
      // Una línea de encabezado más las 2 oficinas del grupo en la fixture.
      expect(lineas.length).toBe(3);
      expect(lineas.slice(1).every((l) => l.startsWith(`${KEY_B},`))).toBe(
        true,
      );
    } finally {
      fs.rmSync(csv, { force: true });
    }
  }, 90_000);

  it("una provincia sin grupos menciona el filtro de provincia, no --only", () => {
    const { status, output } = runCli(
      ["--apply", "--province", "D"],
      fixtureDir,
    );
    expect(status).toBe(0);
    expect(output).toContain("--province");
    expect(output).not.toContain("coincide con --only");
  }, 90_000);

  it("una clave inexistente menciona --only", () => {
    const { status, output } = runCli(
      ["--apply", "--only", "Z#1|NADA"],
      fixtureDir,
    );
    expect(status).toBe(0);
    expect(output).toContain("--only");
  }, 90_000);

  it("sin filtros el dry-run lista todos los grupos", () => {
    const { status, output } = runCli([], fixtureDir);
    expect(status).toBe(0);
    const bloques = output.split("=== Edificio [").length - 1;
    expect(bloques).toBe(2);
    expect(output).toContain(COUNT_ALL);
  }, 90_000);
});

describe("el guard de base antes de importar (#162)", () => {
  it("rechaza una base ausente en español y no crea archivos", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preflight-"));
    fs.mkdirSync(path.join(dir, "database"), { recursive: true });
    try {
      const { status, output } = runCli([], dir);
      expect(status).toBe(1);
      expect(output).toContain("no existe. Copiala desde producción");
      expect(fs.existsSync(path.join(dir, "database", "mda.db"))).toBe(false);
      expect(fs.existsSync(path.join(dir, "database", "backups"))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 90_000);

  it("no toma -h en posición de valor como pedido de ayuda", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preflight-"));
    fs.mkdirSync(path.join(dir, "database"), { recursive: true });
    try {
      const { status, output } = runCli(["--export", "-h"], dir);
      // Si el guard lo tratara como --help, saltearía la validación,
      // src/db/index crearía un mda.db de 0 bytes y moriría con
      // SqliteError en inglés — el bug original.
      expect(status).toBe(1);
      expect(output).toContain("no existe. Copiala desde producción");
      expect(fs.existsSync(path.join(dir, "database", "mda.db"))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 90_000);

  it("--help sigue funcionando sin base", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preflight-"));
    // Sin `database/`, src/db/index.ts lanza TypeError al importar
    // (comportamiento previo) y --help sale con 1: el directorio vacío
    // es lo mínimo para que la ayuda corra.
    fs.mkdirSync(path.join(dir, "database"), { recursive: true });
    try {
      const { status, output } = runCli(["--help"], dir);
      expect(status).toBe(0);
      expect(output).toContain(
        "Uso: tsx scripts/reconcile-buildings.ts [opciones]",
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 90_000);
});
