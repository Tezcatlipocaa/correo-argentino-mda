import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * La pagina `/admin/oficinas/edificios` no era alcanzable desde ningun lugar
 * visible: `src/pages/admin/index.astro` arma su grilla con el arreglo local
 * `modulesGroup1` (no con `navSections`), asi que el registro en
 * `navigation.ts` no alcanza para mostrarla (#164).
 *
 * Un test sobre el archivo fuente y no sobre el DOM renderizado porque el
 * gating por rol necesita sesion: aqui se verifica el contrato de datos (que la
 * ruta este en el arreglo, con su icono, y dentro de la lista de bloqueo) que
 * es lo que decide que la tarjeta aparezca o no.
 */
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

describe("el panel de administracion incluye la pagina de edificios (#164)", () => {
  it("la ruta esta declarada en modulesGroup1", () => {
    const group1 = source.slice(
      source.indexOf("const modulesGroup1"),
      source.indexOf("const modulesGroup2"),
    );
    expect(group1).toContain('href: "/admin/oficinas/edificios"');
    expect(group1).toContain('icon: "boxicons:building-house-filled"');
  });

  it("la ruta forma parte de la lista admin-only del isLocked", () => {
    const isLockedBlock = source.slice(
      source.indexOf("const isLocked"),
      source.indexOf("if (mod.active && mod.href && !isLocked)"),
    );
    expect(isLockedBlock).toContain('mod.href === "/admin/oficinas/edificios"');
  });

  it("el titulo de la tarjeta dice Edificios (oficinas)", () => {
    const group1 = source.slice(
      source.indexOf("const modulesGroup1"),
      source.indexOf("const modulesGroup2"),
    );
    expect(group1).toContain('title: "Edificios (oficinas)"');
  });

  it("la ruta sigue registrada en navigation.ts para el command palette", () => {
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
    expect(nav).toContain('href: "/admin/oficinas/edificios"');
  });

  it("la ruta sigue siendo admin-only en la whitelist de RBAC", () => {
    const rbac = fs.readFileSync(
      path.resolve(import.meta.dirname, "..", "..", "src", "lib", "rbac.ts"),
      "utf8",
    );
    expect(rbac).toContain(
      '{ path: "/admin/oficinas/edificios", roles: ["admin"] }',
    );
  });
});
