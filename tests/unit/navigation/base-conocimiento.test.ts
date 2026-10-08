// tests/unit/navigation/base-conocimiento.test.ts
//
// Política temporal (2026-09): Base de conocimiento es SOLO para `admin`.
// Toda la sección `/base-conocimiento/*` y los endpoints `/api/kb/upload` +
// `/api/kb/images` quedan restringidos. La fuente única es `KB_ACCESS_ROLES`
// en `src/lib/rbac.ts`; para revertir, editar solo esa constante.
import { describe, it, expect } from "vitest";
import { navSections } from "../../../src/lib/navigation";
import {
  CANONICAL_ROLES,
  KB_ACCESS_ROLES,
  getModulePermissions,
  hasPermission,
  routePermissions,
} from "@lib/rbac";
import {
  isSectionVisibleSync,
  COORD_HELPDESK,
} from "../../../src/lib/helpdeskAccess";

describe("sección Base de conocimiento", () => {
  it("incluye Base de Conocimiento en accesos rápidos", () => {
    // Estructural únicamente: `navSections` SIEMPRE contiene el ítem; los
    // no-admin se ocultan por el filtro de permisos en tiempo de render
    // (BaseLayout/index), no acá. No es un test de política.
    const quickAccess = navSections.find((s) => s.id === "accesos-rapidos");
    expect(quickAccess?.items).toContainEqual(
      expect.objectContaining({
        href: "/base-conocimiento",
        label: "Base de Conocimiento",
      }),
    );
  });

  it("/base-conocimiento está restringida a admin (KB_ACCESS_ROLES)", () => {
    const route = routePermissions.find((r) => r.path === "/base-conocimiento");
    expect(route).toBeDefined();
    expect(route!.roles).toEqual([...KB_ACCESS_ROLES]);
    // admin nunca puede quedar bloqueado (short-circuit no revocable).
    expect(KB_ACCESS_ROLES).toContain("admin");
  });

  it("aplica permisos admin-only a la sección y a los endpoints de la KB", () => {
    const routeCases = [
      "/base-conocimiento/categorias",
      "/base-conocimiento/create",
      "/base-conocimiento/edit",
      "/api/kb/upload",
      "/api/kb/images",
    ];

    for (const path of routeCases) {
      for (const role of CANONICAL_ROLES) {
        expect(hasPermission(path, role)).toBe(KB_ACCESS_ROLES.includes(role));
      }
    }

    for (const role of CANONICAL_ROLES) {
      expect(
        hasPermission(
          "/api/kb/images/mda-ti/123e4567-e89b-12d3-a456-426614174000.webp",
          role,
        ),
      ).toBe(KB_ACCESS_ROLES.includes(role));
    }
    expect(hasPermission("/base-conocimiento/edit/5", "team_leader")).toBe(
      false,
    );
    expect(hasPermission("/base-conocimiento/edit/5", "admin")).toBe(true);
  });

  it("solo admin puede leer y escribir Base de conocimiento (temporal)", () => {
    for (const role of CANONICAL_ROLES) {
      const permissions = getModulePermissions("base-conocimiento", role);
      expect(permissions.canRead).toBe(KB_ACCESS_ROLES.includes(role));
      expect(permissions.canWrite).toBe(KB_ACCESS_ROLES.includes(role));
    }
  });

  it("la capa de mesa sigue permitiendo, pero la capa de rol bloquea a agent", () => {
    // La mesa (isSectionVisibleSync) NO cambia: para Coordinación el `agent`
    // sigue viendo la sección. El bloqueo efectivo viene de la capa de rol
    // (hasPermission), que ahora es admin-only.
    expect(
      isSectionVisibleSync(COORD_HELPDESK, "agent", "/base-conocimiento"),
    ).toBe(true);
    expect(hasPermission("/base-conocimiento", "agent")).toBe(false);
  });
});
