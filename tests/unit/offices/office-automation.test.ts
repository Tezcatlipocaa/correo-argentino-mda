import { describe, it, expect } from "vitest";
import {
  hasMosaicIndicator,
  isSucursalAutomatizada,
  isSucursalNoAutomatizada,
} from "@/lib/officeHelpers";

describe("hasMosaicIndicator", () => {
  it("returns true when string contains mosaic in any casing or with whitespace", () => {
    expect(hasMosaicIndicator("mosaic")).toBe(true);
    expect(hasMosaicIndicator("MOSAIC")).toBe(true);
    expect(hasMosaicIndicator("Mosaic")).toBe(true);
    expect(hasMosaicIndicator("  sucursal mosaic  ")).toBe(true);
    expect(hasMosaicIndicator("SUCURSAL MOSAIC CABALLITO")).toBe(true);
  });

  it("evaluates multiple arguments and returns true if any contains mosaic", () => {
    expect(hasMosaicIndicator("SUCURSAL CENTRO", "MOSAIC")).toBe(true);
    expect(hasMosaicIndicator(null, undefined, "sucursal mosaic")).toBe(true);
  });

  it("returns false for null, undefined, empty, or strings without mosaic", () => {
    expect(hasMosaicIndicator(null)).toBe(false);
    expect(hasMosaicIndicator(undefined)).toBe(false);
    expect(hasMosaicIndicator("")).toBe(false);
    expect(hasMosaicIndicator("   ")).toBe(false);
    expect(hasMosaicIndicator("SUCURSAL CENTRO")).toBe(false);
    expect(hasMosaicIndicator("CENTRO DE DISTRIBUCION")).toBe(false);
    expect(hasMosaicIndicator(null, undefined, "SUCURSAL CENTRO")).toBe(false);
  });
});

describe("isSucursalAutomatizada", () => {
  it("returns true when type is SUCURSAL and officeType is AUTOMATIZADA", () => {
    expect(
      isSucursalAutomatizada({
        type: "SUCURSAL",
        officeType: "AUTOMATIZADA",
      })
    ).toBe(true);

    expect(
      isSucursalAutomatizada({
        type: "sucursal",
        officeType: "AUTOMATIZADA",
      })
    ).toBe(true);
  });

  it("returns true when type is SUCURSAL and name has mosaic indicator regardless of officeType", () => {
    expect(
      isSucursalAutomatizada({
        type: "SUCURSAL",
        name: "SUCURSAL MOSAIC CENTRO",
        officeType: "NO_AUTOMATIZADA",
      })
    ).toBe(true);

    expect(
      isSucursalAutomatizada({
        type: "SUCURSAL",
        name: "SUCURSAL MOSAIC CENTRO",
        officeType: "NO AUTOMATIZADA",
      })
    ).toBe(true);

    expect(
      isSucursalAutomatizada({
        type: "SUCURSAL",
        name: "SUCURSAL MOSAIC CENTRO",
        officeType: null,
      })
    ).toBe(true);
  });

  it("returns true when type is SUCURSAL and invgateDisplayName has mosaic indicator", () => {
    expect(
      isSucursalAutomatizada({
        type: "SUCURSAL",
        name: "SUCURSAL CENTRO",
        invgateDisplayName: "SUCURSAL CENTRO (MOSAIC)",
        officeType: "NO_AUTOMATIZADA",
      })
    ).toBe(true);
  });

  it("returns false when type is SUCURSAL and office is not automated and has no mosaic indicator", () => {
    expect(
      isSucursalAutomatizada({
        type: "SUCURSAL",
        name: "SUCURSAL CENTRO",
        officeType: "NO_AUTOMATIZADA",
      })
    ).toBe(false);

    expect(
      isSucursalAutomatizada({
        type: "SUCURSAL",
        name: "SUCURSAL CENTRO",
        officeType: "NO AUTOMATIZADA",
      })
    ).toBe(false);

    expect(
      isSucursalAutomatizada({
        type: "SUCURSAL",
        name: "SUCURSAL CENTRO",
        officeType: null,
      })
    ).toBe(false);
  });

  it("returns false when type is not SUCURSAL even if name contains mosaic", () => {
    expect(
      isSucursalAutomatizada({
        type: "AGENCIA",
        name: "AGENCIA MOSAIC",
        officeType: "AUTOMATIZADA",
      })
    ).toBe(false);

    expect(
      isSucursalAutomatizada({
        type: "CDD",
        name: "CDD MOSAIC",
      })
    ).toBe(false);

    expect(
      isSucursalAutomatizada({
        type: "ADMINISTRACION",
        invgateDisplayName: "ADMINISTRACION MOSAIC",
      })
    ).toBe(false);
  });
});

describe("isSucursalNoAutomatizada", () => {
  it("returns true when type is SUCURSAL and not automated", () => {
    expect(
      isSucursalNoAutomatizada({
        type: "SUCURSAL",
        officeType: "NO_AUTOMATIZADA",
      })
    ).toBe(true);

    expect(
      isSucursalNoAutomatizada({
        type: "sucursal",
        name: "SUCURSAL COMUN",
        officeType: null,
      })
    ).toBe(true);
  });

  it("returns false when type is SUCURSAL and automated", () => {
    expect(
      isSucursalNoAutomatizada({
        type: "SUCURSAL",
        officeType: "AUTOMATIZADA",
      })
    ).toBe(false);

    expect(
      isSucursalNoAutomatizada({
        type: "SUCURSAL",
        name: "SUCURSAL MOSAIC",
      })
    ).toBe(false);
  });

  it("returns false when type is not SUCURSAL", () => {
    expect(
      isSucursalNoAutomatizada({
        type: "AGENCIA",
        officeType: "NO_AUTOMATIZADA",
      })
    ).toBe(false);

    expect(
      isSucursalNoAutomatizada({
        type: null,
      })
    ).toBe(false);
  });
});
