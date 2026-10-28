import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planSlaPostponements,
  type SlaPlanOperator,
  type SlaPlanTicketInput,
} from "./agsSlaView";

const NOW = new Date("2026-10-28T10:00:00");

const ticket = (
  id: number,
  agentInvgateId: number | null = 900,
): SlaPlanTicketInput => ({
  id,
  agentInvgateId,
  subject: `Ticket ${id}`,
  slaResolution: "2%",
  slaFirstReply: "1%",
});

const operator = (
  overrides: Partial<SlaPlanOperator> = {},
): SlaPlanOperator => ({
  agentId: 1,
  invgateId: 900,
  nombre: "Operador Uno",
  disponible: false,
  motivo: "En break",
  wiseCxCategory: "bloqueado",
  proximoTurnoDisponible: "2026-10-28T13:00",
  proximoTurnoMotivo: "Fin de break (13:00)",
  ...overrides,
});

test("un agente en línea no se posterga: el SLA debe seguir corriendo", () => {
  for (const category of ["disponible", "en_llamada"]) {
    const plan = planSlaPostponements(
      [ticket(1)],
      [operator({ wiseCxCategory: category as SlaPlanOperator["wiseCxCategory"] })],
      NOW,
    );
    assert.equal(plan[0].action, "skip");
    assert.equal(plan[0].reason, "agente en línea");
    assert.equal(plan[0].fechaPropuesta, null);
  }
});

test("un agente en break se posterga hasta el fin del break", () => {
  const plan = planSlaPostponements([ticket(1)], [operator()], NOW);
  assert.deepEqual(
    {
      action: plan[0].action,
      fechaPropuesta: plan[0].fechaPropuesta,
      agentName: plan[0].agentName,
    },
    {
      action: "postpone",
      fechaPropuesta: "2026-10-28T13:00",
      agentName: "Operador Uno",
    },
  );
});

test("un agente desconectado se posterga hasta su próximo turno hábil", () => {
  const plan = planSlaPostponements(
    [ticket(1)],
    [
      operator({
        wiseCxCategory: "desconectado",
        motivo: "Fuera de horario",
        proximoTurnoDisponible: "2026-10-29T08:00",
        proximoTurnoMotivo: "Próximo turno (Jue 29/10 08:00)",
      }),
    ],
    NOW,
  );
  assert.equal(plan[0].action, "postpone");
  assert.equal(plan[0].fechaPropuesta, "2026-10-29T08:00");
});

test("un ticket cuyo agente no está en la nómina se saltea", () => {
  const plan = planSlaPostponements([ticket(1, 999)], [operator()], NOW);
  assert.equal(plan[0].action, "skip");
  assert.equal(plan[0].reason, "sin turno calculable");
});

test("un agente sin próximo turno calculable se saltea", () => {
  const plan = planSlaPostponements(
    [ticket(1)],
    [operator({ proximoTurnoDisponible: undefined, motivo: "Vacaciones" })],
    NOW,
  );
  assert.equal(plan[0].action, "skip");
  assert.equal(plan[0].reason, "sin turno calculable");
});

test("un turno ya vencido no se usa como fecha de postergación", () => {
  const plan = planSlaPostponements(
    [ticket(1)],
    [operator({ proximoTurnoDisponible: "2026-10-28T09:00" })],
    NOW,
  );
  assert.equal(plan[0].action, "skip");
  assert.equal(plan[0].reason, "turno ya vencido");
});

test("cada ticket del plan arrastra sus datos de SLA y asunto para la tabla", () => {
  const plan = planSlaPostponements([ticket(7)], [operator()], NOW);
  assert.deepEqual(
    {
      ticketId: plan[0].ticketId,
      subject: plan[0].subject,
      slaResolution: plan[0].slaResolution,
      slaFirstReply: plan[0].slaFirstReply,
    },
    { ticketId: 7, subject: "Ticket 7", slaResolution: "2%", slaFirstReply: "1%" },
  );
});
