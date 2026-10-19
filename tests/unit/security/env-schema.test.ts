import { describe, expect, it } from "vitest";
import { assertServerEnv, validateScriptEnv, validateServerEnv } from "../../../src/lib/env";

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

describe("validateScriptEnv", () => {
  const jobs = {
    MIDPOINT_USER: "u",
    MIDPOINT_PASS: "p",
    LEGACY_INVENTORY_URL: "http://host/terminales",
    INVGATE_API_KEY: "k",
    INVGATE_BASE_URL: "https://invgate/api/v1/",
  } as NodeJS.ProcessEnv;

  it("acepta un env de jobs completo", () => {
    expect(validateScriptEnv(jobs)).toEqual({ ok: true, missing: [] });
  });

  it("exige las claves de sync-users (#308)", () => {
    const result = validateScriptEnv({ ...jobs, INVGATE_API_KEY: "" } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("INVGATE_API_KEY | INVGATE_QA_API_KEY");
  });

  it("acepta las variantes _QA_ como fallback (#308)", () => {
    const result = validateScriptEnv({
      MIDPOINT_USER: "u",
      MIDPOINT_PASS: "p",
      LEGACY_INVENTORY_URL: "http://host/terminales",
      INVGATE_QA_API_KEY: "k",
      INVGATE_QA_BASE_URL: "https://invgate-qa/api/v1/",
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
  });
});

describe("assertServerEnv", () => {
  it("aborta en producción si falta una crítica", () => {
    expect(() =>
      assertServerEnv({ ...base, NODE_ENV: "production", SESSION_SECRET: "" } as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it("no aborta fuera de producción", () => {
    expect(() =>
      assertServerEnv({ ...base, NODE_ENV: "development", SESSION_SECRET: "" } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});
