import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guarda contra origen con puerto hardcodeado en los specs.
 *
 * `playwright.config.ts:12` resuelve `baseURL` desde `PLAYWRIGHT_BASE_URL`,
 * pero varios specs comparan o navegan contra un `localhost`/`127.0.0.1` con
 * puerto literal (cualquier esquema, cualquier puerto). Con el dev server en
 * otro puerto esos tests fallan sin que el producto tenga nada que ver: la
 * suite completa resultaba ininterpretable (63 de 517 fallos).
 *
 * La excepcion es un fallback tras `??`, que es legitimo: si el proyecto no
 * define `baseURL`, ese valor es el correcto.
 */
const SPECS_DIR = path.resolve(import.meta.dirname, "..");
const LITERAL = /["'`]https?:\/\/(?:localhost|127\.0\.0\.1):\d+[^"'`]*["'`]/g;
const FALLBACK = /https?:\/\/(?:localhost|127\.0\.0\.1):\d+/;

function collectSpecs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSpecs(full);
    return entry.name.endsWith(".spec.ts") ? [full] : [];
  });
}

describe("los specs no deben fijar el puerto del dev server", () => {
  const offenders: string[] = [];

  for (const file of collectSpecs(SPECS_DIR)) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      // El fallback tras `??` es correcto: solo se busca el puerto cuando NO
      // hay un `??` en la misma linea.
      if (FALLBACK.test(line) && line.includes("??")) return;
      const matches = line.match(LITERAL);
      if (matches) {
        offenders.push(
          `${path.relative(SPECS_DIR, file)}:${index + 1} -> ${line.trim()}`,
        );
      }
    });
  }

  it("no encuentra puertos fijos fuera del fallback", () => {
    expect(offenders).toEqual([]);
  });
});
