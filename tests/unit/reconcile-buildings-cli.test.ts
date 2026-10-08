import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
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
    const { status, output } = runCli(["--province", "C"]);
    expect(status).toBe(0);
    expect(output).toContain(
      "Grupos candidatos de mismo edificio: 10 (50 oficinas)",
    );
  }, 90_000);

  it("--province en minúscula se normaliza a mayúsculas", () => {
    const lower = runCli(["--province", "c"]);
    expect(lower.status).toBe(0);
    expect(lower.output).toContain(
      "Grupos candidatos de mismo edificio: 10 (50 oficinas)",
    );
  }, 90_000);

  it("--province all equivale a no filtrar", () => {
    const none = runCli([]);
    const all = runCli(["--province", "all"]);
    expect(none.output).toContain(
      "Grupos candidatos de mismo edificio: 66 (229 oficinas)",
    );
    expect(all.output).toContain(
      "Grupos candidatos de mismo edificio: 66 (229 oficinas)",
    );
  }, 150_000);

  it("--help documenta que las banderas requieren valor", () => {
    const { output } = runCli(["--help"]);
    expect(output).toContain("Requiere un valor");
    expect(output).toContain("tsx scripts/reconcile-buildings.ts");
  }, 90_000);
});

describe("el dry-run y el export respetan --only (#163)", () => {
  const KEY = "B#3443|GOBERNADOR+VALENTIN+VERGARA";

  it("el dry-run con --only lista solo el grupo acotado", () => {
    const { status, output } = runCli(["--only", KEY]);
    expect(status).toBe(0);
    const bloques = output.split("=== Edificio [").length - 1;
    expect(bloques).toBe(1);
    expect(output).toContain(KEY);
  }, 90_000);

  it("--export con --only escribe un CSV acotado", () => {
    const csv = path.join(os.tmpdir(), "reconcile-scope.csv");
    fs.rmSync(csv, { force: true });
    try {
      const { status } = runCli(["--only", KEY, "--export", csv]);
      expect(status).toBe(0);

      const lineas = fs.readFileSync(csv, "utf8").trim().split(/\r?\n/);
      // Una línea de encabezado más las oficinas del grupo (2 en estos datos).
      expect(lineas.length).toBeGreaterThan(1);
      expect(lineas.length).toBeLessThan(20);
      expect(lineas.slice(1).every((l) => l.startsWith(`${KEY},`))).toBe(true);
    } finally {
      fs.rmSync(csv, { force: true });
    }
  }, 90_000);

  it("una provincia sin grupos menciona el filtro de provincia, no --only", () => {
    const { status, output } = runCli(["--apply", "--province", "D"]);
    expect(status).toBe(0);
    expect(output).toContain("--province");
    expect(output).not.toContain("coincide con --only");
  }, 90_000);

  it("una clave inexistente menciona --only", () => {
    const { status, output } = runCli(["--apply", "--only", "Z#1|NADA"]);
    expect(status).toBe(0);
    expect(output).toContain("--only");
  }, 90_000);

  it("sin filtros el dry-run lista todos los grupos", () => {
    const { status, output } = runCli([]);
    expect(status).toBe(0);
    const bloques = output.split("=== Edificio [").length - 1;
    expect(bloques).toBe(66);
    expect(output).toContain(
      "Grupos candidatos de mismo edificio: 66 (229 oficinas)",
    );
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
