import test from "node:test";
import assert from "node:assert/strict";
import {
  splitCriteriaByAgent,
  mergeCouncil,
  buildJudgePrompt,
  type AgentVerdictMap,
} from "./councilEvaluator.js";
import { getAiCriteria } from "../qualityAiEvaluator.js";
import { CHANNEL_TYPES } from "../../types/quality.js";

test("cobertura de buckets: todo criterio de getAiCriteria() para los 3 canales es clasificado por patrones explícitos de Alpha o Beta", () => {
  for (const channel of CHANNEL_TYPES) {
    const criteria = getAiCriteria(channel);
    // splitCriteriaByAgent lanza error explícito si algún criterio no coincide con ALPHA_PATTERNS ni con BETA_PATTERNS
    const { alpha, beta } = splitCriteriaByAgent(criteria);
    assert.ok(alpha.length > 0, `Canal ${channel} debe tener criterios de procesos (Alpha)`);
    assert.ok(beta.length > 0, `Canal ${channel} debe tener criterios de cliente/datos (Beta)`);
    assert.equal(alpha.length + beta.length, criteria.length);

    // Verificar que los códigos asignados a cada agente cumplan exclusivamente con su tipo de responsabilidad
    for (const a of alpha) {
      assert.match(a.code, /(?:categorizacion|tipo|prioridad|sondeo|procedimiento|interpretacion|resolucion)/);
    }
    for (const b of beta) {
      assert.match(b.code, /(?:analisis|seguimiento|exactitud_datos|ortografia|documentacion|info_complementaria|descripcion|redaccion|claridad)/);
    }
  }
});

test("cobertura de buckets con emailThread: todos los criterios de mail son asignados a Alpha o Beta", () => {
  const criteria = getAiCriteria("wise_email", { hasEmailThread: true });
  const { alpha, beta } = splitCriteriaByAgent(criteria);
  assert.equal(alpha.length + beta.length, criteria.length);

  for (const a of alpha) {
    assert.match(a.code, /(?:categorizacion|tipo|prioridad|sondeo|procedimiento|interpretacion|resolucion)/);
  }
  for (const b of beta) {
    assert.match(b.code, /(?:analisis|seguimiento|exactitud_datos|ortografia|documentacion|info_complementaria|descripcion|redaccion|claridad)/);
  }

  const alphaCodes = new Set(alpha.map((c) => c.code));
  const betaCodes = new Set(beta.map((c) => c.code));

  assert.ok(alphaCodes.has("email_interpretacion"));
  assert.ok(alphaCodes.has("email_resolucion"));
  assert.ok(betaCodes.has("email_redaccion"));
  assert.ok(betaCodes.has("email_claridad"));
});

test("cobertura de buckets con audio: todos los criterios telefónicos son asignados a Alpha o Beta", () => {
  const criteria = getAiCriteria("wise_call", { hasAudio: true });
  const { alpha, beta } = splitCriteriaByAgent(criteria);
  assert.equal(alpha.length + beta.length, criteria.length);

  for (const a of alpha) {
    assert.match(a.code, /(?:categorizacion|tipo|prioridad|sondeo|procedimiento|control_conversacion|interes_resolver)/);
  }
  for (const b of beta) {
    assert.match(b.code, /(?:analisis|seguimiento|exactitud_datos|ortografia|documentacion|info_complementaria|descripcion|saludo_estandar|cordialidad|despedida_cordial|lenguaje_apropiado|escucha_activa|contencion_espera)/);
  }
});

test("mergeCouncil: dos null devuelven directo + sin_evidencia conservando min(alpha, beta)", () => {
  const alphaMap: AgentVerdictMap = {
    criterio_a: {
      codigo: "criterio_a",
      cumple: null,
      confianza: 0.9,
      evidencia: "",
      razonamiento: "No hay datos",
    },
  };
  const betaMap: AgentVerdictMap = {
    criterio_a: {
      codigo: "criterio_a",
      cumple: null,
      confianza: 0.8,
      evidencia: "",
      razonamiento: "Sin evidencia",
    },
  };

  const { resolved, disputes } = mergeCouncil(["criterio_a"], alphaMap, betaMap);
  assert.equal(disputes.length, 0);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].codigo, "criterio_a");
  assert.equal(resolved[0].cumple, null);
  assert.equal(resolved[0].confianza, 0.8, "Debe ser min(0.9, 0.8) = 0.8");
  assert.equal(resolved[0].consenso, "directo");
  assert.equal(resolved[0].motivo, "sin_evidencia");
});

test("mergeCouncil: mismo cumple con confianzas >= 0.85 devuelve directo con min(confianza)", () => {
  const alphaMap: AgentVerdictMap = {
    criterio_b: {
      codigo: "criterio_b",
      cumple: true,
      confianza: 0.95,
      evidencia: "Solución aplicada correctamente",
      razonamiento: "Cumple rúbrica",
    },
  };
  const betaMap: AgentVerdictMap = {
    criterio_b: {
      codigo: "criterio_b",
      cumple: true,
      confianza: 0.88,
      evidencia: "Se documentó la solución",
      razonamiento: "El usuario aprobó",
    },
  };

  const { resolved, disputes } = mergeCouncil(["criterio_b"], alphaMap, betaMap);
  assert.equal(disputes.length, 0);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].cumple, true);
  assert.equal(resolved[0].confianza, 0.88);
  assert.equal(resolved[0].consenso, "directo");
  assert.equal(resolved[0].motivo, "acuerdo_alto");
});

test("mergeCouncil: mismo cumple pero confianza < 0.85 pasa a disputa para el Juez", () => {
  const alphaMap: AgentVerdictMap = {
    criterio_c: {
      codigo: "criterio_c",
      cumple: true,
      confianza: 0.9,
      evidencia: "Ok",
      razonamiento: "Bien",
    },
  };
  const betaMap: AgentVerdictMap = {
    criterio_c: {
      codigo: "criterio_c",
      cumple: true,
      confianza: 0.7,
      evidencia: "Dudoso",
      razonamiento: "Falta claridad",
    },
  };

  const { resolved, disputes } = mergeCouncil(["criterio_c"], alphaMap, betaMap);
  assert.equal(resolved.length, 0);
  assert.equal(disputes.length, 1);
  assert.equal(disputes[0].codigo, "criterio_c");
  assert.equal(disputes[0].motivo, "baja_confianza");
});

test("mergeCouncil: veredictos opuestos (true vs false o null vs true) pasan a disputa", () => {
  const alphaMap: AgentVerdictMap = {
    criterio_d: {
      codigo: "criterio_d",
      cumple: true,
      confianza: 0.9,
      evidencia: "Documentado",
      razonamiento: "Explicó los pasos",
    },
  };
  const betaMap: AgentVerdictMap = {
    criterio_d: {
      codigo: "criterio_d",
      cumple: false,
      confianza: 0.85,
      evidencia: "Incompleto",
      razonamiento: "Faltó captura",
    },
  };

  const { resolved, disputes } = mergeCouncil(["criterio_d"], alphaMap, betaMap);
  assert.equal(resolved.length, 0);
  assert.equal(disputes.length, 1);
  assert.equal(disputes[0].codigo, "criterio_d");
  assert.equal(disputes[0].motivo, "discrepancia_cumple");
});

test("mergeCouncil: si un bucket estuvo ausente o falló, se resuelve sin_oposicion sin invocar al juez", () => {
  const alphaMap: AgentVerdictMap = {
    criterio_e: {
      codigo: "criterio_e",
      cumple: true,
      confianza: 0.9,
      evidencia: "Solo Alpha",
      razonamiento: "Solo evaluado por Alpha",
    },
  };
  const betaMap: AgentVerdictMap = {};

  const { resolved, disputes } = mergeCouncil(["criterio_e"], alphaMap, betaMap);
  assert.equal(disputes.length, 0);
  assert.equal(resolved.length, 1);
  assert.ok(
    resolved[0].consenso === "agente_especialista" || resolved[0].consenso === "sin_oposicion",
    "Debe resolverse como especialista sin oposición",
  );
  assert.equal(resolved[0].cumple, true);
});

test("buildJudgePrompt genera un prompt quirúrgico conciso (< 500 tokens por disputa)", () => {
  const prompt = buildJudgePrompt([
    {
      codigo: "call_ticket_procedimiento",
      criterioNombre: "Procedimiento y Derivación",
      rubrica: "Debe derivar a MDA Nivel 2 solo con diagnóstico previo.",
      alphaVote: {
        codigo: "call_ticket_procedimiento",
        cumple: true,
        confianza: 0.85,
        evidencia: "Hizo ping a la IP",
        razonamiento: "Realizó diagnóstico antes de derivar",
      },
      betaVote: {
        codigo: "call_ticket_procedimiento",
        cumple: false,
        confianza: 0.9,
        evidencia: "No adjuntó captura",
        razonamiento: "El procedimiento exige captura de pantalla",
      },
      motivo: "discrepancia_cumple",
    },
  ]);

  assert.ok(prompt.includes("call_ticket_procedimiento"));
  assert.ok(prompt.includes("Postura Agente Alpha"));
  assert.ok(prompt.includes("Postura Agente Beta"));
  assert.ok(prompt.length < 2500); // Conciso (< 500 tokens)
});
