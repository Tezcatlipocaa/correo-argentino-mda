import { describe, it, expect } from "vitest";
import {
  CHANNEL_TYPES,
  type ChannelType,
  type QualityAuditRecord,
  type EvaluationParameter,
} from "../../src/types/quality";
import {
  WISE_CALL_PARAMETERS,
  WISE_EMAIL_PARAMETERS,
  INVGATE_AG_PARAMETERS,
  getChannelParameters,
} from "../../src/config/qualityParams";

describe("Quality Multi-Channel Model and Types", () => {
  it("defines the three supported channels", () => {
    expect(CHANNEL_TYPES).toEqual(["wise_call", "wise_email", "invgate_ticket"]);
  });

  it("validates Wise Call parameter configuration", () => {
    const params = WISE_CALL_PARAMETERS;
    expect(params.length).toBeGreaterThanOrEqual(18);

    const section1 = params.filter((p) => p.section === "items");
    const section2 = params.filter((p) => p.section === "ticket");

    expect(section1.length).toBeGreaterThan(0);
    expect(section2.length).toBeGreaterThan(0);

    // Sum of reference percentages for non-n/a items
    const s1Weights = section1
      .filter((p) => typeof p.weight === "number")
      .reduce((sum, p) => sum + (p.weight ?? 0), 0);
    expect(s1Weights).toBe(45); // 3+3+3+6+6+3+3+3+5+10 = 45%

    // Verificamos que contenga parámetros clave
    expect(params.some((p) => p.code === "call_cordialidad")).toBe(true);
    expect(params.some((p) => p.code === "call_procedimiento")).toBe(true);
    expect(params.some((p) => p.code === "call_ticket_categorizacion")).toBe(true);
  });

  it("validates Wise Email parameter configuration", () => {
    const params = WISE_EMAIL_PARAMETERS;
    const section1 = params.filter((p) => p.section === "items");
    const section2 = params.filter((p) => p.section === "mda");

    expect(section1.length).toBeGreaterThan(0);
    expect(section2.length).toBeGreaterThan(0);

    // Verificamos parámetros clave
    expect(params.some((p) => p.code === "email_procedimientos")).toBe(true);
    expect(params.some((p) => p.code === "email_sla_90min")).toBe(true);
    expect(params.some((p) => p.code === "email_mda_sla_resolucion")).toBe(true);
  });

  it("validates InvGate AG parameter configuration", () => {
    const params = INVGATE_AG_PARAMETERS;
    const section1 = params.filter((p) => p.section === "items");
    const section2 = params.filter((p) => p.section === "mda");

    expect(section1.length).toBeGreaterThan(0);
    expect(section2.length).toBeGreaterThan(0);

    // Verificamos parámetros clave
    expect(params.some((p) => p.code === "ag_procedimiento")).toBe(true);
    expect(params.some((p) => p.code === "ag_categorizacion")).toBe(true);
    expect(params.some((p) => p.code === "ag_mda_sla_primera_respuesta")).toBe(true);
  });

  it("retrieves parameters correctly via getChannelParameters helper", () => {
    const callParams = getChannelParameters("wise_call");
    const emailParams = getChannelParameters("wise_email");
    const agParams = getChannelParameters("invgate_ticket");

    expect(callParams).toBe(WISE_CALL_PARAMETERS);
    expect(emailParams).toBe(WISE_EMAIL_PARAMETERS);
    expect(agParams).toBe(INVGATE_AG_PARAMETERS);
  });
});
