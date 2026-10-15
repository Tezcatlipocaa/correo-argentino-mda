import { describe, expect, it } from "vitest";
import { validateServerEnv } from "../../../src/lib/env";

const base = {
  SESSION_SECRET: "x".repeat(48),
  ENCRYPTION_KEY: "k".repeat(32),
  EXTERNAL_STORAGE_DIR: "C:/storage",
} as NodeJS.ProcessEnv;

describe("validateServerEnv", () => {
  it("acepta un env completo", () => {
    const result = validateServerEnv(base);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("reporta las críticas ausentes", () => {
    const result = validateServerEnv({} as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["SESSION_SECRET", "ENCRYPTION_KEY"]);
  });

  it("no exige las opcionales (LDAP, MidPoint, Wise)", () => {
    const result = validateServerEnv(base);
    expect(result.missing).not.toContain("LDAP_SERVER");
    expect(result.missing).not.toContain("MIDPOINT_USER");
    expect(result.missing).not.toContain("WISE_CX_API_KEY");
  });

  it("rechaza un SESSION_SECRET corto", () => {
    const result = validateServerEnv({ ...base, SESSION_SECRET: "corto" } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(result.invalid).toContain("SESSION_SECRET");
  });
});
