import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
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
function runCli(args: string[]) {
  const result = spawnSync(
    process.execPath,
    [TSX_CLI, "scripts/reconcile-buildings.ts", ...args],
    { cwd: REPO_ROOT, encoding: "utf8", timeout: 60_000 },
  );
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

describe("banderas con valor obligatorio (#161)", () => {
  it("--province sin valor corta con código 1 y menciona la bandera", () => {
    const { status, output } = runCli(["--province"]);
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
