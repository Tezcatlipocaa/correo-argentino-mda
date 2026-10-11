import { describe, it, expect } from "vitest";
import { getCleanBase, getBaseNoSlash } from "../../../src/lib/baseUrl";

describe("Base URL Helper Normalization", () => {
  it("getCleanBase always ends with a slash", () => {
    const base = getCleanBase();
    expect(base.endsWith("/")).toBe(true);
    expect(base.startsWith("/")).toBe(true);
  });

  it("getBaseNoSlash does not end with a slash", () => {
    const baseNoSlash = getBaseNoSlash();
    expect(baseNoSlash.endsWith("/")).toBe(false);
  });

  it("composes paths without double slash", () => {
    const base = getCleanBase();
    const endpoint = `${base}api/titulos/export.csv`;
    expect(endpoint).not.toContain("//api");
    expect(endpoint.endsWith("/api/titulos/export.csv")).toBe(true);
  });
});
