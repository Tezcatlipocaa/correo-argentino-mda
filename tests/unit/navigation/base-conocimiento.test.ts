// tests/unit/navigation/base-conocimiento.test.ts
import { describe, it, expect } from "vitest";
import { navSections } from "../../../src/lib/navigation";
import {
  CANONICAL_ROLES,
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
    const quickAccess = navSections.find((s) => s.id === "accesos-rapidos");
    expect(quickAccess?.items).toContainEqual(
      expect.objectContaining({
        href: "/base-conocimiento",
        label: "Base de conocimiento",
      }),
    );
  });

  it("/base-conocimiento está whitelisteada para todos los roles (default-deny)", () => {
    const route = routePermissions.find((r) => r.path === "/base-conocimiento");
    expect(route).toBeDefined();
    expect(route!.roles).toContain("agent");
    expect(route!.roles).toContain("supervisor");
  });

  it("aplica permisos de rutas nuevas a todos los roles canonicos", () => {
    const expectedWriteRoles = new Set([
      "team_leader",
      "supervisor",
      "admin",
    ]);
    const expectedImageRoles = new Set([
      "admin",
      "supervisor",
      "team_leader",
      "referent",
      "agent",
    ]);
    const routeCases = [
      {
        path: "/base-conocimiento/create",
        expected: expectedWriteRoles,
      },
      {
        path: "/base-conocimiento/edit",
        expected: expectedWriteRoles,
      },
      {
        path: "/api/kb/upload",
        expected: expectedWriteRoles,
      },
      {
        path: "/api/kb/images",
        expected: expectedImageRoles,
      },
    ];

    for (const { path, expected } of routeCases) {
      for (const role of CANONICAL_ROLES) {
        expect(hasPermission(path, role)).toBe(expected.has(role));
      }
    }

    for (const role of CANONICAL_ROLES) {
      expect(
        hasPermission(
          "/api/kb/images/mda-ti/123e4567-e89b-12d3-a456-426614174000.webp",
          role,
        ),
      ).toBe(true);
    }
    expect(hasPermission("/base-conocimiento/edit/5", "team_leader")).toBe(
      true,
    );
  });

  it("permite leer a todos y escribir solo a team_leader+", () => {
    const expectedWriteRoles = new Set([
      "team_leader",
      "supervisor",
      "admin",
    ]);

    for (const role of CANONICAL_ROLES) {
      const permissions = getModulePermissions("base-conocimiento", role);
      expect(permissions.canRead).toBe(true);
      expect(permissions.canWrite).toBe(expectedWriteRoles.has(role));
    }
  });

  it("visible para mesa de Coordinación (no está en la blocklist)", () => {
    // isSectionVisibleSync es la fuente de verdad de visibilidad por mesa.
    expect(
      isSectionVisibleSync(COORD_HELPDESK, "agent", "/base-conocimiento"),
    ).toBe(true);
  });
});
