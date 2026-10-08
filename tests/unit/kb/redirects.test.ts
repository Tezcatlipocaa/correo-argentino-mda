import { describe, it, expect } from "vitest";
import { redirectWithToast } from "@lib/api/redirectWithToast";
import {
  buildCategoryRedirectTarget,
  isCategoryFormKbPath,
  kbPathname,
  KB_CATEGORIAS_PATH,
  normalizeKbReturnPath,
  withBase,
} from "@lib/kbRedirects";

describe("normalizeKbReturnPath", () => {
  it("acepta el path con el base ya aplicado y lo devuelve sin base", () => {
    expect(
      normalizeKbReturnPath("/mda/base-conocimiento/create?mesa=1", "/mda/"),
    ).toBe("/base-conocimiento/create?mesa=1");
  });

  it("acepta el path sin base cuando el base es no raíz", () => {
    expect(
      normalizeKbReturnPath("/base-conocimiento/create?mesa=1", "/mda/"),
    ).toBe("/base-conocimiento/create?mesa=1");
  });

  it("con base raíz no acepta un base inventado", () => {
    expect(
      normalizeKbReturnPath("/mda/base-conocimiento/create", "/"),
    ).toBeNull();
  });

  it("rechaza URLs absolutas y protocolos relativos", () => {
    expect(normalizeKbReturnPath("https://evil.example/steal", "/")).toBeNull();
    expect(normalizeKbReturnPath("//evil.example/steal", "/")).toBeNull();
  });

  it("rechaza paths fuera de la sección KB", () => {
    expect(normalizeKbReturnPath("/otra-ruta", "/")).toBeNull();
    expect(normalizeKbReturnPath("", "/")).toBeNull();
  });

  it("preserva el fragmento", () => {
    expect(
      normalizeKbReturnPath("/base-conocimiento/create#ancla", "/mda/"),
    ).toBe("/base-conocimiento/create#ancla");
  });
});

describe("isCategoryFormKbPath", () => {
  it("reconoce los formularios de creación y edición", () => {
    expect(isCategoryFormKbPath("/base-conocimiento/create")).toBe(true);
    expect(isCategoryFormKbPath("/base-conocimiento/edit/12")).toBe(true);
  });

  it("no reconoce el propio ABM", () => {
    expect(isCategoryFormKbPath(KB_CATEGORIAS_PATH)).toBe(false);
    expect(isCategoryFormKbPath("/base-conocimiento")).toBe(false);
  });
});

describe("kbPathname", () => {
  it("extrae el pathname de un path relativo sin lanzar", () => {
    expect(kbPathname("/base-conocimiento/create?mesa=1")).toBe(
      "/base-conocimiento/create",
    );
  });

  it("extrae el pathname de un path con base", () => {
    expect(kbPathname("/mda/base-conocimiento/edit/7")).toBe(
      "/mda/base-conocimiento/edit/7",
    );
  });
});

describe("buildCategoryRedirectTarget", () => {
  it("nunca devuelve un target con el base ya aplicado (origen del doble prefijo)", () => {
    const target = buildCategoryRedirectTarget({
      returnTo: "/mda/base-conocimiento/create",
      base: "/mda/",
      createdName: "Redes",
      fromCategoryForm: true,
    });
    expect(target.startsWith("/base-conocimiento/")).toBe(true);
    expect(target.startsWith("/mda")).toBe(false);
  });

  it("con base no raíz compone un único prefijo al final", () => {
    const target = buildCategoryRedirectTarget({
      returnTo: "/mda/base-conocimiento/create?mesa=42",
      base: "/mda/",
      createdName: "Redes",
      fromCategoryForm: true,
    });
    expect(withBase("/mda/", target)).toBe(
      "/mda/base-conocimiento/create?mesa=42&nueva_categoria=Redes",
    );
  });

  it("conserva el fragmento al agregar el query param", () => {
    const target = buildCategoryRedirectTarget({
      returnTo: "/base-conocimiento/create#editor",
      base: "/",
      createdName: "Redes",
      fromCategoryForm: true,
    });
    expect(target).toBe(
      "/base-conocimiento/create?nueva_categoria=Redes#editor",
    );
  });

  it("no agrega nueva_categoria si el destino no es un formulario", () => {
    const target = buildCategoryRedirectTarget({
      returnTo: "/base-conocimiento/categorias",
      base: "/",
      createdName: "Redes",
      fromCategoryForm: false,
    });
    expect(target).toBe(KB_CATEGORIAS_PATH);
  });

  it("cae al ABM cuando el returnTo es inválido", () => {
    const target = buildCategoryRedirectTarget({
      returnTo: "https://evil.example/steal",
      base: "/",
      createdName: "Redes",
      fromCategoryForm: true,
    });
    expect(target).toBe(KB_CATEGORIAS_PATH);
  });
});

describe("redirectWithToast + buildCategoryRedirectTarget (flujo inline)", () => {
  it("con base no raíz no duplica el prefijo al redirigir", () => {
    const target = buildCategoryRedirectTarget({
      returnTo: "/mda/base-conocimiento/create?mesa=42",
      base: "/mda/",
      createdName: "Redes",
      fromCategoryForm: true,
    });

    const response = redirectWithToast(
      target,
      "Categoría creada.",
      "success",
      "/mda",
    );
    const location = response.headers.get("Location") ?? "";

    expect(location).toBe(
      "/mda/base-conocimiento/create?mesa=42&nueva_categoria=Redes&toast_msg=Categor%C3%ADa%20creada.&toast_type=success",
    );
    expect(location.match(/\/mda\//g)?.length ?? 0).toBe(1);
    expect(location).not.toContain("/base-conocimiento/base-conocimiento");
  });

  it("con base raíz conserva el path sin prefijo", () => {
    const target = buildCategoryRedirectTarget({
      returnTo: "/base-conocimiento/edit/7",
      base: "/",
      createdName: "",
      fromCategoryForm: false,
    });

    const response = redirectWithToast(
      target,
      "Categoría eliminada.",
      "success",
      "",
    );
    const location = response.headers.get("Location") ?? "";

    expect(location.startsWith("/base-conocimiento/edit/7?")).toBe(true);
    expect(location).not.toContain("//base-conocimiento");
  });
});
