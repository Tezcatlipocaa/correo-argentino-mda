import { describe, it, expect } from "vitest";
import { canUserAccessCredentials } from "@lib/credentialAccess";

describe("canUserAccessCredentials", () => {
  it("rechaza si el usuario es nulo, indefinido o no está autenticado (id === 0)", () => {
    expect(canUserAccessCredentials(null, {})).toBe(false);
    expect(canUserAccessCredentials(undefined, {})).toBe(false);
    expect(canUserAccessCredentials({ id: 0, role: "agent" }, {})).toBe(false);
  });

  it("permite acceso irrestricto siempre para rol admin sin importar mesa ni rol requerido", () => {
    const adminUser = {
      id: 1,
      role: "admin",
      helpdeskName: "Cualquier Mesa",
    };

    expect(
      canUserAccessCredentials(adminUser, {
        credentialMinRole: "supervisor",
        credentialHelpdesk: "TI_GSM_MDA TI",
      }),
    ).toBe(true);

    expect(
      canUserAccessCredentials(adminUser, {
        credentialMinRole: "admin",
        credentialHelpdesk: "Mesa Inexistente",
      }),
    ).toBe(true);
  });

  it("evalúa correctamente la jerarquía de roles", () => {
    const agent = { id: 2, role: "agent", helpdeskName: null };
    const referent = { id: 3, role: "referent", helpdeskName: null };
    const teamLeader = { id: 4, role: "team_leader", helpdeskName: null };
    const supervisor = { id: 5, role: "supervisor", helpdeskName: null };

    // Default: 'agent' -> todos tienen acceso
    expect(canUserAccessCredentials(agent, {})).toBe(true);
    expect(canUserAccessCredentials(referent, {})).toBe(true);

    // Requiere 'referent'
    expect(canUserAccessCredentials(agent, { credentialMinRole: "referent" })).toBe(false);
    expect(canUserAccessCredentials(referent, { credentialMinRole: "referent" })).toBe(true);
    expect(canUserAccessCredentials(teamLeader, { credentialMinRole: "referent" })).toBe(true);

    // Requiere 'supervisor'
    expect(canUserAccessCredentials(teamLeader, { credentialMinRole: "supervisor" })).toBe(false);
    expect(canUserAccessCredentials(supervisor, { credentialMinRole: "supervisor" })).toBe(true);
  });

  it("evalúa restricción por mesa (credentialHelpdesk)", () => {
    const mdaUser = {
      id: 10,
      role: "agent",
      helpdeskName: "TI_GSM_MDA TI",
    };

    const coordUser = {
      id: 11,
      role: "agent",
      helpdeskName: "TI_GSM_Mesa de Coord",
    };

    const noMesaUser = {
      id: 12,
      role: "agent",
      helpdeskName: null,
    };

    // Sin restricción de mesa -> todos pasan
    expect(canUserAccessCredentials(mdaUser, { credentialHelpdesk: null })).toBe(true);
    expect(canUserAccessCredentials(coordUser, { credentialHelpdesk: "" })).toBe(true);
    expect(canUserAccessCredentials(noMesaUser, { credentialHelpdesk: undefined })).toBe(true);

    // Restringido a MDA TI
    expect(canUserAccessCredentials(mdaUser, { credentialHelpdesk: "TI_GSM_MDA TI" })).toBe(true);
    expect(canUserAccessCredentials(coordUser, { credentialHelpdesk: "TI_GSM_MDA TI" })).toBe(false);
    expect(canUserAccessCredentials(noMesaUser, { credentialHelpdesk: "TI_GSM_MDA TI" })).toBe(false);
  });

  it("exige cumplir tanto rol como mesa simultáneamente para no-admins", () => {
    const user = {
      id: 20,
      role: "referent",
      helpdeskName: "TI_GSM_MDA TI",
    };

    // Cumple rol pero no mesa
    expect(
      canUserAccessCredentials(user, {
        credentialMinRole: "agent",
        credentialHelpdesk: "TI_GSM_Mesa de Coord",
      }),
    ).toBe(false);

    // Cumple mesa pero no rol
    expect(
      canUserAccessCredentials(user, {
        credentialMinRole: "supervisor",
        credentialHelpdesk: "TI_GSM_MDA TI",
      }),
    ).toBe(false);

    // Cumple ambos
    expect(
      canUserAccessCredentials(user, {
        credentialMinRole: "referent",
        credentialHelpdesk: "TI_GSM_MDA TI",
      }),
    ).toBe(true);
  });
});
