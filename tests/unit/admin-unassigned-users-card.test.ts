import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PAGE = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "src",
  "pages",
  "admin",
  "index.astro",
);
const source = fs.readFileSync(PAGE, "utf8");

describe("el panel de administracion incluye la pagina de usuarios sin ubicacion (#217)", () => {
  it("la ruta esta declarada en modulesGroup1", () => {
    const group1 = source.slice(
      source.indexOf("const modulesGroup1"),
      source.indexOf("const modulesGroup2"),
    );
    expect(group1).toContain('href: "/admin/usuarios-sin-ubicacion"');
    expect(group1).toContain('icon: "boxicons:user-x-filled"');
  });

  it("la ruta forma parte de la lista admin-only del isLocked", () => {
    const isLockedBlock = source.slice(
      source.indexOf("const isLocked"),
      source.indexOf("if (mod.active && mod.href && !isLocked)"),
    );
    expect(isLockedBlock).toContain('mod.href === "/admin/usuarios-sin-ubicacion"');
  });

  it("el titulo de la tarjeta dice Usuarios sin ubicación", () => {
    const group1 = source.slice(
      source.indexOf("const modulesGroup1"),
      source.indexOf("const modulesGroup2"),
    );
    expect(group1).toContain('title: "Usuarios sin ubicación"');
  });

  it("la ruta esta registrada en navigation.ts para el command palette", () => {
    const nav = fs.readFileSync(
      path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "src",
        "lib",
        "navigation.ts",
      ),
      "utf8",
    );
    expect(nav).toContain('href: "/admin/usuarios-sin-ubicacion"');
  });

  it("el banner de alerta ya no figura en DirectorioContent.astro", () => {
    const directorio = fs.readFileSync(
      path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "src",
        "components",
        "offices",
        "DirectorioContent.astro",
      ),
      "utf8",
    );
    expect(directorio).not.toContain('id="unassigned-users-banner"');
    expect(directorio).not.toContain("unassignedUsersCount");
  });
});
