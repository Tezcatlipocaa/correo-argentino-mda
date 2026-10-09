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
  it("la ruta esta declarada en modulesGroupInvgate debajo de Agrupación de oficinas", () => {
    const groupInvgate = source.slice(
      source.indexOf("const modulesGroupInvgate"),
      source.indexOf("---", source.indexOf("const modulesGroupInvgate")),
    );
    expect(groupInvgate).toContain('href: "/admin/usuarios-sin-ubicacion"');
    expect(groupInvgate).toContain('icon: "boxicons:user-x-filled"');
    expect(
      groupInvgate.indexOf('title: "Usuarios sin ubicación"'),
    ).toBeGreaterThan(groupInvgate.indexOf('title: "Agrupación de oficinas"'));
  });

  it("el bloqueo deriva de hasPermission en rbac", () => {
    const isLockedBlock = source.slice(
      source.indexOf("const isLocked"),
      source.indexOf("return ("),
    );
    expect(isLockedBlock).toContain("hasPermission(mod.href, user.role)");

    const rbac = fs.readFileSync(
      path.resolve(import.meta.dirname, "..", "..", "src", "lib", "rbac.ts"),
      "utf8",
    );
    expect(rbac).toContain(
      '{ path: "/admin/usuarios-sin-ubicacion", roles: ["admin"] }',
    );
  });

  it("el titulo de la tarjeta dice Usuarios sin ubicación", () => {
    const groupInvgate = source.slice(
      source.indexOf("const modulesGroupInvgate"),
      source.indexOf("---", source.indexOf("const modulesGroupInvgate")),
    );
    expect(groupInvgate).toContain('title: "Usuarios sin ubicación"');
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
