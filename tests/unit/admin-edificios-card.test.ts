import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * La pagina `/admin/oficinas/edificios` no era alcanzable desde ningun lugar
 * visible: `src/pages/admin/index.astro` arma su grilla con arreglos locales
 * (no con `navSections`), asi que el registro en `navigation.ts` no alcanza
 * para mostrarla (#164).
 *
 * Un test sobre el archivo fuente y no sobre el DOM renderizado porque el
 * gating por rol necesita sesion: aqui se verifica el contrato de datos (que la
 * ruta este en el arreglo, debajo de Ubicaciones InvGate, con su icono, y que
 * el bloqueo derive de rbac) que es lo que decide que la tarjeta aparezca o no.
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

/** Devuelve el cuerpo de un arreglo de modulos, del `const` al `];` o al `---`. */
function moduleGroup(name: string): string {
  const start = source.indexOf(`const ${name}`);
  expect(start, `no existe const ${name}`).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const endAtClose = rest.indexOf("\n];");
  const endAtFence = rest.indexOf("\n---");
  const end =
    endAtClose >= 0 && (endAtFence < 0 || endAtClose < endAtFence)
      ? endAtClose
      : endAtFence;
  return rest.slice(0, end);
}

describe("el panel de administracion incluye la pagina de edificios (#164)", () => {
  it("la ruta esta declarada en modulesGroupInvgate", () => {
    const group = moduleGroup("modulesGroupInvgate");
    expect(group).toContain('href: "/admin/oficinas/edificios"');
    expect(group).toContain('icon: "boxicons:building-house-filled"');
  });

  it("queda debajo de Ubicaciones InvGate dentro del grupo", () => {
    const group = moduleGroup("modulesGroupInvgate");
    expect(group.indexOf('title: "Ubicaciones InvGate"')).toBeGreaterThan(-1);
    expect(group.indexOf('title: "Edificios (oficinas)"')).toBeGreaterThan(
      group.indexOf('title: "Ubicaciones InvGate"'),
    );
  });

  it("el icono usa un tono con fondo, distinto del de su vecina", () => {
    const group = moduleGroup("modulesGroupInvgate");
    const card = group.slice(group.indexOf('title: "Edificios (oficinas)"'));
    const tone = /iconTone: "([^"]+)"/.exec(card)?.[1] ?? "";
    expect(tone).toMatch(/^bg-\w+\/10 text-\w+$/);
    expect(tone).not.toBe("bg-secondary/10 text-secondary");
  });

  it("ya no vive en modulesGroup1", () => {
    expect(moduleGroup("modulesGroup1")).not.toContain(
      'href: "/admin/oficinas/edificios"',
    );
  });

  it("el bloqueo de cada grupo deriva de hasPermission, no de listas manuales", () => {
    // Las dos compuertas del archivo (grupo 1 e invgate) tienen que preguntarle
    // a `rbac.ts`; si alguien vuelve a listas literales, los roles pueden
    // divergir de la whitelist (#176).
    const blocks = [...source.matchAll(/const isLocked =[\s\S]*?;/g)].map(
      (m) => m[0],
    );
    expect(blocks.length).toBe(2);
    for (const block of blocks) {
      expect(block).toContain("hasPermission(mod.href, user.role)");
      expect(block).not.toContain("mod.href ===");
    }
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
