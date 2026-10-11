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
    expect(params.length).toBe(18); // Exactamente 10 en Atención + 8 en Ticket

    const section1 = params.filter((p) => p.section === "items");
    const section2 = params.filter((p) => p.section === "ticket");

    expect(section1.length).toBe(10);
    expect(section2.length).toBe(8);

    // Sum of reference percentages
    const s1Weights = section1
      .filter((p) => typeof p.weight === "number")
      .reduce((sum, p) => sum + (p.weight ?? 0), 0);
    expect(s1Weights).toBe(45);

    const s2Weights = section2
      .filter((p) => typeof p.weight === "number")
      .reduce((sum, p) => sum + (p.weight ?? 0), 0);
    expect(s2Weights).toBe(55);

    // Verificamos los 10 de atención
    const expectedS1Codes = [
      "call_cordialidad",
      "call_saludo_estandar",
      "call_interes_resolver",
      "call_sondeo",
      "call_escucha_activa",
      "call_control_conversacion",
      "call_contencion_espera",
      "call_despedida_cordial",
      "call_lenguaje_apropiado",
      "call_procedimiento",
    ];
    expect(section1.map((p) => p.code)).toEqual(expectedS1Codes);
    expect(params.some((p) => p.code === "call_solicitud")).toBe(false);

    // Verificamos los 8 de ticket
    const expectedS2Codes = [
      "call_ticket_origen",
      "call_ticket_tipo",
      "call_ticket_categorizacion",
      "call_ticket_ortografia",
      "call_ticket_prioridad",
      "call_ticket_titulo",
      "call_ticket_descripcion",
      "call_ticket_exactitud_datos",
    ];
    expect(section2.map((p) => p.code)).toEqual(expectedS2Codes);
    expect(params.some((p) => p.code === "call_ticket_reclamo_novedad")).toBe(false);
  });

  it("validates Wise Email parameter configuration", () => {
    const params = WISE_EMAIL_PARAMETERS;
    const section1 = params.filter((p) => p.section === "items");
    const section2 = params.filter((p) => p.section === "mda");

    expect(section1.length).toBeGreaterThan(0);
    expect(section2.length).toBe(11);

    // No debe contener reclamo / novedad
    expect(params.some((p) => p.code === "email_mda_reclamo_novedad")).toBe(false);

    // Suma de ponderaciones de sección 2 debe ser exactamente 100
    const s2Weights = section2.reduce((sum, p) => sum + (p.weight ?? 0), 0);
    expect(s2Weights).toBe(100);

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
